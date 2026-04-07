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

