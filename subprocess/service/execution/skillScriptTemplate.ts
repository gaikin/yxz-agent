import { SkillScriptEngineError } from "./skillScriptErrors"

const templatePattern = /{{\s*([^{}]+?)\s*}}/g

export function getValueByPath(values: Record<string, unknown>, pathText: string): unknown {
  const path = pathText.trim()
  if (!path) {
    return values
  }

  const segments = path.split(".")
  let current: unknown = values

  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      throw new SkillScriptEngineError("VARIABLE_RESOLVE_FAILED", `变量不存在: ${pathText}`)
    }

    current = (current as Record<string, unknown>)[segment]
    if (current === undefined) {
      throw new SkillScriptEngineError("VARIABLE_RESOLVE_FAILED", `变量不存在: ${pathText}`)
    }
  }

  return current
}

export function resolveTemplateValue(
  input: unknown,
  values: Record<string, unknown>
): unknown {
  if (input === null || typeof input === "number" || typeof input === "boolean") {
    return input
  }

  if (typeof input === "string") {
    return resolveTemplateString(input, values)
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveTemplateValue(item, values))
  }

  if (isRecord(input)) {
    const output: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(input)) {
      output[key] = resolveTemplateValue(value, values)
    }
    return output
  }

  return input
}

export function resolveTemplateString(
  input: string,
  values: Record<string, unknown>
): unknown {
  const matches = [...input.matchAll(templatePattern)]
  if (matches.length === 0) {
    return input
  }

  if (matches.length === 1 && matches[0][0].length === input.length) {
    return getValueByPath(values, matches[0][1].trim())
  }

  return input.replace(templatePattern, (_token, variablePath: string) => {
    const resolved = getValueByPath(values, variablePath.trim())
    return String(resolved)
  })
}

export function assertJsonLogicVariablesResolvable(
  input: unknown,
  scopeValues: Record<string, unknown>
): void {
  if (Array.isArray(input)) {
    for (const item of input) {
      assertJsonLogicVariablesResolvable(item, scopeValues)
    }
    return
  }

  if (!isRecord(input)) {
    return
  }

  if (Object.keys(input).length === 1 && Object.hasOwn(input, "var")) {
    const variableInput = input.var
    const variablePath = Array.isArray(variableInput) ? variableInput[0] : variableInput
    if (typeof variablePath === "string" && variablePath.trim().length > 0) {
      getValueByPath(scopeValues, variablePath.trim())
    }
    return
  }

  for (const value of Object.values(input)) {
    assertJsonLogicVariablesResolvable(value, scopeValues)
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}
