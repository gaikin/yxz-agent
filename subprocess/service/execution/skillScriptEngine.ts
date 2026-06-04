import { createSkillScriptBuiltinTools } from "./skillScriptBuiltinTools"
import {
  createDefaultSkillScriptExpressionEngine,
  type SkillScriptExpressionEngine,
} from "./skillScriptExpressionEngine"
import {
  SkillScriptEngineError,
  toSkillScriptEngineError,
} from "./skillScriptErrors"
import { query3040TodaySkill } from "./skillScriptExamples"
import {
  assertJsonLogicVariablesResolvable,
  getValueByPath,
  resolveTemplateString,
  resolveTemplateValue,
} from "./skillScriptTemplate"
import type {
  SkillDefinition,
  SkillExecutionError,
  SkillExecutionResult,
  SkillScriptDefinition,
  SkillScriptEngineOptions,
  SkillScriptExecutorDefinition,
  SkillScriptForeachStepDefinition,
  SkillScriptGroupStepDefinition,
  SkillScriptMcpToolClient,
  SkillScriptRunOptions,
  SkillScriptStepDefinition,
  SkillScriptToolStepDefinition,
  SkillStepExecutionRecord,
} from "./skillScriptTypes"
import { assertSkillScriptDefinition } from "./skillScriptValidator"

const defaultMaxControlDepth = 3
const defaultMaxExpandedStepCount = 200

type SkillScriptRuntimeState = {
  readonly values: Record<string, unknown>
  readonly stepResults: SkillStepExecutionRecord[]
  lastToolResult?: unknown
  expandedStepCount: number
}

type StepExecutionContext = {
  readonly depth: number
  readonly pathPrefix?: string
  readonly scopeValues: Record<string, unknown>
}

type StepLifecycleState = {
  readonly stepPath: string
  readonly startedAt: Date
}

export class SkillScriptEngine {
  private readonly expressionEngine: SkillScriptExpressionEngine
  private readonly now: () => Date
  private readonly maxControlDepth: number
  private readonly maxExpandedStepCount: number
  private readonly builtinTools: ReturnType<typeof createSkillScriptBuiltinTools>

  constructor(private readonly options: SkillScriptEngineOptions) {
    this.expressionEngine =
      options.expressionEngine ?? createDefaultSkillScriptExpressionEngine()
    this.now = options.now ?? (() => new Date())
    this.maxControlDepth = options.maxControlDepth ?? defaultMaxControlDepth
    this.maxExpandedStepCount =
      options.maxExpandedStepCount ?? defaultMaxExpandedStepCount
    this.builtinTools = createSkillScriptBuiltinTools(options)
  }

  async run(
    skill: SkillScriptDefinition,
    runOptions: SkillScriptRunOptions = {}
  ): Promise<SkillExecutionResult> {
    assertSkillScriptDefinition(skill)

    const runtime: SkillScriptRuntimeState = {
      values: runOptions.event ? { $_EVENT: runOptions.event } : {},
      stepResults: [],
      lastToolResult: undefined,
      expandedStepCount: 0,
    }

    await runOptions.onEvent?.({
      type: "execution.started",
      skillId: skill.skillId,
      skillName: skill.skillName,
      skillVersion: skill.skillVersion,
    })

    try {
      await this.executeSteps(skill.steps, runtime, runOptions, {
        depth: 1,
        scopeValues: runtime.values,
      })

      const result: SkillExecutionResult = {
        status: "completed",
        data: runtime.lastToolResult,
        steps: runtime.stepResults,
      }

      await runOptions.onEvent?.({
        type: "execution.finished",
        result,
      })

      return result
    } catch (error) {
      const engineError = toSkillScriptEngineError(error)
      const result: SkillExecutionResult = {
        status: "failed",
        error: {
          code: engineError.code,
          message: engineError.message,
        },
        steps: runtime.stepResults,
      }

      await runOptions.onEvent?.({
        type: "execution.finished",
        result,
      })

      return result
    }
  }

