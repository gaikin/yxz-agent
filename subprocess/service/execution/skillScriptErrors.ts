import type { SkillErrorCode } from "./skillScriptTypes"

export class SkillScriptEngineError extends Error {
  constructor(
    public readonly code: SkillErrorCode,
    message: string
  ) {
    super(message)
    this.name = "SkillScriptEngineError"
  }
}

export function toSkillScriptEngineError(error: unknown): SkillScriptEngineError {
  if (error instanceof SkillScriptEngineError) {
    return error
  }

  if (error instanceof Error) {
    return new SkillScriptEngineError("RUNTIME_EXCEPTION", error.message)
  }

  return new SkillScriptEngineError("RUNTIME_EXCEPTION", String(error))
}
