import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js"
import {
  CompatibilityCallToolResultSchema,
  JSONRPCMessageSchema,
  type JSONRPCMessage,
  type RequestId,
} from "@modelcontextprotocol/sdk/types.js"
import { createParser, type EventSourceMessage } from "eventsource-parser"

export interface JsonRpcToolCallRequest {
  jsonrpc: "2.0"
  id: number
  method: "tools/call"
  params: {
    name: string
    arguments: Record<string, unknown>
  }
}

export interface JsonRpcReadResourceRequest {
  jsonrpc: "2.0"
  id: number
  method: "resources/read"
  params: {
    uri: string
  }
}

export type JsonRpcMcpRequest =
  | JsonRpcToolCallRequest
  | JsonRpcReadResourceRequest

export interface JsonRpcToolTransport {
  send(request: JsonRpcMcpRequest): Promise<unknown>
  close(): void
}

export interface JsonRpcToolTransportFactory {
  create(): JsonRpcToolTransport
}

export interface LegacyHttpClientResponse {
  status: number
  headers?: HeadersInit
  data?: unknown
  request?: {
    res?: {
      responseUrl?: string
    }
  }
}

export interface LegacyHttpClient {
  get(url: string): Promise<LegacyHttpClientResponse>
  post(url: string, body: unknown): Promise<LegacyHttpClientResponse>
  delete?(url: string, headers?: HeadersInit): Promise<LegacyHttpClientResponse>
}

export interface SseSessionJsonRpcToolTransportOptions {
  baseUrl: string
  sessionPath?: string
  messagePath?: string
  sessionClosePath?: string
  responseTimeoutMs?: number
  client?: LegacyHttpClient
}

type Deferred<T> = {
  promise: Promise<T>
  resolve(value: T): void
  reject(error: Error): void
  settled(): boolean
}

type SessionResponse = {
  status: number
  headers: Headers
  body?: unknown
  url: string
}

const MCP_CLIENT_INFO = {
  name: "yxz-agent-mcp-client",
  version: "0.1.0",
}

class LegacySseMcpSdkTransport implements Transport {
  sessionId?: string
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private closed = false
  private startPromise?: Promise<void>
  private sseBody?: unknown
  private messageUrl?: string
  private serverSessionId?: string
  private readonly baseUrl: string
  private readonly sessionPath: string
  private readonly defaultMessagePath: string
  private readonly sessionClosePath: string
  private readonly options: string | SseSessionJsonRpcToolTransportOptions

  constructor(
    options: string | SseSessionJsonRpcToolTransportOptions,
    private readonly onSdkError?: (error: Error) => void
  ) {
    this.options = options
    const normalizedOptions =
      typeof options === "string"
        ? { baseUrl: options }
        : options

    this.baseUrl = this.normalizeBaseUrl(normalizedOptions.baseUrl)
    this.sessionPath = normalizedOptions.sessionPath ?? "/api/mcp/sse"
    this.defaultMessagePath = normalizedOptions.messagePath ?? "/api/mcp/message"
    this.sessionClosePath = normalizedOptions.sessionClosePath ?? this.sessionPath
  }

  async start(): Promise<void> {
    if (this.closed) {
      throw new Error("MCP transport is closed")
    }
    if (this.startPromise) {
      return this.startPromise
    }

    this.startPromise = this.openSession().catch((error: Error) => {
      this.startPromise = undefined
      throw error
    })
    return this.startPromise
  }

  async send(message: JSONRPCMessage): Promise<void> {
    await this.sendWithRetry(message, false)
  }

  async close(): Promise<void> {
    if (this.closed) {
      return
    }

    this.closed = true
    await this.closeServerSession()
    await this.closeSseBody()
    this.messageUrl = undefined
    this.sessionId = undefined
    this.serverSessionId = undefined
    this.startPromise = undefined
    this.onclose?.()
  }

  private async openSession(): Promise<void> {
    const response = await this.openSessionResponse()
    if (response.status < 200 || response.status >= 300) {
      throw new Error("MCP session creation failed: " + response.status)
    }

    this.sseBody = response.body

    const deferred = createDeferred<void>()
    const sessionIdFromHeader = this.readSessionIdFromHeaders(response.headers)
    if (sessionIdFromHeader) {
      this.serverSessionId = sessionIdFromHeader
      this.messageUrl = this.createMessageUrl(sessionIdFromHeader)
      deferred.resolve(undefined)
    }

    if (response.body) {
      void this.consumeSse(response.body, deferred)
    } else if (!sessionIdFromHeader) {
      deferred.reject(new Error("MCP session created but SSE body was empty"))
    }

    await deferred.promise
  }