  private async executeSteps(
    steps: SkillScriptStepDefinition[],
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step, runtime, runOptions, context)
    }
  }

  private async executeStep(
    step: SkillScriptStepDefinition,
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext
  ): Promise<void> {
    if (context.depth > this.maxControlDepth) {
      throw new SkillScriptEngineError(
        "INVALID_SCRIPT",
        `控制流嵌套层级超过限制: ${step.stepId}`
      )
    }

    runtime.expandedStepCount += 1
    if (runtime.expandedStepCount > this.maxExpandedStepCount) {
      throw new SkillScriptEngineError(
        "STEP_LIMIT_EXCEEDED",
        `展开后步骤数超过限制: ${this.maxExpandedStepCount}`
      )
    }

    if (isForeachStep(step)) {
      await this.executeForeachStep(step, runtime, runOptions, context)
      return
    }

    if (isGroupStep(step)) {
      await this.executeGroupStep(step, runtime, runOptions, context)
      return
    }

    await this.executeToolStep(step, runtime, runOptions, context)
  }

  private async executeToolStep(
    step: SkillScriptToolStepDefinition,
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext
  ): Promise<void> {
    const beforeDelayMs = step.beforeDelayMs ?? 0

    await this.runStepWithLifecycle(step, runtime, runOptions, context, {
      beforeDelayMs,
      execute: async ({ stepPath, startedAt }) => {
        ensureNotAborted(runOptions.signal)
        if (beforeDelayMs > 0) {
          await waitForDelay(beforeDelayMs, runOptions.signal)
        }

        const resolvedParams = resolveTemplateValue(
          step.params,
          context.scopeValues
        ) as Record<string, unknown>
        const result = await this.executeTool(
          step.executor,
          resolvedParams,
          context.scopeValues,
          runOptions.signal
        )
        runtime.lastToolResult = result
        if (step.output) {
          runtime.values[step.output] = result
        }

        await this.finishStep(runtime, runOptions, {
          step,
          stepPath,
          status: "completed",
          beforeDelayMs,
          startedAt,
          finishedAt: this.now(),
          result,
        })
      },
    })
  }

  private async executeGroupStep(
    step: SkillScriptGroupStepDefinition,
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext
  ): Promise<void> {
    await this.runStepWithLifecycle(step, runtime, runOptions, context, {
      execute: async ({ stepPath, startedAt }) => {
        await this.executeSteps(step.steps, runtime, runOptions, {
          depth: context.depth + 1,
          pathPrefix: stepPath,
          scopeValues: context.scopeValues,
        })

        await this.finishStep(runtime, runOptions, {
          step,
          stepPath,
          status: "completed",
          startedAt,
          finishedAt: this.now(),
        })
      },
    })
  }

  private async executeForeachStep(
    step: SkillScriptForeachStepDefinition,
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext
  ): Promise<void> {
    await this.runStepWithLifecycle(step, runtime, runOptions, context, {
      execute: async ({ stepPath, startedAt }) => {
        const items = this.evaluateForeachItems(step.foreach.items, context.scopeValues)
        if (items.length > step.foreach.maxIterations) {
          throw new SkillScriptEngineError(
            "FOREACH_ITEMS_INVALID",
            `循环次数超过上限: ${step.foreach.maxIterations}`
          )
        }

        const itemName = step.foreach.itemName ?? "item"
        for (let index = 0; index < items.length; index += 1) {
          const loopScopeValues = {
            ...context.scopeValues,
            [itemName]: items[index],
            index,
          }

          await this.executeSteps(step.steps, runtime, runOptions, {
            depth: context.depth + 1,
            pathPrefix: `${stepPath}[${index}]`,
            scopeValues: loopScopeValues,
          })
        }

        await this.finishStep(runtime, runOptions, {
          step,
          stepPath,
          status: "completed",
          startedAt,
          finishedAt: this.now(),
          result: {
            iterations: items.length,
          },
        })
      },
    })
  }

  private async runStepWithLifecycle(
    step:
      | SkillScriptToolStepDefinition
      | SkillScriptGroupStepDefinition
      | SkillScriptForeachStepDefinition,
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext,
    options: {
      beforeDelayMs?: number
      execute(lifecycle: StepLifecycleState): Promise<void>
    }
  ): Promise<void> {
    const lifecycle = await this.createStepLifecycle(
      step,
      runOptions,
      context,
      options.beforeDelayMs
    )

    try {
      if (!(await this.shouldRunStep(step.when, context.scopeValues))) {
        await this.finishStep(runtime, runOptions, {
          step,
          stepPath: lifecycle.stepPath,
          status: "skipped",
          beforeDelayMs: options.beforeDelayMs,
          startedAt: lifecycle.startedAt,
          finishedAt: this.now(),
          reason: "WHEN_FALSE",
        })
        return
      }

      await options.execute(lifecycle)
    } catch (error) {
      await this.finishFailedStep(
        step,
        lifecycle.stepPath,
        lifecycle.startedAt,
        runtime,
        runOptions,
        error,
        {
          beforeDelayMs: options.beforeDelayMs,
        }
      )
      throw toSkillScriptEngineError(error)
    }
  }

  private async shouldRunStep(
    when: Record<string, unknown> | undefined,
    scopeValues: Record<string, unknown>
  ): Promise<boolean> {
    if (!when) {
      return true
    }

    try {
      const result = this.resolveExpression(when, scopeValues)
      if (typeof result !== "boolean") {
        throw new SkillScriptEngineError(
          "WHEN_EVALUATION_FAILED",
          "when 表达式结果必须为 boolean"
        )
      }
      return result
    } catch (error) {
      if (error instanceof SkillScriptEngineError) {
        throw error
      }
      throw new SkillScriptEngineError("WHEN_EVALUATION_FAILED", "when 表达式求值失败")
    }
  }

  private evaluateForeachItems(
    expression: Record<string, unknown>,
    scopeValues: Record<string, unknown>
  ): unknown[] {
    const result = this.resolveExpression(expression, scopeValues)
    if (!Array.isArray(result)) {
      throw new SkillScriptEngineError(
        "FOREACH_ITEMS_INVALID",
        "foreach.items 表达式结果必须为 array"
      )
    }
    return result
  }

  private resolveExpression(
    expression: Record<string, unknown>,
    scopeValues: Record<string, unknown>
  ): unknown {
    assertJsonLogicVariablesResolvable(expression, scopeValues)
    return this.expressionEngine.run(expression, scopeValues)
  }

  private async executeTool(
    executor: SkillScriptExecutorDefinition,
    params: Record<string, unknown>,
    scopeValues: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<unknown> {
    ensureNotAborted(signal)

    if (executor.type === "mcp") {
      if (!executor.mcpName) {
        throw new SkillScriptEngineError("INVALID_SCRIPT", "mcp 执行器缺少 mcpName")
      }
      if (!this.options.mcpToolClient) {
        throw new SkillScriptEngineError(
          "UNSUPPORTED_EXECUTOR",
          "当前环境未配置 MCP 客户端"
        )
      }
      return this.options.mcpToolClient.call(executor.toolName, params)
    }

    if (executor.type !== "builtin") {
      throw new SkillScriptEngineError(
        "UNSUPPORTED_EXECUTOR",
        `不支持的执行器类型: ${executor.type}`
      )
    }

    const builtinTool = this.builtinTools[executor.toolName]
    if (!builtinTool) {
      throw new SkillScriptEngineError(
        "BUILTIN_TOOL_NOT_FOUND",
        `未注册的内置工具: ${executor.toolName}`
      )
    }

    return builtinTool(params, {
      expressionEngine: this.expressionEngine,
      values: contextScopeSnapshot(scopeValues),
      getValue: (path) => getValueByPath(scopeValues, path),
      resolveExpression: (expression) => this.resolveExpression(expression, scopeValues),
      resolveTemplateValue: (input) => resolveTemplateValue(input, scopeValues),
      signal,
    })
  }

  private async finishFailedStep(
    step:
      | SkillScriptToolStepDefinition
      | SkillScriptGroupStepDefinition
      | SkillScriptForeachStepDefinition,
    stepPath: string,
    startedAt: Date,
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    error: unknown,
    options: {
      beforeDelayMs?: number
    } = {}
  ): Promise<void> {
    const engineError = toSkillScriptEngineError(error)
    await this.finishStep(runtime, runOptions, {
      step,
      stepPath,
      status: "failed",
      beforeDelayMs: options.beforeDelayMs,
      startedAt,
      finishedAt: this.now(),
      error: {
        code: engineError.code,
        message: engineError.message,
      },
    })
  }

  private async finishStep(
    runtime: SkillScriptRuntimeState,
    runOptions: SkillScriptRunOptions,
    input: {
      step:
        | SkillScriptToolStepDefinition
        | SkillScriptGroupStepDefinition
        | SkillScriptForeachStepDefinition
      stepPath: string
      status: SkillStepExecutionRecord["status"]
      startedAt: Date
      finishedAt: Date
      beforeDelayMs?: number
      result?: unknown
      error?: SkillExecutionError
      reason?: "WHEN_FALSE"
    }
  ): Promise<void> {
    const record = createStepRecord(input)
    runtime.stepResults.push(record)
    return runOptions.onEvent?.({
      type: "step.finished",
      record,
    })
  }

  private async createStepLifecycle(
    step:
      | SkillScriptToolStepDefinition
      | SkillScriptGroupStepDefinition
      | SkillScriptForeachStepDefinition,
    runOptions: SkillScriptRunOptions,
    context: StepExecutionContext,
    beforeDelayMs?: number
  ): Promise<StepLifecycleState> {
    const stepPath = buildStepPath(context.pathPrefix, step.stepId)
    const startedAt = this.now()

    await runOptions.onEvent?.({
      type: "step.started",
      stepId: step.stepId,
      stepPath,
      beforeDelayMs,
    })

    return {
      stepPath,
      startedAt,
    }
  }
}

