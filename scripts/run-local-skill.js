"use strict"

const fs = require("node:fs")
const path = require("node:path")
const {
  loadSkillFromFile,
} = require("../dist/subprocess/service/LocalSkillLoader")
const {
  DirectMcpSkillEngine,
} = require("../dist/subprocess/service/execution/skillScriptEngine")
const {
  JsonRpcMcpToolClient,
  SseSessionJsonRpcToolTransport,
} = require("../dist/subprocess/service/execution/mcpToolClient")

function resolveInputPath(workspaceRoot, inputPath) {
  if (!inputPath) {
    return path.join(workspaceRoot, "skills", "query_3040_today.json")
  }

  if (path.isAbsolute(inputPath)) {
    return inputPath
  }

  if (inputPath.includes("/") || inputPath.includes("\\")) {
    return path.resolve(workspaceRoot, inputPath)
  }

  return path.join(workspaceRoot, "skills", inputPath)
}

function readOptionalJsonFromEnv(workspaceRoot, jsonEnvName, fileEnvName) {
  const rawJson = process.env[jsonEnvName]?.trim()
  if (rawJson) {
    return JSON.parse(rawJson)
  }

  const filePath = process.env[fileEnvName]?.trim()
  if (!filePath) {
    return undefined
  }

  const resolvedFilePath = resolveInputPath(workspaceRoot, filePath)
  return JSON.parse(fs.readFileSync(resolvedFilePath, "utf-8"))
}

function createTransport(baseUrl) {
  const sessionPath = process.env.MCP_SESSION_PATH?.trim()
  const messagePath = process.env.MCP_MESSAGE_PATH?.trim()
  const sessionClosePath = process.env.MCP_SESSION_CLOSE_PATH?.trim()

  if (!sessionPath && !messagePath && !sessionClosePath) {
    return new SseSessionJsonRpcToolTransport(baseUrl)
  }

  return new SseSessionJsonRpcToolTransport({
    baseUrl,
    sessionPath,
    messagePath,
    sessionClosePath,
  })
}

function writeStream(stream, text) {
  return new Promise((resolve, reject) => {
    stream.write(text, (error) => {
      if (error) {
        reject(error)
        return
      }
      resolve()
    })
  })
}

async function main() {
  const workspaceRoot = process.cwd()
  const filePath = resolveInputPath(workspaceRoot, process.argv[2])
  const skill = await loadSkillFromFile(filePath)
  const event = readOptionalJsonFromEnv(
    workspaceRoot,
    "SKILL_EVENT_JSON",
    "SKILL_EVENT_FILE"
  )

  const mcpBaseUrl = process.env.MCP_BASE_URL || "http://127.0.0.1:26666"
  const transport = createTransport(mcpBaseUrl)
  const client = new JsonRpcMcpToolClient(transport)
  const engine = new DirectMcpSkillEngine(client)

  try {
    const result = await engine.run(skill, {
      event,
    })
    await writeStream(process.stdout, `${JSON.stringify(result, null, 2)}\n`)
  } finally {
    transport.close()
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    const message =
      error instanceof Error ? error.stack || error.message : String(error)
    void writeStream(process.stderr, `${message}\n`).finally(() => {
      process.exit(1)
    })
  })
