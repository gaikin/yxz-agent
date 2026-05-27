"use strict"

const fs = require("node:fs/promises")
const path = require("node:path")
const http = require("node:http")
const { spawn } = require("node:child_process")

const workspaceRoot = process.cwd()
const runtimeDir = path.join(workspaceRoot, "subprocess", "schedule", "runtime")
const demoSchedulesFile = path.join(runtimeDir, "demo-schedules.json")
const demoHistoryFile = path.join(runtimeDir, "demo-schedule-history.json")
const mockHost = process.env.MOCK_MCP_HOST || "127.0.0.1"
const mockPort = Number(process.env.MOCK_MCP_PORT || 26666)

function nowIso() {
  return new Date().toISOString()
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForHealth(url, timeoutMs = 10000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const ok = await new Promise((resolve) => {
        const req = http.get(url, (res) => {
          resolve(res.statusCode === 200)
          res.resume()
        })
        req.on("error", () => resolve(false))
      })

      if (ok) {
        return
      }
    } catch {
      // ignore and retry
    }

    await wait(300)
  }
  throw new Error(`Mock MCP health check timeout: ${url}`)
}

function startNodeProcess(scriptPath, env) {
  const child = spawn(process.execPath, [scriptPath], {
    cwd: workspaceRoot,
    env: {
      ...process.env,
      ...env,
    },
    stdio: "inherit",
  })

  child.on("error", (error) => {
    console.error(`[demo] process failed: ${scriptPath}`, error)
  })
  return child
}

async function writeDemoSchedule() {
  await fs.mkdir(runtimeDir, { recursive: true })
  await fs.rm(demoHistoryFile, { force: true })

  const scheduleId = `schedule_demo_${Date.now()}`
  const payload = {
    schedules: [
      {
        scheduleId,
        name: "本地定时任务Demo(10秒后触发)",
        cronExpression: "*/10 * * * * *",
        timezone: "Asia/Shanghai",
        skillFile: "subprocess/schedule/examples/skills/query_3040_today.json",
        enabled: true,
      },
    ],
  }

  await fs.writeFile(demoSchedulesFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  return scheduleId
}

async function main() {
  console.log(`[demo] start at ${nowIso()}`)
  const scheduleId = await writeDemoSchedule()
  console.log(`[demo] schedule file: ${demoSchedulesFile}`)
  console.log(`[demo] history file:  ${demoHistoryFile}`)
  console.log(`[demo] scheduleId:    ${scheduleId}`)

  const mockScript = path.join(workspaceRoot, "subprocess", "schedule", "mock-mcp-server.js")
  const runnerScript = path.join(
    workspaceRoot,
    "subprocess",
    "schedule",
    "local-scheduled-skill-runner.js"
  )
  const mcpBaseUrl = `http://${mockHost}:${mockPort}`
  const healthUrl = `${mcpBaseUrl}/health`

  const mock = startNodeProcess(mockScript, {
    MOCK_MCP_HOST: mockHost,
    MOCK_MCP_PORT: String(mockPort),
  })

  let exitCode = 0
  try {
    await waitForHealth(healthUrl, 12000)
    console.log(`[demo] mock MCP ready: ${mcpBaseUrl}`)

    const runner = startNodeProcess(runnerScript, {
      MCP_BASE_URL: mcpBaseUrl,
      SCHEDULES_FILE: demoSchedulesFile,
      SCHEDULE_HISTORY_FILE: demoHistoryFile,
    })

    await wait(15000)
    runner.kill("SIGTERM")
    await new Promise((resolve) => runner.once("exit", resolve))

    const historyRaw = await fs.readFile(demoHistoryFile, "utf8")
    const history = JSON.parse(historyRaw)
    console.log("[demo] execution history:")
    console.log(JSON.stringify(history, null, 2))
  } catch (error) {
    exitCode = 1
    console.error(error instanceof Error ? error.stack || error.message : String(error))
  } finally {
    mock.kill("SIGTERM")
    await new Promise((resolve) => mock.once("exit", resolve))
    process.exitCode = exitCode
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
