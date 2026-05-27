import test from "node:test"
import assert from "node:assert/strict"
import { PassThrough, Readable } from "node:stream"
import {
  HttpJsonRpcToolTransport,
  JsonRpcMcpToolClient,
  SseSessionJsonRpcToolTransport,
} from "../subprocess/service/execution/mcpToolClient"

function createInitializeResponse(id: number) {
  return {
    jsonrpc: "2.0" as const,
    id,
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
  }
}

function parseRequest(body: unknown): { id?: number; method?: string } {
  return body as { id?: number; method?: string }
}

test("json rpc tool client wraps tool call in tools/call envelope", async () => {
  let captured: unknown
  const client = new JsonRpcMcpToolClient({
    async send(request) {
      captured = request
      return { ok: true }
    },
    close() {},
  })

  const result = await client.call("openMenu", { menuShortCode: "3040" })

  assert.deepEqual(result, { ok: true })
  assert.deepEqual(captured, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "openMenu",
      arguments: {
        menuShortCode: "3040",
      },
    },
  })
})

test("sse session transport creates session then posts message with sessionId", async () => {
  const capturedRequests: Array<{ url: string; body?: string; method?: string }> = []
  const sseStream = new PassThrough()
  const client = {
    async get(url: string) {
      capturedRequests.push({
        url,
        method: "GET",
      })
      return {
        status: 200,
        headers: {
          "mcp-session-id": "session-123",
          "content-type": "text/event-stream",
        },
        data: sseStream,
        request: {
          res: {
            responseUrl: url,
          },
        },
      }
    },
    async post(url: string, body: unknown) {
      const request = parseRequest(body)
      capturedRequests.push({
        url,
        body: JSON.stringify(body),
        method: "POST",
      })

      if (request.method === "initialize" && typeof request.id === "number") {
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
          data: createInitializeResponse(request.id),
        }
      }

      setImmediate(() => {
        sseStream.write(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: { result: { content: [] } },
          })}\n\n`
        )
      })
      return {
        status: 202,
        headers: {
          "content-type": "application/json",
        },
        data: "",
      }
    },
  }

  const transport = new SseSessionJsonRpcToolTransport({
    baseUrl: "http://127.0.0.1:26666/mcp",
    client: client as never,
  })
  const response = await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "openMenu",
      arguments: { menuShortCode: "3040" },
    },
  })

  assert.equal(capturedRequests[0].url, "http://127.0.0.1:26666/api/mcp/sse")
  assert.equal(capturedRequests[0].method, "GET")
  assert.equal(
    capturedRequests.filter((item) => item.method === "POST").length >= 2,
    true
  )
  assert.equal(
    capturedRequests
      .filter((item) => item.method === "POST")
      .every((item) => item.url === "http://127.0.0.1:26666/api/mcp/message?sessionId=session-123"),
    true
  )
  assert.equal(
    capturedRequests.some((item) => item.body?.includes("\"method\":\"initialize\"")),
    true
  )
  assert.equal(
    capturedRequests.some((item) => item.body?.includes("\"method\":\"tools/call\"")),
    true
  )
  assert.deepEqual(response, { content: [], result: { content: [] } })
  transport.close()
})

test("sse session transport reuses sessionId across requests", async () => {
  const capturedUrls: string[] = []
  const sseStream = new PassThrough()
  const client = {
    async get(url: string) {
      capturedUrls.push(url)
      return {
        status: 200,
        headers: {
          "mcp-session-id": "session-reused",
          "content-type": "text/event-stream",
        },
        data: sseStream,
        request: {
          res: {
            responseUrl: url,
          },
        },
      }
    },
    async post(url: string, body: unknown) {
      capturedUrls.push(url)
      const request = parseRequest(body)
      if (request.method === "initialize" && typeof request.id === "number") {
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
          data: createInitializeResponse(request.id),
        }
      }
      setImmediate(() => {
        sseStream.write(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: { result: { content: [] } },
          })}\n\n`
        )
      })
      return {
        status: 202,
        headers: {
          "content-type": "application/json",
        },
        data: "",
      }
    },
  }

  const transport = new SseSessionJsonRpcToolTransport({
    baseUrl: "http://127.0.0.1:26666",
    client: client as never,
  })

  await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "openMenu",
      arguments: { menuShortCode: "3040" },
    },
  })

  await transport.send({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: {
      name: "executePageCommands",
      arguments: { tabId: "tab-1" },
    },
  })

  assert.equal(capturedUrls[0], "http://127.0.0.1:26666/api/mcp/sse")
  assert.equal(
    capturedUrls.slice(1).every((url) => url === "http://127.0.0.1:26666/api/mcp/message?sessionId=session-reused"),
    true
  )
  assert.equal(capturedUrls.length >= 3, true)
  transport.close()
})

