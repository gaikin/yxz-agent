import type { SkillErrorCode } from "../skills/types"

export class ToolExecutionError extends Error {
  constructor(
    public readonly code: SkillErrorCode,
    message: string
  ) {
    super(message)
    this.name = "ToolExecutionError"
  }
}

