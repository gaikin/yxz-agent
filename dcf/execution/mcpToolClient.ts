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

export interface JsonRpcToolTransportFactory {
  create(): JsonRpcToolTransport
}

export interface SseSessionJsonRpcToolTransportOptions {
  baseUrl: string
  sessionPath?: string
  messagePath?: string
}

export class SseSessionJsonRpcToolTransport implements JsonRpcToolTransport {
  private sessionId?: string
  private sessionPromise?: Promise<string>
  private readonly baseUrl: string
  private readonly sessionPath: string
  private readonly messagePath: string

  constructor(options: string | SseSessionJsonRpcToolTransportOptions) {
    const normalizedOptions =
      typeof options === "string"
        ? {
            baseUrl: options,
          }
        : options

    this.baseUrl = this.normalizeBaseUrl(normalizedOptions.baseUrl)
    this.sessionPath = normalizedOptions.sessionPath ?? "/api/mcp/sse"
    this.messagePath = normalizedOptions.messagePath ?? "/api/mcp/message"
  }

  async send(request: JsonRpcToolCallRequest): Promise<unknown> {
    return this.sendWithRetry(request, false)
  }

  private async sendWithRetry(
    request: JsonRpcToolCallRequest,
    hasRetried: boolean
  ): Promise<unknown> {
    const sessionId = await this.getSessionId()
    const response = await fetch(this.createMessageUrl(sessionId), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(request),
    })

    if ((response.status === 404 || response.status === 410) && !hasRetried) {
      this.resetSession()
      return this.sendWithRetry(request, true)
    }

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status}`)
    }

    return response.json()
  }

  private async getSessionId(): Promise<string> {
    if (this.sessionId) {
      return this.sessionId
    }

    if (!this.sessionPromise) {
      this.sessionPromise = this.createSession()
    }

    this.sessionId = await this.sessionPromise
    return this.sessionId
  }

  private async createSession(): Promise<string> {
    const response = await fetch(this.createSessionUrl(), {
      method: "GET",
      headers: {
        accept: "text/event-stream, application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`MCP session creation failed: ${response.status}`)
    }

    const sessionId = await this.extractSessionId(response)
    await this.closeSessionResponse(response)
    if (!sessionId) {
      throw new Error("MCP session created but sessionId was not found")
    }
    return sessionId
  }

  private async extractSessionId(response: Response): Promise<string | undefined> {
    const headerSessionId =
      response.headers.get("mcp-session-id") ??
      response.headers.get("x-session-id") ??
      response.headers.get("session-id")
    if (headerSessionId) {
      return headerSessionId
    }

    const url = new URL(response.url || this.createSessionUrl())
    const urlSessionId = url.searchParams.get("sessionId") ?? url.searchParams.get("session_id")
    if (urlSessionId) {
      return urlSessionId
    }

    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as {
        sessionId?: string
        data?: { sessionId?: string }
      }
      return payload.sessionId ?? payload.data?.sessionId
    }

    return undefined
  }

  private createSessionUrl(): string {
    return new URL(this.sessionPath, this.baseUrl).toString()
  }

  private createMessageUrl(sessionId: string): string {
    const url = new URL(this.messagePath, this.baseUrl)
    url.searchParams.set("sessionId", sessionId)
    return url.toString()
  }

  private normalizeBaseUrl(input: string): string {
    const url = new URL(input)
    const normalizedPath = url.pathname.replace(/\/+$/, "")

    if (normalizedPath === "/mcp") {
      url.pathname = "/"
    } else if (normalizedPath.endsWith("/api/mcp")) {
      url.pathname = normalizedPath.slice(0, -"/api/mcp".length) || "/"
    }

    return url.toString()
  }

  private resetSession(): void {
    this.sessionId = undefined
    this.sessionPromise = undefined
  }

  private async closeSessionResponse(response: Response): Promise<void> {
    const contentType = response.headers.get("content-type") ?? ""
    if (contentType.includes("application/json")) {
      return
    }

    try {
      await response.body?.cancel()
    } catch {
      // Ignore stream cleanup errors after session establishment.
    }
  }
}

export { SseSessionJsonRpcToolTransport as HttpJsonRpcToolTransport }

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
