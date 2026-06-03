import type { RuntimeEventContext } from "../events/runtime-events"
import type { McpToolCallRawResult } from "./types"

export type McpNotification = {
  method?: string
  params?: unknown
}

export type McpExecutionRequest = {
  toolName: string
  input?: Record<string, unknown>
  context?: RuntimeEventContext
}

export type McpExecutor = (request: McpExecutionRequest) => Promise<McpToolCallRawResult>
export type McpNotificationListener = (notification: McpNotification) => void

export class AssistantMcpClient {
  private readonly listeners = new Set<McpNotificationListener>()

  constructor(private readonly executor?: McpExecutor) {}

  async executeTool(request: McpExecutionRequest): Promise<McpToolCallRawResult> {
    if (!this.executor) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `MCP tool "${request.toolName}" is not connected in the current migration stage.`,
          },
        ],
      }
    }

    return this.executor(request)
  }

  subscribeNotification(listener: McpNotificationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  publishNotification(notification: McpNotification): void {
    for (const listener of this.listeners) {
      listener(notification)
    }
  }
}
