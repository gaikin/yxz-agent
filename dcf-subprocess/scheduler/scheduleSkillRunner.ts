import { createId } from "../common/id"
import { SkillEngine } from "../skills/skillEngine"
import type { SkillExecutionResult } from "../skills/types"
import { ScheduleSkillRegistry } from "./scheduleSkillRegistry"

export interface ScheduleSkillRunOutput {
  runId: string
  result: SkillExecutionResult
}

export class ScheduleSkillRunner {
  constructor(
    private readonly registry: ScheduleSkillRegistry,
    private readonly engine: SkillEngine
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
      result: await this.engine.run(skill),
    }
  }
}