  private async sendWithRetry(message: JSONRPCMessage, hasRetried: boolean): Promise<void> {
    if (this.closed) {
      throw new Error("MCP transport is closed")
    }

    await this.start()
    const messageUrl = this.messageUrl
    if (!messageUrl) {
      throw new Error("MCP transport did not establish a message endpoint")
    }

    const response = await this.postMessage(messageUrl, message)
    if ((response.status === 404 || response.status === 410) && !hasRetried) {
      await this.resetSession()
      return this.sendWithRetry(message, true)
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error("MCP request failed: " + response.status)
    }

    if (response.status === 202) {
      return
    }

    const parsedBody = await this.readJsonBody(response.body)
    if (parsedBody === undefined) {
      return
    }

    const normalizedMessage = this.normalizeJsonRpcMessage(parsedBody, message)
    if (!normalizedMessage) {
      return
    }

    this.onmessage?.(normalizedMessage)
  }

  private async openSessionResponse(): Promise<SessionResponse> {
    const sessionUrl = this.createSessionUrl()
    const client = this.getLegacyClient()
    if (client) {
      const response = await client.get(sessionUrl)
      return {
        status: response.status,
        headers: new Headers(response.headers),
        body: response.data,
        url: response.request?.res?.responseUrl ?? sessionUrl,
      }
    }

    const response = await fetch(sessionUrl, {
      headers: {
        accept: "text/event-stream, application/json",
      },
    })

    return {
      status: response.status,
      headers: response.headers,
      body: response.body ?? undefined,
      url: response.url,
    }
  }

  private async postMessage(messageUrl: string, message: JSONRPCMessage): Promise<SessionResponse> {
    const client = this.getLegacyClient()
    if (client) {
      const response = await client.post(messageUrl, message)
      return {
        status: response.status,
        headers: new Headers(response.headers),
        body: response.data,
        url: response.request?.res?.responseUrl ?? messageUrl,
      }
    }

    const response = await fetch(messageUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(message),
    })

