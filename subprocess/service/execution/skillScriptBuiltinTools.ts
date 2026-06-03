import type {
  SkillScriptBuiltinTool,
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
