import { resolveArgs } from "./argResolver"
import type { SkillDefinition, SkillExecutionResult, SkillRuntimeContext } from "./types"
import type { ToolExecutor } from "../execution/toolExecutor"
import { ToolExecutionError } from "../execution/toolExecutionError"

export class SkillEngine {
  constructor(private readonly toolExecutor: ToolExecutor) {}

  async run(skill: SkillDefinition): Promise<SkillExecutionResult> {
    const runtime: SkillRuntimeContext = {
      values: {},
      lastToolResult: undefined,
    }

    for (const toolDefinition of skill.tools) {
      let resolvedArgs: Record<string, unknown>
      try {
        resolvedArgs = resolveArgs(toolDefinition.args, runtime.values) as Record<string, unknown>
      } catch {
        return {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: "参数引用解析失败",
          },
        }
      }

      try {
        const toolResult = await this.toolExecutor.execute(toolDefinition.tool, resolvedArgs)
        runtime.lastToolResult = toolResult
        if (toolDefinition.saveAs) {
          runtime.values[toolDefinition.saveAs] = toolResult
        }
      } catch (error) {
        if (error instanceof ToolExecutionError) {
          return {
            status: "failed",
            error: {
              code: error.code,
              message: error.message,
            },
          }
        }

        return {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: "执行过程中发生未预期异常",
          },
        }
      }
    }

    return {
      status: "completed",
      data: runtime.lastToolResult,
    }
  }
}