    return {
      status: response.status,
      headers: response.headers,
      body: response.body ?? undefined,
      url: response.url,
    }
  }

  private async closeServerSession(): Promise<void> {
    const sessionId =
      this.serverSessionId ??
      this.sessionId ??
      this.readSessionIdFromMessageUrl(this.messageUrl)
    if (!sessionId) {
      return
    }

    try {
      const response = await this.deleteSession(this.createSessionCloseUrl(sessionId), sessionId)
      if (
        response.status < 200 ||
        (response.status >= 300 &&
          response.status !== 404 &&
          response.status !== 405 &&
          response.status !== 410 &&
          response.status !== 501)
      ) {
        throw new Error("MCP session close failed: " + response.status)
      }
    } catch {
      // Ignore explicit close failures and fall back to tearing down the SSE stream.
    }
  }

  private async deleteSession(closeUrl: string, sessionId: string): Promise<SessionResponse> {
    const headers = this.createSessionCloseHeaders(sessionId)
    const client = this.getLegacyClient()
    if (client?.delete) {
      const response = await client.delete(closeUrl, headers)
      return {
        status: response.status,
        headers: new Headers(response.headers),
        body: response.data,
        url: response.request?.res?.responseUrl ?? closeUrl,
      }
    }

    const response = await fetch(closeUrl, {
      method: "DELETE",
      headers,
    })

    return {
      status: response.status,
      headers: response.headers,
      body: response.body ?? undefined,
      url: response.url,
    }
  }

  private getLegacyClient(): LegacyHttpClient | undefined {
    return typeof this.options === "string" ? undefined : this.options.client
  }

  private async consumeSse(body: unknown, deferred: Deferred<void>): Promise<void> {
    const parser = createParser({
      onEvent: (event) => {
        try {
          this.onSseEvent(event, deferred)
        } catch (error) {
          this.handleSseError(toError(error), deferred)
        }
      },
      onError: (error) => {
        this.handleSseError(
          new Error(error.message || "MCP SSE stream parsing failed"),
          deferred
        )
      },
    })

    try {
      await forEachTextChunk(body, (chunk) => {
        parser.feed(chunk)
      })
      this.handleSseClosed(new Error("MCP SSE stream closed"), deferred)
    } catch (error) {
      this.handleSseError(toError(error), deferred)
    }
  }

  private onSseEvent(event: EventSourceMessage, deferred: Deferred<void>): void {
    if (this.closed) {
      return
    }

    if (event.event === "endpoint") {
      const parsed = this.parseEndpointData(event.data)
      if (!parsed) {
        throw new Error("MCP session: cannot parse endpoint event data: " + event.data)
      }

      this.serverSessionId = parsed.sessionId
      this.messageUrl = parsed.messageUrl
      if (!deferred.settled()) {
        deferred.resolve(undefined)
      }
      return
    }

    const maybeEndpoint = !this.messageUrl ? this.parseEndpointData(event.data) : undefined
    if (maybeEndpoint) {
      this.serverSessionId = maybeEndpoint.sessionId
      this.messageUrl = maybeEndpoint.messageUrl
      if (!deferred.settled()) {
        deferred.resolve(undefined)
      }
      return
    }

    if (event.event === "close") {
      this.handleSseClosed(new Error("MCP SSE stream closed"), deferred)
      return
    }

    if (!event.data) {
      return
    }

    const parsedMessage = this.normalizeJsonRpcMessage(event.data)
    if (!parsedMessage) {
      return
    }

    if (!deferred.settled()) {
      deferred.resolve(undefined)
    }
    this.onmessage?.(parsedMessage)
  }

  private handleSseClosed(error: Error, deferred: Deferred<void>): void {
    if (!deferred.settled()) {
      deferred.reject(error)
      return
    }

    this.handleSseError(error, deferred)
  }

  private handleSseError(error: Error, deferred: Deferred<void>): void {
    if (this.closed) {
      return
    }

    if (!deferred.settled()) {
      deferred.reject(error)
    }
    this.onerror?.(error)
    this.onSdkError?.(error)
  }

  private normalizeJsonRpcMessage(
    input: unknown,
    relatedRequest?: JSONRPCMessage
  ): JSONRPCMessage | undefined {
    const parsed = this.parseJsonValue(input)
    if (parsed === undefined) {
      return undefined
    }

    const directMessage = this.tryParseJsonRpcMessage(parsed)
    if (directMessage) {
      return directMessage
    }

    const requestId = this.readRequestId(relatedRequest)
    if (requestId === undefined) {
      return undefined
    }

    const result =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : { value: parsed }

    return JSONRPCMessageSchema.parse({
      jsonrpc: "2.0",
      id: requestId,
      result,
    })
  }

  private parseJsonValue(input: unknown): unknown {
    if (typeof input === "string") {
      const trimmed = input.trim()
      if (!trimmed) {
        return undefined
      }

      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return undefined
      }
    }

    return input
  }

  private tryParseJsonRpcMessage(input: unknown): JSONRPCMessage | undefined {
    try {
      return JSONRPCMessageSchema.parse(input)
    } catch {
      return undefined
    }
  }

  private readRequestId(message: JSONRPCMessage | undefined): RequestId | undefined {
    if (!message || typeof message !== "object") {
      return undefined
    }

    const candidate = message as { id?: RequestId }
    if (typeof candidate.id === "string" || typeof candidate.id === "number") {
      return candidate.id
    }

    return undefined
  }

  private parseEndpointData(
    data: string
  ): { sessionId: string; messageUrl: string } | undefined {
    const trimmed = data.trim()
    try {
      const url = new URL(trimmed, this.baseUrl)
      const sessionId =
        url.searchParams.get("sessionId") ?? url.searchParams.get("session_id")
      if (sessionId) {
        return {
          sessionId,
          messageUrl: url.toString(),
        }
      }
    } catch {
      // Ignore invalid URL payloads and fall back to plain session ids.
    }

    if (trimmed.length > 0 && !trimmed.includes(" ")) {
      return {
        sessionId: trimmed,
        messageUrl: this.createMessageUrl(trimmed),
      }
    }

    return undefined
  }

  private readSessionIdFromMessageUrl(messageUrl: string | undefined): string | undefined {
    if (!messageUrl) {
      return undefined
    }

    try {
      const url = new URL(messageUrl, this.baseUrl)
      return url.searchParams.get("sessionId") ?? url.searchParams.get("session_id") ?? undefined
    } catch {
      return undefined
    }
  }

  private readSessionIdFromHeaders(headers: Headers): string | undefined {
    return (
      headers.get("mcp-session-id") ??
      headers.get("x-session-id") ??
      headers.get("session-id") ??
      undefined
    )
  }

  private async resetSession(): Promise<void> {
    await this.closeSseBody()
    this.sessionId = undefined
    this.serverSessionId = undefined
    this.messageUrl = undefined
    this.startPromise = undefined
  }

  setProtocolVersion(): void {
    this.sessionId = this.serverSessionId
  }

  private async closeSseBody(): Promise<void> {
    const body = this.sseBody
    this.sseBody = undefined

    if (!body) {
      return
    }

    try {
      if (
        typeof body === "object" &&
        body !== null &&
        "cancel" in body &&
        typeof (body as { cancel?: () => Promise<void> }).cancel === "function"
      ) {
        await (body as { cancel(): Promise<void> }).cancel()
        return
      }

      if (
        typeof body === "object" &&
        body !== null &&
        "destroy" in body &&
        typeof (body as { destroy?: () => void }).destroy === "function"
      ) {
        ;(body as { destroy(): void }).destroy()
      }
    } catch {
      // Ignore close failures while tearing down the session.
    }
  }

  private async readJsonBody(body: unknown): Promise<unknown> {
    if (body === undefined || body === null || body === "") {
      return undefined
    }

    if (typeof body === "object") {
      if (
        "getReader" in body &&
        typeof (body as { getReader?: () => unknown }).getReader === "function"
      ) {
        const text = await this.readBodyAsText(body)
        return text ? JSON.parse(text) : undefined
      }

      if (
        typeof (body as { on?: unknown }).on === "function" ||
        typeof (body as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function"
      ) {
        const text = await this.readBodyAsText(body)
        return text ? JSON.parse(text) : undefined
      }
    }

    if (typeof body === "string") {
      const trimmed = body.trim()
      return trimmed ? JSON.parse(trimmed) : undefined
    }

    return body
  }

  private async readBodyAsText(body: unknown): Promise<string> {
    const chunks: string[] = []
    await forEachTextChunk(body, (chunk) => {
      chunks.push(chunk)
    })
    return chunks.join("")
  }

  private createSessionUrl(): string {
    return new URL(this.sessionPath, this.baseUrl).toString()
  }

  private createMessageUrl(sessionId: string): string {
    const url = new URL(this.defaultMessagePath, this.baseUrl)
    url.searchParams.set("sessionId", sessionId)
    return url.toString()
  }

  private createSessionCloseUrl(sessionId: string): string {
    const url = new URL(this.sessionClosePath, this.baseUrl)
    url.searchParams.set("sessionId", sessionId)
    return url.toString()
  }

  private createSessionCloseHeaders(sessionId: string): HeadersInit {
    return {
      accept: "application/json, text/plain",
      "mcp-session-id": sessionId,
      "x-session-id": sessionId,
      "session-id": sessionId,
    }
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
}

export class SseSessionJsonRpcToolTransport implements JsonRpcToolTransport {
  private readonly options: string | SseSessionJsonRpcToolTransportOptions
  private readonly responseTimeoutMs: number
  private readonly sdkTransport: LegacySseMcpSdkTransport
  private sdkClient?: Client
  private connectPromise?: Promise<Client>
  private closed = false

  constructor(options: string | SseSessionJsonRpcToolTransportOptions) {
    this.options = options
    const normalizedOptions =
      typeof options === "string"
        ? { baseUrl: options }
        : options
    this.responseTimeoutMs = normalizedOptions.responseTimeoutMs ?? 30000
    this.sdkTransport = new LegacySseMcpSdkTransport(options, () => {
      this.connectPromise = undefined
      this.sdkClient = undefined
    })
  }

  async send(request: JsonRpcMcpRequest): Promise<unknown> {
    if (this.closed) {
      throw new Error("MCP transport is closed")
    }

    const client = await this.getSdkClient()
    if (request.method === "tools/call") {
      return this.withTimeout(
        client.callTool(
          {
            name: request.params.name,
            arguments: request.params.arguments,
          },
          CompatibilityCallToolResultSchema
        ),
        request.id
      )
    }

    if (request.method === "resources/read") {
      return this.withTimeout(
        client.readResource({
          uri: request.params.uri,
        }),
        request.id
      )
    }

    throw new Error("Unsupported MCP request method")
  }

  close(): void {
    if (this.closed) {
      return
    }

    this.closed = true
    const client = this.sdkClient
    const transport = this.sdkTransport
    this.sdkClient = undefined
    this.connectPromise = undefined

    if (client) {
      void client.close().catch(() => {})
      return
    }

    void transport.close().catch(() => {})
  }

  private async getSdkClient(): Promise<Client> {
    if (this.sdkClient) {
      return this.sdkClient
    }

    if (!this.connectPromise) {
      this.connectPromise = this.connectSdkClient()
    }

    return this.connectPromise
  }

  private async connectSdkClient(): Promise<Client> {
    const client = new Client(MCP_CLIENT_INFO)
    try {
      await client.connect(this.sdkTransport)
      this.sdkClient = client
      return client
    } catch (error) {
      this.connectPromise = undefined
      this.sdkClient = undefined
      await this.sdkTransport.close().catch(() => {})
      throw toError(error)
    }
  }

  private withTimeout<T>(promise: Promise<T>, requestId: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("MCP response timeout: " + requestId))
      }, this.responseTimeoutMs)

      promise.then(
        (value) => {
          clearTimeout(timeout)
          resolve(value)
        },
        (error) => {
          clearTimeout(timeout)
          reject(error)
        }
      )
    })
  }
}

