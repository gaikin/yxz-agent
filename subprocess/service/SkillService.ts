import type { McpToolClient } from "./execution/mcpToolClient"

export type SkillErrorCode =
  | "MENU_OPEN_FAILED"
  | "SCHEMA_READ_FAILED"
  | "TARGET_NOT_FOUND"
  | "TARGET_NOT_UNIQUE"
  | "COMMAND_EXECUTION_FAILED"
  | "EXECUTION_BLOCKED"
  | "RUNTIME_EXCEPTION"

export interface SkillStepExecutionRecord {
  stepId: string
  action: string
  params: Record<string, unknown>
  status: "completed" | "failed"
  result?: unknown
  errorMessage?: string
}

export type SkillExecutionResult =
  | {
      status: "completed"
      data?: unknown
      steps: SkillStepExecutionRecord[]
    }
  | {
      status: "failed"
      error: {
        code: SkillErrorCode
        message: string
      }
      steps: SkillStepExecutionRecord[]
    }
  | {
      status: "skipped"
      summary: string
    }

export interface SkillStepDefinition {
  stepId: string
  action: string
  params: Record<string, unknown>
  saveAs?: string
}

export interface SkillDefinition {
  skillId: string
  name: string
  description?: string
  version: number
  steps: SkillStepDefinition[]
}

export interface SkillRuntimeContext {
  values: Record<string, unknown>
  lastToolResult?: unknown
  stepResults: SkillStepExecutionRecord[]
}

export const query3040TodaySkill: SkillDefinition = {
  skillId: "query_3040_today",
  name: "3040当日查询",
  description: "打开3040，点击查询，并直接返回最后一个工具结果",
  version: 1,
  steps: [
    {
      stepId: "open_menu",
      action: "openMenu",
      params: {
        menuShortCode: "3040",
      },
      saveAs: "tabInfo",
    },
    {
      stepId: "execute_query",
      action: "executePageCommands",
      params: {
        tabIdFrom: "tabInfo.tabId",
        commands: [
          {
            componentId: "btn_query_1",
            command: "click",
          },
        ],
      },
      saveAs: "queryResult",
    },
  ],
}

export function getByPath(values: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".")
  let current: unknown = values

  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      throw new Error(`Path not found: ${path}`)
    }

    current = (current as Record<string, unknown>)[segment]

    if (current === undefined) {
      throw new Error(`Path not found: ${path}`)
    }
  }

  return current
}

export function resolveArgs(input: unknown, values: Record<string, unknown>): unknown {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveArgs(item, values))
  }

  if (typeof input === "object") {
    const output: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(input)) {
      if (key.endsWith("From")) {
        const realKey = key.slice(0, -4)
        output[realKey] = getByPath(values, String(value))
      } else {
        output[key] = resolveArgs(value, values)
      }
    }

    return output
  }

  return input
}

export class DirectMcpSkillEngine {
  constructor(private readonly mcpToolClient: McpToolClient) {}

  async run(skill: SkillDefinition): Promise<SkillExecutionResult> {
    const runtime: SkillRuntimeContext = {
      values: {},
      lastToolResult: undefined,
      stepResults: [],
    }

    const steps = skill.steps
    if (steps.length === 0) {
      return {
        status: "failed",
        error: {
          code: "RUNTIME_EXCEPTION",
          message: "skill 未定义可执行 steps",
        },
        steps: runtime.stepResults,
      }
    }

    for (const step of steps) {
      let resolvedParams: Record<string, unknown>
      try {
        resolvedParams = resolveArgs(step.params, runtime.values) as Record<string, unknown>
      } catch {
        return {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: "参数引用解析失败",
          },
          steps: runtime.stepResults,
        }
      }

      try {
        const toolResult = await this.mcpToolClient.call(step.action, resolvedParams)
        runtime.stepResults.push({
          stepId: step.stepId,
          action: step.action,
          params: resolvedParams,
          status: "completed",
          result: toolResult,
        })
        runtime.lastToolResult = toolResult
        if (step.saveAs) {
          runtime.values[step.saveAs] = toolResult
        }
      } catch {
        runtime.stepResults.push({
          stepId: step.stepId,
          action: step.action,
          params: resolvedParams,
          status: "failed",
          errorMessage: "执行过程中发生未预期异常",
        })
        return {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: "执行过程中发生未预期异常",
          },
          steps: runtime.stepResults,
        }
      }
    }

    return {
      status: "completed",
      data: runtime.lastToolResult,
      steps: runtime.stepResults,
    }
  }
}
