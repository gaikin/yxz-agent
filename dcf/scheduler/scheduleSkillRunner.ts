import { createId } from "../common/id"
import { SkillEngine } from "../skills/skillEngine"
import type { SkillExecutionResult } from "../skills/types"
import { ScheduleSkillRegistry } from "./scheduleSkillRegistry"
import type { JsonRpcToolTransportFactory } from "../execution/mcpToolClient"
import { JsonRpcMcpToolClient } from "../execution/mcpToolClient"
import { DefaultToolExecutor } from "../execution/toolExecutor"
import { ToolHandlerRegistry } from "../execution/toolHandlerRegistry"
import {
  ExecutePageCommandsHandler,
  OpenMenuHandler,
  ReadSchemaHandler,
} from "../execution/toolHandlers"

export interface ScheduleSkillRunOutput {
  runId: string
  result: SkillExecutionResult
}

export class ScheduleSkillRunner {
  constructor(
    private readonly registry: ScheduleSkillRegistry,
    private readonly transportFactory: JsonRpcToolTransportFactory
  ) {}

  async run(skillId: string, now = new Date()): Promise<ScheduleSkillRunOutput> {
    const skill = this.registry.get(skillId)
    if (!skill) {
      return {
        runId: createId("run", now),
        result: {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: `Skill not found: ${skillId}`,
          },
        },
      }
    }

    return {
      runId: createId("run", now),
      result: await this.createEngine().run(skill),
    }
  }

  private createEngine(): SkillEngine {
    const transport = this.transportFactory.create()
    const mcpToolClient = new JsonRpcMcpToolClient(transport)
    const toolHandlerRegistry = new ToolHandlerRegistry()
    toolHandlerRegistry.register(new OpenMenuHandler(mcpToolClient))
    toolHandlerRegistry.register(new ExecutePageCommandsHandler(mcpToolClient))
    toolHandlerRegistry.register(new ReadSchemaHandler(mcpToolClient))
    const toolExecutor = new DefaultToolExecutor(toolHandlerRegistry)
    return new SkillEngine(toolExecutor)
  }
}
