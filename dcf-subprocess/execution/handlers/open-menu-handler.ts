import type { McpToolClient } from "../mcp-tool-client"
import { ToolExecutionError } from "../tool-execution-error"
import type { RegisteredToolHandler } from "../tool-handler-registry"

export class OpenMenuHandler implements RegisteredToolHandler {
  readonly tool = "openMenu"

  constructor(private readonly mcpToolClient: McpToolClient) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const menuShortCode = args.menuShortCode
    if (typeof menuShortCode !== "string" || menuShortCode.length === 0) {
      throw new ToolExecutionError("MENU_OPEN_FAILED", "打开菜单失败")
    }

    try {
      return await this.mcpToolClient.call(this.tool, { menuShortCode })
    } catch (error) {
      if (error instanceof ToolExecutionError) {
        throw error
      }
      throw new ToolExecutionError("MENU_OPEN_FAILED", "打开菜单失败")
    }
  }
}

