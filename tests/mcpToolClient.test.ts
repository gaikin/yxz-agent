import test from "node:test"
import assert from "node:assert/strict"
import { HttpJsonRpcToolTransport, JsonRpcMcpToolClient } from "../dcf-subprocess/execution/mcpToolClient"

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

test("http json rpc tool transport posts request to configured mcp endpoint", async () => {
  const originalFetch = globalThis.fetch
  let capturedUrl: string | undefined
  let capturedBody: string | undefined

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input)
    capturedBody = String(init?.body ?? "")
    return new Response(JSON.stringify({ result: { content: [] } }), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    })
  }) as typeof fetch

  try {
    const transport = new HttpJsonRpcToolTransport("http://127.0.0.1:26666/mcp")
    const response = await transport.send({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "openMenu",
        arguments: { menuShortCode: "3040" },
      },
    })

    assert.equal(capturedUrl, "http://127.0.0.1:26666/mcp")
    assert.ok(capturedBody?.includes("\"method\":\"tools/call\""))
    assert.deepEqual(response, { result: { content: [] } })
  } finally {
    globalThis.fetch = originalFetch
  }
})
