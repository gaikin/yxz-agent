import { CronExpressionParser } from "cron-parser"
import type { ScheduleDefinition } from "./types"

type DueHandler = (schedule: ScheduleDefinition, requestedAt: Date) => Promise<void>
type ScheduledHandler = (schedule: ScheduleDefinition, nextTriggerAt: string) => Promise<void>

type RegisteredJob = {
  schedule: ScheduleDefinition
  timer?: NodeJS.Timeout
  nextTriggerAt?: string
}

export class SchedulerManager {
  private readonly jobs = new Map<string, RegisteredJob>()

  constructor(
    private readonly onDue: DueHandler,
    private readonly onScheduled?: ScheduledHandler
  ) {}

  async register(schedule: ScheduleDefinition, currentDate = new Date()): Promise<string> {
    const nextTriggerAt = this.calculateNextTriggerAt(schedule, currentDate)
    const delay = Math.max(nextTriggerAt.getTime() - currentDate.getTime(), 0)

    const existing = this.jobs.get(schedule.scheduleId)
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }

    const timer = setTimeout(async () => {
      await this.onDue(schedule, nextTriggerAt)

      const current = this.jobs.get(schedule.scheduleId)
      if (!current || current.timer !== timer) {
        return
      }

      await this.register(schedule, new Date(nextTriggerAt.getTime() + 1000))
    }, delay)

    this.jobs.set(schedule.scheduleId, {
      schedule,
      timer,
      nextTriggerAt: nextTriggerAt.toISOString(),
    })

    await this.onScheduled?.(schedule, nextTriggerAt.toISOString())
    return nextTriggerAt.toISOString()
  }

  async unregister(scheduleId: string): Promise<void> {
    const existing = this.jobs.get(scheduleId)
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }
    this.jobs.delete(scheduleId)
  }

  async stop(): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearTimeout(job.timer)
      }
    }
    this.jobs.clear()
  }

  async trigger(schedule: ScheduleDefinition, requestedAt = new Date()): Promise<void> {
    await this.onDue(schedule, requestedAt)
  }

  getNextTriggerAt(scheduleId: string): string | undefined {
    return this.jobs.get(scheduleId)?.nextTriggerAt
  }

  private calculateNextTriggerAt(schedule: ScheduleDefinition, currentDate: Date): Date {
    const interval = CronExpressionParser.parse(schedule.cronExpression, {
      currentDate,
      tz: schedule.timezone,
    })

    return interval.next().toDate()
  }
}