test("sse session transport extracts sessionId from SSE endpoint event", async () => {
  const capturedRequests: Array<{ url: string; method: string }> = []
  const sseStream = new PassThrough()

  const client = {
    async get(url: string) {
      capturedRequests.push({ url, method: "GET" })
      // No sessionId in headers — server sends it via SSE endpoint event.
      setImmediate(() => {
        sseStream.write(
          `event: endpoint\ndata: /api/mcp/message?sessionId=sse-session-456\n\n`
        )
      })
      return {
        status: 200,
        headers: {
          "content-type": "text/event-stream",
        },
        data: sseStream,
        request: {
          res: { responseUrl: url },
        },
      }
    },
    async post(url: string, body: unknown) {
      capturedRequests.push({ url, method: "POST" })
      const request = parseRequest(body)
      if (request.method === "initialize" && typeof request.id === "number") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          data: createInitializeResponse(request.id),
        }
      }
      setImmediate(() => {
        sseStream.write(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: { content: [{ text: "ok" }] },
          })}\n\n`
        )
      })
      return {
        status: 202,
        headers: { "content-type": "application/json" },
        data: "",
      }
    },
  }

  const transport = new SseSessionJsonRpcToolTransport({
    baseUrl: "http://127.0.0.1:26666",
    client: client as never,
  })

  const response = await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "openMenu", arguments: { menuShortCode: "3040" } },
  })

  assert.equal(capturedRequests[0].method, "GET")
  assert.equal(
    capturedRequests[capturedRequests.length - 1].url,
    "http://127.0.0.1:26666/api/mcp/message?sessionId=sse-session-456"
  )
  assert.deepEqual(response, { content: [{ text: "ok" }] })
  transport.close()
})

test("sse session transport rejects send after close", async () => {
  const sseStream = new PassThrough()
  const client = {
    async get(url: string) {
      return {
        status: 200,
        headers: {
          "mcp-session-id": "session-close",
          "content-type": "text/event-stream",
        },
        data: sseStream,
        request: {
          res: { responseUrl: url },
        },
      }
    },
    async post(url: string, body: unknown) {
      const request = parseRequest(body)
      if (request.method === "initialize" && typeof request.id === "number") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          data: createInitializeResponse(request.id),
        }
      }
      setImmediate(() => {
        sseStream.write(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: { ok: true },
          })}\n\n`
        )
      })
      return {
        status: 202,
        headers: { "content-type": "application/json" },
        data: "",
      }
    },
  }

  const transport = new SseSessionJsonRpcToolTransport({
    baseUrl: "http://127.0.0.1:26666",
    client: client as never,
  })

  // First call succeeds — session is established.
  await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "openMenu", arguments: { menuShortCode: "3040" } },
  })

  // Close the transport.
  transport.close()

  // Subsequent send must reject.
  await assert.rejects(
    () =>
      transport.send({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "openMenu", arguments: { menuShortCode: "3040" } },
      }),
    { message: "MCP transport is closed" }
  )
})

test("sse session transport explicitly terminates the session on close", async () => {
  const capturedDeletes: Array<{ url: string; headers?: HeadersInit }> = []
  const sseStream = new PassThrough()
  const client = {
    async get(url: string) {
      return {
        status: 200,
        headers: {
          "mcp-session-id": "session-delete",
          "content-type": "text/event-stream",
        },
        data: sseStream,
        request: {
          res: { responseUrl: url },
        },
      }
    },
    async post(_url: string, body: unknown) {
      const request = parseRequest(body)
      if (request.method === "initialize" && typeof request.id === "number") {
        return {
          status: 200,
          headers: { "content-type": "application/json" },
          data: createInitializeResponse(request.id),
        }
      }

      setImmediate(() => {
        sseStream.write(
          `data: ${JSON.stringify({
            jsonrpc: "2.0",
            id: request.id,
            result: { ok: true },
          })}\n\n`
        )
      })
      return {
        status: 202,
        headers: { "content-type": "application/json" },
        data: "",
      }
    },
    async delete(url: string, headers?: HeadersInit) {
      capturedDeletes.push({ url, headers })
      return {
        status: 200,
        headers: { "content-type": "application/json" },
        data: { ok: true },
        request: {
          res: { responseUrl: url },
        },
      }
    },
  }

  const transport = new SseSessionJsonRpcToolTransport({
    baseUrl: "http://127.0.0.1:26666",
    client: client as never,
  })

  await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "openMenu", arguments: { menuShortCode: "3040" } },
  })

  transport.close()
  await new Promise<void>((resolve) => setImmediate(resolve))

  assert.equal(capturedDeletes.length, 1)
  assert.equal(
    capturedDeletes[0].url,
    "http://127.0.0.1:26666/api/mcp/sse?sessionId=session-delete"
  )

  const deleteHeaders = new Headers(capturedDeletes[0].headers)
  assert.equal(deleteHeaders.get("mcp-session-id"), "session-delete")
})

test("http transport export remains as compatibility alias", async () => {
  const transport = new HttpJsonRpcToolTransport("http://127.0.0.1:26666")
  assert.equal(transport instanceof SseSessionJsonRpcToolTransport, true)
})

test("sse session transport can still return immediate synchronous response bodies", async () => {
  const client = {
    async get(url: string) {
      return {
        status: 200,
        headers: {
          "mcp-session-id": "session-sync",
          "content-type": "text/event-stream",
        },
        data: Readable.from([]),
        request: {
          res: {
            responseUrl: url,
          },
        },
      }
    },
    async post(_url: string, body: unknown) {
      const request = parseRequest(body)
      if (request.method === "initialize" && typeof request.id === "number") {
        return {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
          data: createInitializeResponse(request.id),
        }
      }

      return {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
        data: {
          jsonrpc: "2.0",
          id: request.id,
          result: { ok: true },
        },
      }
    },
  }

  const transport = new SseSessionJsonRpcToolTransport({
    baseUrl: "http://127.0.0.1:26666",
    client: client as never,
  })

  const response = await transport.send({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "openMenu",
      arguments: { menuDescription: "3040" },
    },
  })

  assert.deepEqual(response, { content: [], ok: true })
  transport.close()
})
