import type {
  SkillScriptDefinition,
  SkillScriptExecutorDefinition,
} from "./skillScriptTypes"

const stepIdPattern = /^[a-z][A-Za-z0-9]*$/
const outputNamePattern = /^[a-z][A-Za-z0-9]*$/
const reservedOutputNames = new Set(["event", "steps", "item", "index"])

export function assertSkillScriptDefinition(
  input: unknown,
  source = "skill"
): asserts input is SkillScriptDefinition {
  if (!isRecord(input)) {
    throw new Error(`Invalid skill json: ${source}`)
  }

  const skillId = readNonEmptyString(input.skillId, `${source}.skillId`)
  readNonEmptyString(input.skillName, `${source}.skillName`)
  readNonEmptyString(input.menuCode, `${source}.menuCode`)
  readNonEmptyString(input.skillVersion, `${source}.skillVersion`)

  if (!Array.isArray(input.steps) || input.steps.length === 0) {
    throw new Error(`Skill must define non-empty steps in ${source}`)
  }

  const stepIds = new Set<string>()
  const outputNames = new Set<string>()
  validateSteps(input.steps, source, stepIds, outputNames)

  if (skillId.length === 0) {
    throw new Error(`Invalid skillId in ${source}`)
  }
}

function validateSteps(
  steps: unknown[],
  source: string,
  stepIds: Set<string>,
  outputNames: Set<string>
): void {
  for (const [index, rawStep] of steps.entries()) {
    const stepSource = `${source}.steps[${index}]`
    if (!isRecord(rawStep)) {
      throw new Error(`Invalid step in ${stepSource}`)
    }

    const stepId = readNonEmptyString(rawStep.stepId, `${stepSource}.stepId`)
    if (!stepIdPattern.test(stepId)) {
      throw new Error(`Invalid stepId in ${stepSource}`)
    }
    if (stepIds.has(stepId)) {
      throw new Error(`Duplicated stepId in ${stepSource}: ${stepId}`)
    }
    stepIds.add(stepId)

    const type = rawStep.type
    if (type === undefined || type === "tool") {
      readExecutor(rawStep.executor, stepSource)
      readRecord(rawStep.params, `${stepSource}.params`)
      if (rawStep.beforeDelayMs !== undefined) {
        readNonNegativeInteger(rawStep.beforeDelayMs, `${stepSource}.beforeDelayMs`)
      }
      if (rawStep.output !== undefined) {
        const outputName = readNonEmptyString(rawStep.output, `${stepSource}.output`)
        if (!outputNamePattern.test(outputName)) {
          throw new Error(`Invalid output in ${stepSource}`)
        }
        if (outputName.startsWith("$") || outputName.startsWith("_")) {
          throw new Error(`Invalid output in ${stepSource}`)
        }
        if (reservedOutputNames.has(outputName)) {
          throw new Error(`Reserved output in ${stepSource}: ${outputName}`)
        }
        if (outputNames.has(outputName)) {
          throw new Error(`Duplicated output in ${stepSource}: ${outputName}`)
        }
        outputNames.add(outputName)
      }
      continue
    }

    if (type === "group") {
      if (!Array.isArray(rawStep.steps) || rawStep.steps.length === 0) {
        throw new Error(`Group step must define non-empty steps in ${stepSource}`)
      }
      validateSteps(rawStep.steps, stepSource, stepIds, outputNames)
      continue
    }

    if (type === "foreach") {
      const foreach = readRecord(rawStep.foreach, `${stepSource}.foreach`)
      readRecord(foreach.items, `${stepSource}.foreach.items`)
      readNonNegativeInteger(foreach.maxIterations, `${stepSource}.foreach.maxIterations`)
      if (foreach.itemName !== undefined) {
        const itemName = readNonEmptyString(foreach.itemName, `${stepSource}.foreach.itemName`)
        if (!stepIdPattern.test(itemName)) {
          throw new Error(`Invalid foreach.itemName in ${stepSource}`)
        }
      }
      if (!Array.isArray(rawStep.steps) || rawStep.steps.length === 0) {
        throw new Error(`Foreach step must define non-empty steps in ${stepSource}`)
      }
      validateSteps(rawStep.steps, stepSource, stepIds, outputNames)
      continue
    }

    throw new Error(`Unsupported step type in ${stepSource}`)
  }
}

function readExecutor(input: unknown, source: string): SkillScriptExecutorDefinition {
  const executor = readRecord(input, `${source}.executor`)
  const type = readNonEmptyString(executor.type, `${source}.executor.type`)
  const toolName = readNonEmptyString(executor.toolName, `${source}.executor.toolName`)

  if (type !== "mcp" && type !== "builtin") {
    throw new Error(`Unsupported executor type in ${source}`)
  }

  if (type === "mcp") {
    readNonEmptyString(executor.mcpName, `${source}.executor.mcpName`)
  }

  return {
    type,
    toolName,
    mcpName: typeof executor.mcpName === "string" ? executor.mcpName : undefined,
  }
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}

function readRecord(input: unknown, source: string): Record<string, unknown> {
  if (!isRecord(input)) {
    throw new Error(`Invalid object in ${source}`)
  }
  return input
}

function readNonEmptyString(input: unknown, source: string): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(`Invalid string in ${source}`)
  }
  return input
}

function readNonNegativeInteger(input: unknown, source: string): number {
  if (typeof input !== "number" || !Number.isInteger(input) || input < 0) {
    throw new Error(`Invalid integer in ${source}`)
  }
  return input
}
