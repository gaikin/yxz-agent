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

