"use strict"

const path = require("node:path")
const {
  loadSkillFromFile,
} = require("../dist/subprocess/service/LocalSkillLoader")
const {
  DirectMcpSkillEngine,
} = require("../dist/subprocess/service/SkillService")
const {
  JsonRpcMcpToolClient,
  SseSessionJsonRpcToolTransport,
} = require("../dist/subprocess/service/execution/mcpToolClient")

async function main() {
  const workspaceRoot = process.cwd()
  const fileName = process.argv[2] || "query_3040_today.json"
  const filePath = path.join(workspaceRoot, "skills", fileName)
  const skill = await loadSkillFromFile(filePath)

  const mcpBaseUrl = process.env.MCP_BASE_URL || "http://127.0.0.1:26666"
  const transport = new SseSessionJsonRpcToolTransport(mcpBaseUrl)
  const client = new JsonRpcMcpToolClient(transport)
  const engine = new DirectMcpSkillEngine(client)

  const result = await engine.run(skill)
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
