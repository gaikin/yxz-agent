export interface JsonRpcToolCallRequest {
  jsonrpc: "2.0"
  id: number
  method: "tools/call"
  params: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface JsonRpcToolTransport {
  send(request: JsonRpcToolCallRequest): Promise<unknown>
}

export class HttpJsonRpcToolTransport implements JsonRpcToolTransport {
  constructor(private readonly endpoint: string) {}

  async send(request: JsonRpcToolCallRequest): Promise<unknown> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`)
    }

    return response.json()
  }
}

export interface McpToolClient {
  call(name: string, args: Record<string, unknown>): Promise<unknown>
}

export class JsonRpcMcpToolClient implements McpToolClient {
  private nextId = 1

  constructor(private readonly transport: JsonRpcToolTransport) {}

  async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    const request: JsonRpcToolCallRequest = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
    }

    return this.transport.send(request)
  }
}
