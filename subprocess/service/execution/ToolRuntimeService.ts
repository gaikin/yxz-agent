import type { SkillErrorCode } from "../SkillService"
import type { McpToolClient } from "./mcpToolClient"

export class ToolExecutionError extends Error {
  constructor(
    public readonly code: SkillErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ToolExecutionError"
  }
}

export interface RegisteredToolHandler {
  tool: string
  execute(args: Record<string, unknown>): Promise<unknown>
}

export class ToolHandlerRegistry {
  private readonly handlers = new Map<string, RegisteredToolHandler>()

  register(handler: RegisteredToolHandler): void {
    this.handlers.set(handler.tool, handler)
  }

  get(tool: string): RegisteredToolHandler | undefined {
    return this.handlers.get(tool)
  }
}

export interface ToolExecutor {
  execute(tool: string, args: Record<string, unknown>): Promise<unknown>
}

export class DefaultToolExecutor implements ToolExecutor {
  constructor(private readonly registry: ToolHandlerRegistry) {}

  async execute(tool: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = this.registry.get(tool)
    if (!handler) {
      throw new ToolExecutionError("RUNTIME_EXCEPTION", `Tool handler not found: ${tool}`)
    }

    return handler.execute(args)
  }
}

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
