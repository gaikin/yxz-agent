"use strict"

const path = require("node:path")
const { spawn } = require("node:child_process")

function run() {
  const workspaceRoot = process.cwd()
  const skillArg = process.argv[2] || "test_mcp_2900_smoke.json"
  const eventArg =
    process.argv[3] || path.join("scripts", "fixtures", "test-mcp-2900-event.json")

  const childEnv = {
    ...process.env,
    MCP_BASE_URL: process.env.MCP_BASE_URL || "http://127.0.0.1:3000",
    MCP_SESSION_PATH: process.env.MCP_SESSION_PATH || "/mcp",
    MCP_MESSAGE_PATH: process.env.MCP_MESSAGE_PATH || "/messages",
    MCP_SESSION_CLOSE_PATH: process.env.MCP_SESSION_CLOSE_PATH || "/mcp",
  }

  if (!childEnv.SKILL_EVENT_JSON && !childEnv.SKILL_EVENT_FILE) {
    childEnv.SKILL_EVENT_FILE = eventArg
  }

  const child = spawn(
    process.execPath,
    [path.join(workspaceRoot, "scripts", "run-local-skill.js"), skillArg],
    {
      cwd: workspaceRoot,
      env: childEnv,
      stdio: "inherit",
    }
  )

  child.on("error", (error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error))
    process.exit(1)
  })

  child.on("exit", (code) => {
    process.exit(code ?? 1)
  })
}

run()
