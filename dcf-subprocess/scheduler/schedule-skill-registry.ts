import type { SkillDefinition } from "../skills/types"

export class ScheduleSkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>()

  register(skill: SkillDefinition): void {
    this.skills.set(skill.skillId, skill)
  }

  get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId)
  }
}

