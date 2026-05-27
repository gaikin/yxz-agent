"use strict"

const axios = require("axios")

class AxiosSessionJsonRpcToolTransport {
  constructor(options) {
    const normalizedOptions =
      typeof options === "string"
        ? {
            baseUrl: options,
          }
        : options

    this.baseUrl = normalizeBaseUrl(normalizedOptions.baseUrl)
    this.sessionPath = normalizedOptions.sessionPath ?? "/api/mcp/sse"
    this.messagePath = normalizedOptions.messagePath ?? "/api/mcp/message"
    this.sessionId = undefined
    this.sessionPromise = undefined
    this.sessionResponse = undefined
    this.sseBuffer = ""
    this.pendingResponses = new Map()
    this.responseTimeoutMs = normalizedOptions.responseTimeoutMs ?? 15000
    this.client =
      normalizedOptions.client ??
      axios.create({
        timeout: 15000,
        validateStatus: () => true,
      })
  }

  async send(request) {
    return this.sendWithRetry(request, false, this.createPendingResponse(request.id))
  }

  async sendWithRetry(request, hasRetried, pendingResponse) {
    const sessionId = await this.getSessionId()
    console.log("[mcp] send request", {
      url: this.createMessageUrl(sessionId),
      sessionId,
      hasRetried,
      body: request,
    })
    const response = await this.client.post(this.createMessageUrl(sessionId), request, {
      headers: {
        "content-type": "application/json",
      },
    })
    console.log("[mcp] send response", {
      status: response.status,
      headers: response.headers,
      sessionId,
    })

    if ((response.status === 404 || response.status === 410) && !hasRetried) {
      console.log("[mcp] session invalid, reset and retry", {
        status: response.status,
        sessionId,
      })
      this.resetSession()
      return this.sendWithRetry(request, true, pendingResponse)
    }

    if (response.status < 200 || response.status >= 300) {
      this.clearPendingResponse(request.id)
      throw new Error(`MCP request failed: ${response.status}`)
    }

    if (this.shouldAwaitSseResponse(response.status, response.data)) {
      return pendingResponse.promise
    }

    this.resolvePendingResponse(request.id, response.data)
    return response.data
  }

  async getSessionId() {
    if (this.sessionId) {
      return this.sessionId
    }

    if (!this.sessionPromise) {
      this.sessionPromise = this.createSession()
    }

    this.sessionId = await this.sessionPromise
    return this.sessionId
  }

