import type { SkillScriptExpressionEngine } from "./skillScriptExpressionEngine"

export type SkillErrorCode =
  | "MENU_OPEN_FAILED"
  | "SCHEMA_READ_FAILED"
  | "TARGET_NOT_FOUND"
  | "TARGET_NOT_UNIQUE"
  | "COMMAND_EXECUTION_FAILED"
  | "EXECUTION_BLOCKED"
  | "RUNTIME_EXCEPTION"
  | "INVALID_SCRIPT"
  | "VARIABLE_RESOLVE_FAILED"
  | "WHEN_EVALUATION_FAILED"
  | "FOREACH_ITEMS_INVALID"
  | "STEP_LIMIT_EXCEEDED"
  | "USER_CANCELED"
  | "UNSUPPORTED_EXECUTOR"
  | "BUILTIN_TOOL_NOT_FOUND"
  | "REQUEST_FAILED"

export interface SkillScriptExecutorDefinition {
  type: "mcp" | "builtin"
  mcpName?: string
  toolName: string
}

export interface SkillScriptToolStepDefinition {
  stepId: string
  type?: "tool"
  beforeDelayMs?: number
  output?: string
  executor: SkillScriptExecutorDefinition
  params: Record<string, unknown>
  when?: Record<string, unknown>
}

export interface SkillScriptGroupStepDefinition {
  stepId: string
  type: "group"
  when?: Record<string, unknown>
  steps: SkillScriptStepDefinition[]
}

export interface SkillScriptForeachStepDefinition {
  stepId: string
  type: "foreach"
  when?: Record<string, unknown>
  foreach: {
    items: Record<string, unknown>
    itemName?: string
    maxIterations: number
  }
  steps: SkillScriptStepDefinition[]
}

export type SkillScriptStepDefinition =
  | SkillScriptToolStepDefinition
  | SkillScriptGroupStepDefinition
  | SkillScriptForeachStepDefinition

export interface SkillScriptDefinition {
  skillId: string
  skillName: string
  menuCode: string
  skillVersion: string
  steps: SkillScriptStepDefinition[]
}

export type SkillDefinition = SkillScriptDefinition

export interface SkillExecutionError {
  code: SkillErrorCode
  message: string
}

export interface SkillStepExecutionRecord {
  stepId: string
  stepPath: string
  status: "completed" | "failed" | "skipped"
  executor?: SkillScriptExecutorDefinition
  beforeDelayMs?: number
  startedAt: string
  finishedAt: string
  durationMs: number
  outputName?: string
  result?: unknown
  error?: SkillExecutionError
  reason?: "WHEN_FALSE"
}

export type SkillExecutionResult =
  | {
      status: "completed"
      data?: unknown
      steps: SkillStepExecutionRecord[]
    }
  | {
      status: "failed"
      error: SkillExecutionError
      steps: SkillStepExecutionRecord[]
    }
  | {
      status: "skipped"
      summary: string
    }

export interface SkillScriptMcpToolClient {
  call(name: string, args: Record<string, unknown>): Promise<unknown>
}

export interface SkillScriptRuntimeEventMap {
  "execution.started": {
    type: "execution.started"
    skillId: string
    skillName: string
    skillVersion: string
  }
  "step.started": {
    type: "step.started"
    stepId: string
    stepPath: string
    beforeDelayMs?: number
  }
  "step.finished": {
    type: "step.finished"
    record: SkillStepExecutionRecord
  }
  "execution.finished": {
    type: "execution.finished"
    result: SkillExecutionResult
  }
}

export type SkillScriptRuntimeEvent =
  SkillScriptRuntimeEventMap[keyof SkillScriptRuntimeEventMap]

export interface SkillScriptRunOptions {
  event?: Record<string, unknown>
  signal?: AbortSignal
  onEvent?: (event: SkillScriptRuntimeEvent) => void | Promise<void>
}

export interface SkillScriptBuiltinContext {
  expressionEngine: SkillScriptExpressionEngine
  values: Record<string, unknown>
  getValue(path: string): unknown
  resolveExpression(expression: Record<string, unknown>): unknown
  resolveTemplateValue(input: unknown): unknown
  signal?: AbortSignal
}

export type SkillScriptBuiltinTool = (
  params: Record<string, unknown>,
  context: SkillScriptBuiltinContext
) => Promise<unknown>

export interface SkillScriptEngineOptions {
  mcpToolClient?: SkillScriptMcpToolClient
  builtinTools?: Record<string, SkillScriptBuiltinTool>
  fetchImpl?: typeof fetch
  now?: () => Date
  expressionEngine?: SkillScriptExpressionEngine
  maxControlDepth?: number
  maxExpandedStepCount?: number
}
