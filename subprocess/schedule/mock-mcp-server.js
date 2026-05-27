"use strict"

const http = require("node:http")
const { randomUUID } = require("node:crypto")

const PORT = Number(process.env.MOCK_MCP_PORT || 26666)
const HOST = process.env.MOCK_MCP_HOST || "127.0.0.1"
const SESSION_IDLE_MS = Number(process.env.MOCK_MCP_SESSION_IDLE_MS || 5 * 60 * 1000)

const sessions = new Map()

function nowIso() {
  return new Date().toISOString()
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  })
  res.end(JSON.stringify(payload, null, 2))
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ""
    req.setEncoding("utf8")
    req.on("data", (chunk) => {
      raw += chunk
    })
    req.on("end", () => {
      try {
        resolve(raw.length > 0 ? JSON.parse(raw) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on("error", reject)
  })
}

function createSession() {
  const sessionId = `mock-session-${randomUUID()}`
  const session = {
    sessionId,
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    closed: false,
    response: undefined,
  }
  sessions.set(sessionId, session)
  return session
}

function closeSession(sessionId, reason) {
  const session = sessions.get(sessionId)
  if (!session || session.closed) {
    return
  }

  session.closed = true
  if (session.response && !session.response.destroyed) {
    try {
      session.response.write(`event: close\ndata: ${JSON.stringify({ reason })}\n\n`)
    } catch {
      // ignore
    }
    try {
      session.response.end()
    } catch {
      // ignore
    }
  }
  sessions.delete(sessionId)
  console.log("[mock-mcp] session closed", { sessionId, reason })
}

function cleanupIdleSessions() {
  const now = Date.now()
  for (const session of sessions.values()) {
    const idle = now - new Date(session.lastSeenAt).getTime()
    if (idle > SESSION_IDLE_MS) {
      closeSession(session.sessionId, "idle-timeout")
    }
  }
}

function resolveToolResult(name, args) {
  switch (name) {
    case "openMenu": {
      const menuShortCode = typeof args.menuShortCode === "string" ? args.menuShortCode : "demo"
      return {
        tabId: `tab_${menuShortCode}_001`,
        menuShortCode,
        openedAt: nowIso(),
      }
    }
    case "readSchema": {
      const tabId = typeof args.tabId === "string" ? args.tabId : "tab_demo_001"
      return {
        tabId,
        components: [
          {
            componentId: "btn_query_1",
            label: "查询按钮",
            type: "button",
            supportedCommands: ["click", "focus"],
          },
          {
            componentId: "input_date_1",
            label: "日期输入框",
            type: "input",
            supportedCommands: ["setValue", "focus"],
          },
        ],
      }
    }
    case "executePageCommands": {
      const tabId = typeof args.tabId === "string" ? args.tabId : "tab_demo_001"
      const commands = Array.isArray(args.commands) ? args.commands : []
      return {
        ok: true,
        tabId,
        results: commands.map((command) => ({
          componentId: command.componentId,
          command: command.command,
          status: "success",
          message: "mock executed",
        })),
      }
    }
    default:
      throw new Error(`Unsupported tool: ${name}`)
  }
}

function handleSse(req, res) {
  const session = createSession()
  session.response = res

  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "mcp-session-id": session.sessionId,
  })

  res.write(`: session ${session.sessionId}\n\n`)
  console.log("[mock-mcp] session created", {
    sessionId: session.sessionId,
  })

  req.on("close", () => {
    closeSession(session.sessionId, "client-disconnected")
  })
}

