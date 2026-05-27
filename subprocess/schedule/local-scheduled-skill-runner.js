"use strict"

const path = require("node:path")
const { loadSkillFromFile } = require("./local-json-skill-loader")
const { AxiosSessionJsonRpcToolTransport, JsonRpcMcpToolClient } = require("./mcp-axios-client")
const { DirectMcpSkillRunner } = require("./direct-mcp-skill-runner")
const { LocalJsonScheduleEngine } = require("./local-json-schedule-engine")

class LocalScheduledSkillRunner {
  constructor(options) {
    this.options = options
    this.transport = new AxiosSessionJsonRpcToolTransport({
      baseUrl: options.mcpBaseUrl || process.env.MCP_BASE_URL || "http://127.0.0.1:26666",
    })
    this.client = new JsonRpcMcpToolClient(this.transport)
    this.skillRunner = new DirectMcpSkillRunner(this.client)
    this.engine = new LocalJsonScheduleEngine({
      workspaceRoot: options.workspaceRoot,
      schedulesFile: options.schedulesFile,
      historyFile: options.historyFile,
      now: options.now,
      onTrigger: async ({ schedule, dueAt, skillFilePath }) => {
        const skill = await loadSkillFromFile(skillFilePath)
        const result = await this.skillRunner.run(skill)
        return {
          scheduleId: schedule.scheduleId,
          skillId: skill.skillId,
          dueAt: dueAt.toISOString(),
          result,
        }
      },
    })
  }

  async start() {
    await this.engine.start()
  }

  async stop() {
    await this.engine.stop()
  }

  getState(scheduleId) {
    return this.engine.getState(scheduleId)
  }

  getSnapshot() {
    return this.engine.getSnapshot()
  }
}

async function main() {
  const workspaceRoot = process.cwd()
  const runner = new LocalScheduledSkillRunner({
    workspaceRoot,
    schedulesFile:
      process.env.SCHEDULES_FILE || "subprocess/schedule/examples/schedules.json",
    historyFile:
      process.env.SCHEDULE_HISTORY_FILE || "subprocess/schedule/runtime/schedule-history.json",
    mcpBaseUrl: process.env.MCP_BASE_URL || "http://127.0.0.1:26666",
  })

  await runner.start()
  console.log(JSON.stringify(runner.getSnapshot(), null, 2))
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exitCode = 1
  })
}

module.exports = {
  LocalScheduledSkillRunner,
}