export class DirectMcpSkillEngine extends SkillScriptEngine {
  constructor(mcpToolClient: SkillScriptMcpToolClient) {
    super({
      mcpToolClient,
    })
  }
}

export {
  SkillScriptEngineError,
  assertSkillScriptDefinition,
  getValueByPath,
  query3040TodaySkill,
  resolveTemplateString,
  resolveTemplateValue,
}

export type {
  SkillDefinition,
  SkillErrorCode,
  SkillExecutionResult,
  SkillScriptBuiltinContext,
  SkillScriptBuiltinTool,
  SkillScriptDefinition,
  SkillScriptEngineOptions,
  SkillScriptExecutorDefinition,
  SkillScriptMcpToolClient,
  SkillScriptRunOptions,
  SkillScriptRuntimeEvent,
  SkillScriptRuntimeEventMap,
  SkillScriptStepDefinition,
  SkillStepExecutionRecord,
} from "./skillScriptTypes"

function buildStepPath(prefix: string | undefined, stepId: string): string {
  if (!prefix) {
    return stepId
  }
  return `${prefix}.${stepId}`
}

function createStepRecord(input: {
  step:
    | SkillScriptToolStepDefinition
    | SkillScriptGroupStepDefinition
    | SkillScriptForeachStepDefinition
  stepPath: string
  status: SkillStepExecutionRecord["status"]
  startedAt: Date
  finishedAt: Date
  beforeDelayMs?: number
  result?: unknown
  error?: SkillExecutionError
  reason?: "WHEN_FALSE"
}): SkillStepExecutionRecord {
  return {
    stepId: input.step.stepId,
    stepPath: input.stepPath,
    status: input.status,
    executor: "executor" in input.step ? input.step.executor : undefined,
    beforeDelayMs: input.beforeDelayMs,
    startedAt: input.startedAt.toISOString(),
    finishedAt: input.finishedAt.toISOString(),
    durationMs: input.finishedAt.getTime() - input.startedAt.getTime(),
    outputName: "output" in input.step ? input.step.output : undefined,
    result: input.result,
    error: input.error,
    reason: input.reason,
  }
}

function contextScopeSnapshot(
  scopeValues: Record<string, unknown>
): Record<string, unknown> {
  return Object.freeze({ ...scopeValues })
}

function ensureNotAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new SkillScriptEngineError("USER_CANCELED", "用户已中止当前任务")
  }
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

function isGroupStep(step: SkillScriptStepDefinition): step is SkillScriptGroupStepDefinition {
  return step.type === "group"
}

function isForeachStep(step: SkillScriptStepDefinition): step is SkillScriptForeachStepDefinition {
  return step.type === "foreach"
}
