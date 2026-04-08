import test from "node:test"
import assert from "node:assert/strict"
import {
  HttpJsonRpcToolTransport,
  JsonRpcMcpToolClient,
  SseSessionJsonRpcToolTransport,
} from "../dcf/execution/mcpToolClient"

test("json rpc tool client wraps tool call in tools/call envelope", async () => {
  let captured: unknown
  const client = new JsonRpcMcpToolClient({
    async send(request) {
      captured = request
      return { ok: true }
    },
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
  const originalFetch = globalThis.fetch
  const capturedRequests: Array<{ url: string; body?: string; method?: string }> = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    capturedRequests.push({
      url,
      body: typeof init?.body === "string" ? init.body : undefined,
      method: init?.method,
    })

    if (url.endsWith("/api/mcp/sse")) {
      return new Response(null, {
        status: 200,
        headers: {
          "mcp-session-id": "session-123",
          "content-type": "text/event-stream",
        },
      })
    }

    return new Response(JSON.stringify({ result: { content: [] } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }) as typeof fetch

  try {
    const transport = new SseSessionJsonRpcToolTransport("http://127.0.0.1:26666/mcp")
    const response = await transport.send({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "openMenu",
        arguments: { menuShortCode: "3040" },
      },
    })

    assert.equal(capturedRequests.length, 2)
    assert.equal(capturedRequests[0].url, "http://127.0.0.1:26666/api/mcp/sse")
    assert.equal(capturedRequests[0].method, "GET")
    assert.equal(
      capturedRequests[1].url,
      "http://127.0.0.1:26666/api/mcp/message?sessionId=session-123"
    )
    assert.ok(capturedRequests[1].body?.includes("\"method\":\"tools/call\""))
    assert.deepEqual(response, { result: { content: [] } })
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("sse session transport reuses sessionId across requests", async () => {
  const originalFetch = globalThis.fetch
  const capturedUrls: string[] = []

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    capturedUrls.push(url)

    if (url.endsWith("/api/mcp/sse")) {
      return new Response(JSON.stringify({ sessionId: "session-reused" }), {
        status: 200,
        headers: {
          "content-type": "application/json",
        },
      })
    }

    return new Response(JSON.stringify({ result: { content: [] } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }) as typeof fetch

  try {
    const transport = new SseSessionJsonRpcToolTransport("http://127.0.0.1:26666")

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

    assert.deepEqual(capturedUrls, [
      "http://127.0.0.1:26666/api/mcp/sse",
      "http://127.0.0.1:26666/api/mcp/message?sessionId=session-reused",
      "http://127.0.0.1:26666/api/mcp/message?sessionId=session-reused",
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("http transport export remains as compatibility alias", async () => {
  const transport = new HttpJsonRpcToolTransport("http://127.0.0.1:26666")
  assert.equal(transport instanceof SseSessionJsonRpcToolTransport, true)
})

