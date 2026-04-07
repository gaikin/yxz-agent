import type { McpToolClient } from "../mcp-tool-client"
import { ToolExecutionError } from "../tool-execution-error"
import type { RegisteredToolHandler } from "../tool-handler-registry"

export class ExecutePageCommandsHandler implements RegisteredToolHandler {
  readonly tool = "executePageCommands"

  constructor(private readonly mcpToolClient: McpToolClient) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const tabId = args.tabId
    const commands = args.commands
    if (typeof tabId !== "string" || tabId.length === 0 || !Array.isArray(commands)) {
      throw new ToolExecutionError("COMMAND_EXECUTION_FAILED", "执行页面命令失败")
    }

    try {
      return await this.mcpToolClient.call(this.tool, { tabId, commands })
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error
      }
      throw new ToolExecutionError("COMMAND_EXECUTION_FAILED", "执行页面命令失败")
    }
  }
}

