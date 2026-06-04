import { SkillScriptEngineError } from "./skillScriptErrors"
import { getValueByPath } from "./skillScriptTemplate"

export interface SkillScriptExpressionEngine {
  run(expression: Record<string, unknown>, scopeValues: Record<string, unknown>): unknown
}

class BuiltinSkillScriptExpressionEngine implements SkillScriptExpressionEngine {
  run(expression: Record<string, unknown>, scopeValues: Record<string, unknown>): unknown {
    return evaluateExpression(expression, scopeValues)
  }
}

export function createDefaultSkillScriptExpressionEngine(): SkillScriptExpressionEngine {
  return new BuiltinSkillScriptExpressionEngine()
}

function evaluateExpression(input: unknown, scopeValues: Record<string, unknown>): unknown {
  if (
    input === null ||
    typeof input === "boolean" ||
    typeof input === "number" ||
    typeof input === "string"
  ) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) => evaluateExpression(item, scopeValues))
  }

  if (!isRecord(input)) {
    return input
  }

  const entries = Object.entries(input)
  if (entries.length !== 1) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", "表达式对象必须只包含一个操作符")
  }

  const [operator, rawArgs] = entries[0]
  switch (operator) {
    case "var":
      return evaluateVar(rawArgs, scopeValues)
    case "and":
      return evaluateAnd(rawArgs, scopeValues)
    case "or":
      return evaluateOr(rawArgs, scopeValues)
    case "!":
      return !toBoolean(evaluateSingleArg(operator, rawArgs, scopeValues))
    case "==":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left == right)
    case "===":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left === right)
    case "!=":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left != right)
    case "!==":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left !== right)
    case ">":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left > right)
    case ">=":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left >= right)
    case "<":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left < right)
    case "<=":
      return compareBinary(operator, rawArgs, scopeValues, (left, right) => left <= right)
    case "+":
      return evaluatePlus(rawArgs, scopeValues)
    case "-":
      return evaluateMinus(rawArgs, scopeValues)
    case "*":
      return evaluateNumericSequence(operator, rawArgs, scopeValues, 1, (total, value) => total * value)
    case "/":
      return evaluateDivision(rawArgs, scopeValues)
    case "%":
      return evaluateRemainder(rawArgs, scopeValues)
    case "cat":
      return readArgs(operator, rawArgs).map((item) => String(evaluateExpression(item, scopeValues))).join("")
    case "in":
      return evaluateIn(rawArgs, scopeValues)
    case "if":
      return evaluateIf(rawArgs, scopeValues)
    default:
      throw new SkillScriptEngineError(
        "INVALID_SCRIPT",
        `不支持的表达式操作符: ${operator}`
      )
  }
}

function evaluateVar(input: unknown, scopeValues: Record<string, unknown>): unknown {
  if (typeof input === "string") {
    return input.trim().length === 0 ? scopeValues : getValueByPath(scopeValues, input)
  }

  if (Array.isArray(input)) {
    const [pathInput, defaultValue] = input
    if (typeof pathInput !== "string" || pathInput.trim().length === 0) {
      return scopeValues
    }

    try {
      return getValueByPath(scopeValues, pathInput)
    } catch (error) {
      if (defaultValue !== undefined) {
        return evaluateExpression(defaultValue, scopeValues)
      }
      throw error
    }
  }

  throw new SkillScriptEngineError("INVALID_SCRIPT", "var 表达式格式无效")
}

function evaluateAnd(input: unknown, scopeValues: Record<string, unknown>): unknown {
  const args = readArgs("and", input)
  let lastValue: unknown = false
  for (const arg of args) {
    lastValue = evaluateExpression(arg, scopeValues)
    if (!toBoolean(lastValue)) {
      return lastValue
    }
  }
  return lastValue
}

function evaluateOr(input: unknown, scopeValues: Record<string, unknown>): unknown {
  const args = readArgs("or", input)
  let lastValue: unknown = false
  for (const arg of args) {
    lastValue = evaluateExpression(arg, scopeValues)
    if (toBoolean(lastValue)) {
      return lastValue
    }
  }
  return lastValue
}

function evaluateIf(input: unknown, scopeValues: Record<string, unknown>): unknown {
  const args = readArgs("if", input)
  if (args.length < 2) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", "if 表达式至少需要两个参数")
  }

  for (let index = 0; index < args.length - 1; index += 2) {
    const condition = evaluateExpression(args[index], scopeValues)
    if (toBoolean(condition)) {
      return evaluateExpression(args[index + 1], scopeValues)
    }
  }

  if (args.length % 2 === 1) {
    return evaluateExpression(args[args.length - 1], scopeValues)
  }

  return null
}