async function handleMessage(req, res, url) {
  const sessionId = url.searchParams.get("sessionId")
  if (!sessionId) {
    sendJson(res, 400, {
      error: "sessionId is required",
    })
    return
  }

  const session = sessions.get(sessionId)
  if (!session || session.closed) {
    sendJson(res, 404, {
      error: "session was closed",
      sessionId,
    })
    return
  }

  session.lastSeenAt = nowIso()

  let body
  try {
    body = await parseBody(req)
  } catch (error) {
    sendJson(res, 400, {
      error: "invalid json body",
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }

  console.log("[mock-mcp] message received", {
    sessionId,
    body,
  })

  if (body?.method === "initialize") {
    sendJson(res, 200, {
      jsonrpc: "2.0",
      id: body.id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "mock-mcp-server",
          version: "1.0.0",
        },
      },
    })
    return
  }

  if (body?.method === "notifications/initialized") {
    sendJson(res, 202, {
      accepted: true,
      sessionId,
    })
    return
  }

  if (body?.method !== "tools/call") {
    sendJson(res, 400, {
      error: "unsupported method",
      body,
    })
    return
  }

  const toolName = body?.params?.name
  const args = body?.params?.arguments ?? {}
  if (typeof toolName !== "string" || toolName.length === 0) {
    sendJson(res, 400, {
      error: "tool name is required",
      body,
    })
    return
  }

  try {
    const result = resolveToolResult(toolName, args)
    sendJson(res, 202, {
      accepted: true,
      sessionId,
      requestId: body.id,
    })

    if (session.response && !session.response.destroyed) {
      session.response.write(
        `data: ${JSON.stringify({
          jsonrpc: "2.0",
          id: body.id,
          result,
        })}\n\n`
      )
    }
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
      toolName,
    })
  }
}

function readSessionIdFromDelete(req, url) {
  const headerSessionId =
    req.headers["mcp-session-id"] ||
    req.headers["x-session-id"] ||
    req.headers["session-id"]

  if (typeof headerSessionId === "string" && headerSessionId.length > 0) {
    return headerSessionId
  }

  return url.searchParams.get("sessionId") || url.searchParams.get("session_id")
}

function handleSessionDelete(req, res, url) {
  const sessionId = readSessionIdFromDelete(req, url)
  if (!sessionId) {
    sendJson(res, 400, {
      error: "sessionId is required",
    })
    return
  }

  const session = sessions.get(sessionId)
  if (!session || session.closed) {
    sendJson(res, 404, {
      error: "session was closed",
      sessionId,
    })
    return
  }

  closeSession(sessionId, "client-terminated")
  sendJson(res, 200, {
    ok: true,
    sessionId,
  })
}

function handleDebugSessions(res) {
  sendJson(res, 200, {
    sessions: Array.from(sessions.values()).map((session) => ({
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastSeenAt: session.lastSeenAt,
      closed: session.closed,
    })),
  })
}

const server = http.createServer(async (req, res) => {
  cleanupIdleSessions()

  const method = req.method || "GET"
  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`)

  try {
    if (method === "GET" && url.pathname === "/api/mcp/sse") {
      handleSse(req, res)
      return
    }

    if (method === "POST" && url.pathname === "/api/mcp/message") {
      await handleMessage(req, res, url)
      return
    }

    if (method === "DELETE" && url.pathname === "/api/mcp/sse") {
      handleSessionDelete(req, res, url)
      return
    }

    if (method === "GET" && url.pathname === "/debug/sessions") {
      handleDebugSessions(res)
      return
    }

    if (method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { ok: true, now: nowIso() })
      return
    }

    sendJson(res, 404, {
      error: "not found",
      method,
      pathname: url.pathname,
    })
  } catch (error) {
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[mock-mcp] listening on http://${HOST}:${PORT}`)
  console.log("[mock-mcp] endpoints")
  console.log(`  GET  http://${HOST}:${PORT}/api/mcp/sse`)
  console.log(`  POST http://${HOST}:${PORT}/api/mcp/message?sessionId=...`)
  console.log(`  DELETE http://${HOST}:${PORT}/api/mcp/sse?sessionId=...`)
  console.log(`  GET  http://${HOST}:${PORT}/debug/sessions`)
})

function shutdown() {
  for (const sessionId of Array.from(sessions.keys())) {
    closeSession(sessionId, "server-shutdown")
  }
  server.close(() => {
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
