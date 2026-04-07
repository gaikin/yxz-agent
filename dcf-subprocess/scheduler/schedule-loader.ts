import type { ScheduleDefinition } from "./types"

export class ScheduleLoader {
  constructor(private readonly schedules: ScheduleDefinition[]) {}

  async list(): Promise<ScheduleDefinition[]> {
    return [...this.schedules]
  }

  async get(scheduleId: string): Promise<ScheduleDefinition | undefined> {
    return this.schedules.find((item) => item.scheduleId === scheduleId)
  }
}