export { SseSessionJsonRpcToolTransport as HttpJsonRpcToolTransport }

export interface McpToolClient {
  call(name: string, args: Record<string, unknown>): Promise<unknown>
  callTool(name: string, args: Record<string, unknown>): Promise<unknown>
  readResource(uri: string): Promise<unknown>
}

export class JsonRpcMcpToolClient implements McpToolClient {
  private nextId = 1

  constructor(private readonly transport: JsonRpcToolTransport) {}

  call(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.callTool(name, args)
  }

  callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const request: JsonRpcToolCallRequest = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "tools/call",
      params: {
        name: name,
        arguments: args,
      },
    }

    return this.transport.send(request)
  }

  readResource(uri: string): Promise<unknown> {
    const request: JsonRpcReadResourceRequest = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method: "resources/read",
      params: {
        uri,
      },
    }

    return this.transport.send(request)
  }
}

function createDeferred<T>(): Deferred<T> {
  let settled = false
  let resolveFn: (value: T) => void = () => {}
  let rejectFn: (error: Error) => void = () => {}

  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = (value) => {
      if (settled) {
        return
      }
      settled = true
      resolve(value)
    }
    rejectFn = (error) => {
      if (settled) {
        return
      }
      settled = true
      reject(error)
    }
  })

  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    settled() {
      return settled
    },
  }
}

