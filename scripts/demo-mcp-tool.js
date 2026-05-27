"use strict"

const axios = require("axios")

function normalizeBaseUrl(input) {
  const url = new URL(input)
  const normalizedPath = url.pathname.replace(/\/+$/, "")

  if (normalizedPath === "/mcp") {
    url.pathname = "/"
  } else if (normalizedPath.endsWith("/api/mcp")) {
    url.pathname = normalizedPath.slice(0, -"/api/mcp".length) || "/"
  }

  return url.toString()
}

class SseSessionClient {
  constructor(baseUrl) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.sessionPath = "/api/mcp/sse"
    this.messagePath = "/api/mcp/message"
    this.sessionId = undefined
    this.nextId = 1
    this.client = axios.create({
      timeout: 15000,
      validateStatus: () => true,
    })
  }

  async call(name, args) {
    const request = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    }

    const sessionId = await this.getSessionId()
    const url = new URL(this.messagePath, this.baseUrl)
    url.searchParams.set("sessionId", sessionId)

    const response = await this.client.post(url.toString(), request, {
      headers: {
        "content-type": "application/json",
      },
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`MCP request failed: ${response.status}`)
    }

    return response.data
  }

  async getSessionId() {
    if (this.sessionId) {
      return this.sessionId
    }

    const response = await this.client.get(new URL(this.sessionPath, this.baseUrl).toString(), {
      headers: {
        accept: "text/event-stream, application/json",
      },
      responseType: "stream",
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`MCP session creation failed: ${response.status}`)
    }

    const headerSessionId =
      response.headers["mcp-session-id"] ||
      response.headers["x-session-id"] ||
      response.headers["session-id"]

    if (headerSessionId) {
      this.sessionId = String(Array.isArray(headerSessionId) ? headerSessionId[0] : headerSessionId)
      await this.closeSessionResponse(response)
      return this.sessionId
    }

    const contentType = String(response.headers["content-type"] || "")
    if (contentType.includes("application/json")) {
      const payload = response.data
      this.sessionId = payload.sessionId || payload?.data?.sessionId
      if (this.sessionId) {
        return this.sessionId
      }
    }

    await this.closeSessionResponse(response)
    throw new Error("MCP session created but sessionId was not found")
  }

  async closeSessionResponse(response) {
    const contentType = String(response.headers["content-type"] || "")
    if (contentType.includes("application/json")) {
      return
    }

    try {
      response.data?.destroy?.()
    } catch {
      // ignore
    }
  }
}

function tryParseJson(input, fallback) {
  if (!input) {
    return fallback
  }

  try {
    return JSON.parse(input)
  } catch (error) {
    throw new Error(`Invalid JSON: ${input}\n${error instanceof Error ? error.message : String(error)}`)
  }
}

function findStringByKey(input, wantedKey, depth = 0) {
  if (depth > 6 || input === null || input === undefined) {
    return undefined
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findStringByKey(item, wantedKey, depth + 1)
      if (found) {
        return found
      }
    }
    return undefined
  }

  if (typeof input === "object") {
    if (typeof input[wantedKey] === "string" && input[wantedKey].length > 0) {
      return input[wantedKey]
    }

    for (const value of Object.values(input)) {
      const found = findStringByKey(value, wantedKey, depth + 1)
      if (found) {
        return found
      }
    }
  }

  return undefined
}

function printUsage() {
  console.log(`
Usage:
  npm run demo:mcp -- call <toolName> '<jsonArgs>'
  npm run demo:mcp -- demo3040 [menuShortCode]

Examples:
  npm run demo:mcp -- call openMenu '{"menuShortCode":"3040"}'
  npm run demo:mcp -- call readSchema '{"tabId":"tab_001"}'
  npm run demo:mcp -- call executePageCommands '{"tabId":"tab_001","commands":[{"componentId":"btn_query_1","command":"click"}]}'
  npm run demo:mcp -- demo3040

Environment:
  MCP_BASE_URL=http://127.0.0.1:26666
`)
}

async function run() {
  const [, , command = "demo3040", ...rest] = process.argv
  const baseUrl = process.env.MCP_BASE_URL || "http://127.0.0.1:26666"
  const client = new SseSessionClient(baseUrl)

  console.log(`MCP baseUrl: ${baseUrl}`)

  if (command === "call") {
    const toolName = rest[0]
    const args = tryParseJson(rest[1], {})

    if (!toolName) {
      printUsage()
      process.exitCode = 1
      return
    }

    const result = await client.call(toolName, args)
    console.log(JSON.stringify(result, null, 2))
    return
  }

  if (command === "demo3040") {
    const menuShortCode = rest[0] || "3040"
    console.log(`\n[1/2] openMenu(${menuShortCode})`)
    const openMenuResult = await client.call("openMenu", { menuShortCode })
    console.log(JSON.stringify(openMenuResult, null, 2))

    const tabId = findStringByKey(openMenuResult, "tabId")
    if (!tabId) {
      console.log("\nNo tabId found in openMenu result. Stop here and inspect the payload above.")
      return
    }

    console.log(`\n[2/2] readSchema(${tabId})`)
    const readSchemaResult = await client.call("readSchema", { tabId })
    console.log(JSON.stringify(readSchemaResult, null, 2))

    console.log(`
Next step example:
  npm run demo:mcp -- call executePageCommands '{"tabId":"${tabId}","commands":[{"componentId":"btn_query_1","command":"click"}]}'
`)
    return
  }

  printUsage()
  process.exitCode = 1
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error))
  process.exitCode = 1
})
