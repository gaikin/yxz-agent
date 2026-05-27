"use strict"

const { resolveParams } = require("./utils")

class DirectMcpSkillRunner {
  constructor(mcpToolClient) {
    this.mcpToolClient = mcpToolClient
  }

  async run(skill) {
    const runtime = {
      values: {},
      lastToolResult: undefined,
      stepResults: [],
    }

    if (!Array.isArray(skill.steps) || skill.steps.length === 0) {
      return {
        status: "failed",
        error: {
          code: "RUNTIME_EXCEPTION",
          message: "skill 未定义可执行 steps",
        },
        steps: runtime.stepResults,
      }
    }

    for (const step of skill.steps) {
      let resolvedParams
      try {
        resolvedParams = resolveParams(step.params, runtime.values)
      } catch {
        return {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: "参数引用解析失败",
          },
          steps: runtime.stepResults,
        }
      }

      try {
        const result = await this.mcpToolClient.call(step.action, resolvedParams)
        runtime.stepResults.push({
          stepId: step.stepId,
          action: step.action,
          params: resolvedParams,
          status: "completed",
          result,
        })
        runtime.lastToolResult = result
        if (step.saveAs) {
          runtime.values[step.saveAs] = result
        }
      } catch (error) {
        runtime.stepResults.push({
          stepId: step.stepId,
          action: step.action,
          params: resolvedParams,
          status: "failed",
          errorMessage: error instanceof Error ? error.message : String(error),
        })
        return {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: error instanceof Error ? error.message : String(error),
          },
          steps: runtime.stepResults,
        }
      }
    }

    return {
      status: "completed",
      data: runtime.lastToolResult,
      steps: runtime.stepResults,
    }
  }
}

module.exports = {
  DirectMcpSkillRunner,
}
