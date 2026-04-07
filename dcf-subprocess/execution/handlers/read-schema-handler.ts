import type { McpToolClient } from "../mcp-tool-client"
import { ToolExecutionError } from "../tool-execution-error"
import type { RegisteredToolHandler } from "../tool-handler-registry"

export class ReadSchemaHandler implements RegisteredToolHandler {
  readonly tool = "readSchema"

  constructor(private readonly mcpToolClient: McpToolClient) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const tabId = args.tabId
    if (typeof tabId !== "string" || tabId.length === 0) {
      throw new ToolExecutionError("SCHEMA_READ_FAILED", "读取页面结构失败")
    }

    try {
      return await this.mcpToolClient.call(this.tool, { tabId })
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error
      }
      throw new ToolExecutionError("SCHEMA_READ_FAILED", "读取页面结构失败")
    }
  }
}

