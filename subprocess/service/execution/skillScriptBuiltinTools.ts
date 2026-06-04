import type {
  SkillScriptBuiltinTool,
  SkillScriptBuiltinContext,
  SkillScriptEngineOptions,
} from "./skillScriptTypes"
import { SkillScriptEngineError } from "./skillScriptErrors"

export function createSkillScriptBuiltinTools(
  options: Pick<SkillScriptEngineOptions, "builtinTools" | "fetchImpl">
): Record<string, SkillScriptBuiltinTool> {
  return {
    evaluate: async (params, context) => {
      const expression = readRecord(params.expression, "evaluate.expression")
      return context.resolveExpression(expression)
    },
    script: async (params, context) => {
      if (typeof params.script !== "string") {
        throw new SkillScriptEngineError(
          "INVALID_SCRIPT",
          "script 内置工具需要提供 params.script"
        )
      }

      const scriptParams = omitKeys(params, ["script"])
      const readonlyContext = createReadonlyScriptContext(context)
      const scriptSource = readNonEmptyString(params.script, "script.script")
      const scriptRunner = compileScriptBody(scriptSource)
      const result = scriptRunner(
        createScriptBindings(scriptParams, readonlyContext)
      )
      return Promise.resolve(result)
    },
    request: async (params, context) => {
      const method = readRequestMethod(params.method)
      const url = readNonEmptyString(params.url, "request.url")
      const headers = readOptionalRecord(params.headers, "request.headers")
      const body = params.body

      const response = await (options.fetchImpl ?? fetch)(url, {
        method,
        headers: headers as HeadersInit | undefined,
        body:
          method === "POST" && body !== undefined
            ? JSON.stringify(body)
            : undefined,
        signal: context.signal,
      })

      if (!response.ok) {
        throw new SkillScriptEngineError("REQUEST_FAILED", `请求失败: ${response.status}`)
      }

      if (response.status === 204) {
        return null
      }

      const contentType = response.headers.get("content-type") ?? ""
      if (contentType.includes("application/json")) {
        return response.json()
      }

      return response.text()
    },
    wait: async (params, context) => {
      const durationMs = readNonNegativeInteger(params.durationMs, "wait.durationMs")
      await waitForDelay(durationMs, context.signal)
      return null
    },
    ...options.builtinTools,
  }
}

type ScriptBuiltinBodyRunner = (
  bindings: Record<string, unknown>
) => unknown | Promise<unknown>

function compileScriptBody(source: string): ScriptBuiltinBodyRunner {
  try {
    return (bindings) => {
      const names = Object.keys(bindings)
      const values = Object.values(bindings)
      const compiled = Function(...names, `"use strict";\n${source}`) as (
        ...args: unknown[]
      ) => unknown
      return compiled(...values)
    }
  } catch (error) {
    throw new SkillScriptEngineError(
      "INVALID_SCRIPT",
      error instanceof Error
        ? `script.script 编译失败: ${error.message}`
        : "script.script 编译失败"
    )
  }
}

function createReadonlyScriptContext(
  context: SkillScriptBuiltinContext
): Readonly<SkillScriptBuiltinContext> {
  return Object.freeze({
    expressionEngine: context.expressionEngine,
    values: context.values,
    getValue: context.getValue,
    resolveExpression: context.resolveExpression,
    resolveTemplateValue: context.resolveTemplateValue,
    signal: context.signal,
  })
}

function createScriptBindings(
  scriptParams: Record<string, unknown>,
  context: Readonly<SkillScriptBuiltinContext>
): Record<string, unknown> {
  const bindings: Record<string, unknown> = {
    params: Object.freeze({ ...scriptParams }),
    ctx: context,
    values: context.values,
    event: context.values.$_EVENT,
    getValue: context.getValue,
    resolveExpression: context.resolveExpression,
    resolveTemplateValue: context.resolveTemplateValue,
    signal: context.signal,
  }

  for (const [key, value] of Object.entries(context.values)) {
    if (isSafeIdentifier(key) && !Object.hasOwn(bindings, key)) {
      bindings[key] = value
    }
  }

  for (const [key, value] of Object.entries(scriptParams)) {
    if (isSafeIdentifier(key)) {
      bindings[key] = value
    }
  }

  return Object.freeze(bindings)
}

function readRequestMethod(input: unknown): "GET" | "POST" {
  const method = readNonEmptyString(input, "request.method").toUpperCase()
  if (method !== "GET" && method !== "POST") {
    throw new SkillScriptEngineError("INVALID_SCRIPT", `不支持的请求方法: ${method}`)
  }
  return method
}

function readOptionalRecord(
  input: unknown,
  source: string
): Record<string, unknown> | undefined {
  if (input === undefined) {
    return undefined
  }
  return readRecord(input, source)
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

function omitKeys(
  input: Record<string, unknown>,
  keys: string[]
): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!keys.includes(key)) {
      output[key] = value
    }
  }
  return output
}

function isSafeIdentifier(input: string): boolean {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(input)
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}

async function waitForDelay(durationMs: number, signal: AbortSignal | undefined): Promise<void> {
  ensureNotAborted(signal)
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, durationMs)

    const onAbort = () => {
      clearTimeout(timer)
      cleanup()
      reject(new SkillScriptEngineError("USER_CANCELED", "用户已中止当前任务"))
    }

    const cleanup = () => {
      signal?.removeEventListener("abort", onAbort)
    }

    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function ensureNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new SkillScriptEngineError("USER_CANCELED", "用户已中止当前任务")
  }
}
