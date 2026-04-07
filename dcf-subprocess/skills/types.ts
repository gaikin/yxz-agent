export type SkillErrorCode =
  | "MENU_OPEN_FAILED"
  | "SCHEMA_READ_FAILED"
  | "TARGET_NOT_FOUND"
  | "TARGET_NOT_UNIQUE"
  | "COMMAND_EXECUTION_FAILED"
  | "EXECUTION_BLOCKED"
  | "RUNTIME_EXCEPTION"

export type SkillExecutionResult =
  | {
      status: "completed"
      data?: unknown
    }
  | {
      status: "failed"
      error: {
        code: SkillErrorCode
        message: string
      }
    }
  | {
      status: "skipped"
      summary: string
    }

export interface SkillToolDefinition {
  toolId: string
  tool: string
  args: Record<string, unknown>
  saveAs?: string
}

export interface SkillDefinition {
  skillId: string
  name: string
  description?: string
  version: number
  tools: SkillToolDefinition[]
}

export interface SkillRuntimeContext {
  values: Record<string, unknown>
  lastToolResult?: unknown
}