async function forEachTextChunk(
  body: unknown,
  onChunk: (chunk: string) => void
): Promise<void> {
  if (!body) {
    return
  }

  if (
    typeof body === "object" &&
    body !== null &&
    "getReader" in body &&
    typeof (body as { getReader?: () => unknown }).getReader === "function"
  ) {
    const reader = (body as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    try {
      while (true) {
        const result = await reader.read()
        if (result.done) {
          break
        }
        if (result.value) {
          onChunk(decoder.decode(result.value, { stream: true }))
        }
      }
      const rest = decoder.decode()
      if (rest) {
        onChunk(rest)
      }
    } finally {
      reader.releaseLock()
    }
    return
  }

  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function"
  ) {
    const decoder = new TextDecoder()
    for await (const chunk of body as AsyncIterable<unknown>) {
      onChunk(decodeChunk(chunk, decoder))
    }
    const rest = decoder.decode()
    if (rest) {
      onChunk(rest)
    }
    return
  }

  if (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { on?: unknown }).on === "function"
  ) {
    const decoder = new TextDecoder()
    await new Promise<void>((resolve, reject) => {
      const stream = body as {
        on(event: string, handler: (...args: unknown[]) => void): void
      }

      stream.on("data", (chunk: unknown) => {
        onChunk(decodeChunk(chunk, decoder))
      })
      stream.on("end", () => {
        const rest = decoder.decode()
        if (rest) {
          onChunk(rest)
        }
        resolve()
      })
      stream.on("error", (error: unknown) => {
        reject(toError(error))
      })
    })
    return
  }

  if (typeof body === "string") {
    onChunk(body)
  }
}

function decodeChunk(chunk: unknown, decoder: TextDecoder): string {
  if (typeof chunk === "string") {
    return chunk
  }

  if (chunk instanceof Uint8Array) {
    return decoder.decode(chunk, { stream: true })
  }

  if (ArrayBuffer.isView(chunk)) {
    return decoder.decode(
      new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
      { stream: true }
    )
  }

  if (chunk instanceof ArrayBuffer) {
    return decoder.decode(new Uint8Array(chunk), { stream: true })
  }

  return String(chunk)
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}