  async createSession() {
    console.log("[mcp] create session", {
      url: this.createSessionUrl(),
    })
    const response = await this.client.get(this.createSessionUrl(), {
      headers: {
        accept: "text/event-stream, application/json",
      },
      responseType: "stream",
    })
    console.log("[mcp] create session response", {
      status: response.status,
      headers: response.headers,
    })

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`MCP session creation failed: ${response.status}`)
    }

    const sessionId =
      readHeader(response, "mcp-session-id") ||
      readHeader(response, "x-session-id") ||
      readHeader(response, "session-id")

    if (sessionId) {
      console.log("[mcp] session established", {
        sessionId,
      })
      this.sessionResponse = response
      this.attachSseListeners(response)
      return sessionId
    }

    const contentType = readHeader(response, "content-type") || ""
    if (contentType.includes("application/json")) {
      const payload = response.data
      const payloadSessionId = payload?.sessionId || payload?.data?.sessionId
      if (payloadSessionId) {
        console.log("[mcp] session established", {
          sessionId: payloadSessionId,
        })
        this.sessionResponse = response
        return payloadSessionId
      }
    }

    destroyResponseStream(response)
    throw new Error("MCP session created but sessionId was not found")
  }

  createSessionUrl() {
    return new URL(this.sessionPath, this.baseUrl).toString()
  }

  createMessageUrl(sessionId) {
    const url = new URL(this.messagePath, this.baseUrl)
    url.searchParams.set("sessionId", sessionId)
    return url.toString()
  }

  resetSession() {
    destroyResponseStream(this.sessionResponse)
    this.rejectAllPendingResponses(new Error("MCP session was closed"))
    this.sessionId = undefined
    this.sessionPromise = undefined
    this.sessionResponse = undefined
    this.sseBuffer = ""
  }

  close() {
    this.resetSession()
  }

  attachSseListeners(response) {
    const contentType = readHeader(response, "content-type") || ""
    if (contentType.includes("application/json")) {
      return
    }

    const stream = response.data
    if (!stream || typeof stream.on !== "function") {
      return
    }

    stream.setEncoding?.("utf8")
    stream.on("data", (chunk) => {
      this.onSseChunk(typeof chunk === "string" ? chunk : chunk.toString("utf8"))
    })
    stream.on("end", () => {
      this.onSseClosed(new Error("MCP SSE stream ended"))
    })
    stream.on("error", (error) => {
      this.onSseClosed(error)
    })
  }

  onSseChunk(chunk) {
    this.sseBuffer += chunk
    const parts = this.sseBuffer.split(/\r?\n\r?\n/)
    this.sseBuffer = parts.pop() || ""

    for (const part of parts) {
      const payload = extractSseData(part)
      if (!payload) {
        continue
      }

      try {
        const parsed = JSON.parse(payload)
        if (typeof parsed.id !== "number") {
          continue
        }

        if (parsed.error) {
          this.rejectPendingResponse(
            parsed.id,
            new Error(parsed.error.message || "MCP SSE response returned error")
          )
          continue
        }

        this.resolvePendingResponse(parsed.id, parsed.result ?? parsed)
      } catch {
        // ignore heartbeat/non-json events
      }
    }
  }

  onSseClosed(error) {
    this.sessionId = undefined
    this.sessionPromise = undefined
    this.sessionResponse = undefined
    this.sseBuffer = ""
    this.rejectAllPendingResponses(error)
  }

  createPendingResponse(id) {
    const existing = this.pendingResponses.get(id)
    if (existing) {
      return existing
    }

    let resolveFn = () => {}
    let rejectFn = () => {}
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve
      rejectFn = reject
    })
    const timeout = setTimeout(() => {
      this.rejectPendingResponse(id, new Error(`MCP response timeout: ${id}`))
    }, this.responseTimeoutMs)

    const pending = {
      promise,
      resolve: resolveFn,
      reject: rejectFn,
      timeout,
    }
    this.pendingResponses.set(id, pending)
    return pending
  }

  resolvePendingResponse(id, value) {
    const pending = this.pendingResponses.get(id)
    if (!pending) {
      return
    }
    clearTimeout(pending.timeout)
    this.pendingResponses.delete(id)
    pending.resolve(value)
  }

  rejectPendingResponse(id, error) {
    const pending = this.pendingResponses.get(id)
    if (!pending) {
      return
    }
    clearTimeout(pending.timeout)
    this.pendingResponses.delete(id)
    pending.reject(error)
  }

  rejectAllPendingResponses(error) {
    for (const id of Array.from(this.pendingResponses.keys())) {
      this.rejectPendingResponse(id, error)
    }
  }

  clearPendingResponse(id) {
    const pending = this.pendingResponses.get(id)
    if (!pending) {
      return
    }
    clearTimeout(pending.timeout)
    this.pendingResponses.delete(id)
  }

  shouldAwaitSseResponse(status, data) {
    return status === 202 || data === undefined || data === null || data === ""
  }
}

class JsonRpcMcpToolClient {
  constructor(transport) {
    this.transport = transport
    this.nextId = 1
  }

  async call(name, args) {
    return this.transport.send({
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    })
  }
}

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

function readHeader(response, name) {
  const value = response.headers?.[name]
  if (Array.isArray(value)) {
    return value[0]
  }
  return typeof value === "string" ? value : undefined
}

function destroyResponseStream(response) {
  if (!response) {
    return
  }
  try {
    response.data?.destroy?.()
  } catch {
    // ignore
  }
}

function extractSseData(block) {
  const dataLines = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())

  if (dataLines.length === 0) {
    return undefined
  }

  return dataLines.join("\n")
}

module.exports = {
  AxiosSessionJsonRpcToolTransport,
  JsonRpcMcpToolClient,
}