function evaluateIn(input: unknown, scopeValues: Record<string, unknown>): boolean {
  const [needle, haystack] = readBinaryArgs("in", input)
  const resolvedNeedle = evaluateExpression(needle, scopeValues)
  const resolvedHaystack = evaluateExpression(haystack, scopeValues)

  if (typeof resolvedHaystack === "string") {
    return resolvedHaystack.includes(String(resolvedNeedle))
  }

  if (Array.isArray(resolvedHaystack)) {
    return resolvedHaystack.some((item) => item === resolvedNeedle)
  }

  throw new SkillScriptEngineError("INVALID_SCRIPT", "in 表达式第二个参数必须是 string 或 array")
}

function evaluatePlus(input: unknown, scopeValues: Record<string, unknown>): number {
  const args = readArgs("+", input)
  return args.reduce<number>(
    (total, item) => total + toNumber(evaluateExpression(item, scopeValues), "+"),
    0
  )
}

function evaluateMinus(input: unknown, scopeValues: Record<string, unknown>): number {
  const args = readArgs("-", input)
  if (args.length === 0) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", "- 表达式至少需要一个参数")
  }

  const first = toNumber(evaluateExpression(args[0], scopeValues), "-")
  if (args.length === 1) {
    return -first
  }

  return args
    .slice(1)
    .reduce<number>(
      (total, item) => total - toNumber(evaluateExpression(item, scopeValues), "-"),
      first
    )
}

function evaluateDivision(input: unknown, scopeValues: Record<string, unknown>): number {
  const [left, right] = readBinaryArgs("/", input)
  const dividend = toNumber(evaluateExpression(left, scopeValues), "/")
  const divisor = toNumber(evaluateExpression(right, scopeValues), "/")
  return dividend / divisor
}

function evaluateRemainder(input: unknown, scopeValues: Record<string, unknown>): number {
  const [left, right] = readBinaryArgs("%", input)
  const dividend = toNumber(evaluateExpression(left, scopeValues), "%")
  const divisor = toNumber(evaluateExpression(right, scopeValues), "%")
  return dividend % divisor
}

function evaluateNumericSequence(
  operator: string,
  input: unknown,
  scopeValues: Record<string, unknown>,
  initialValue: number,
  iterate: (total: number, value: number) => number
): number {
  const args = readArgs(operator, input)
  if (args.length === 0) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", `${operator} 表达式至少需要一个参数`)
  }

  return args.reduce<number>(
    (total, item) => iterate(total, toNumber(evaluateExpression(item, scopeValues), operator)),
    initialValue
  )
}

function compareBinary(
  operator: string,
  input: unknown,
  scopeValues: Record<string, unknown>,
  compare: (left: any, right: any) => boolean
): boolean {
  const [left, right] = readBinaryArgs(operator, input)
  return compare(
    evaluateExpression(left, scopeValues),
    evaluateExpression(right, scopeValues)
  )
}

function evaluateSingleArg(
  operator: string,
  input: unknown,
  scopeValues: Record<string, unknown>
): unknown {
  const args = readArgs(operator, input)
  if (args.length !== 1) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", `${operator} 表达式必须只包含一个参数`)
  }
  return evaluateExpression(args[0], scopeValues)
}

function readBinaryArgs(operator: string, input: unknown): [unknown, unknown] {
  const args = readArgs(operator, input)
  if (args.length !== 2) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", `${operator} 表达式必须包含两个参数`)
  }
  return [args[0], args[1]]
}

function readArgs(operator: string, input: unknown): unknown[] {
  if (!Array.isArray(input)) {
    throw new SkillScriptEngineError("INVALID_SCRIPT", `${operator} 表达式参数必须是数组`)
  }
  return input
}

function toBoolean(input: unknown): boolean {
  return Boolean(input)
}

function toNumber(input: unknown, operator: string): number {
  if (typeof input === "number") {
    return input
  }

  if (typeof input === "string" && input.trim().length > 0) {
    const converted = Number(input)
    if (!Number.isNaN(converted)) {
      return converted
    }
  }

  throw new SkillScriptEngineError(
    "INVALID_SCRIPT",
    `${operator} 表达式参数必须可转换为 number`
  )
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}
