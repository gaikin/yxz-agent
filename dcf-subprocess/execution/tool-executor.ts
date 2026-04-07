import { ToolExecutionError } from "./tool-execution-error"
import { ToolHandlerRegistry } from "./tool-handler-registry"

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

