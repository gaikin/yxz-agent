import fs from "node:fs/promises"
import path from "node:path"
import { CronExpressionParser } from "cron-parser"
import { formatDateTime } from "../../../share/dateTime"

export interface LocalJsonScheduleDefinition {
  scheduleId: string
  name: string
  cronExpression: string
  timezone: string
  skillFile: string
  enabled: boolean
}

export interface LocalJsonScheduleState {
  scheduleId: string
  enabled: boolean
  nextTriggerAt?: string
  lastTriggeredAt?: string
  lastCompletedAt?: string
  lastStatus?: "idle" | "scheduled" | "running" | "completed" | "failed" | "disabled"
  lastError?: string
}

export interface LocalJsonScheduleSnapshot {
  schedule: LocalJsonScheduleDefinition
  state: LocalJsonScheduleState
}

export interface LocalJsonScheduleTrigger {
  schedule: LocalJsonScheduleDefinition
  dueAt: Date
  skillFilePath: string
}

export type LocalJsonScheduleHandler = (
  trigger: LocalJsonScheduleTrigger
) => Promise<void> | void

export interface LocalJsonScheduleEngineOptions {
  workspaceRoot: string
  configFile?: string
  onTrigger: LocalJsonScheduleHandler
  now?: () => Date
}

type RegisteredJob = {
  definition: LocalJsonScheduleDefinition
  timer?: NodeJS.Timeout
}

type PersistedScheduleFile = {
  schedules: LocalJsonScheduleDefinition[]
}

export async function loadLocalScheduleFile(filePath: string): Promise<LocalJsonScheduleDefinition[]> {
  const raw = await fs.readFile(filePath, "utf-8")
  const parsed = JSON.parse(raw) as PersistedScheduleFile | LocalJsonScheduleDefinition[]
  const schedules = Array.isArray(parsed) ? parsed : parsed.schedules

  if (!Array.isArray(schedules)) {
    throw new Error(`Invalid schedule config: ${filePath}`)
  }

  return schedules.map((schedule, index) => {
    assertScheduleDefinition(schedule, `${filePath}#${index}`)
    return schedule
  })
}

export function getNextTriggerDate(
  cronExpression: string,
  timezone: string,
  currentDate: Date
): Date {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate,
    tz: timezone,
  })

  return interval.next().toDate()
}

export class LocalJsonScheduleEngine {
  private readonly configFilePath: string
  private readonly jobs = new Map<string, RegisteredJob>()
  private readonly stateById = new Map<string, LocalJsonScheduleState>()
  private readonly now: () => Date

  constructor(private readonly options: LocalJsonScheduleEngineOptions) {
    this.configFilePath = path.join(
      options.workspaceRoot,
      options.configFile ?? "config/schedules.json"
    )
    this.now = options.now ?? (() => new Date())
  }

  async start(): Promise<void> {
    await this.reload()
  }

  async reload(): Promise<void> {
    await this.stop()

    const schedules = await loadLocalScheduleFile(this.configFilePath)
    for (const schedule of schedules) {
      const currentState: LocalJsonScheduleState = {
        scheduleId: schedule.scheduleId,
        enabled: schedule.enabled,
        lastStatus: schedule.enabled ? "idle" : "disabled",
      }
      this.stateById.set(schedule.scheduleId, currentState)

      if (schedule.enabled) {
        await this.register(schedule)
      }
    }
  }

  async stop(): Promise<void> {
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearTimeout(job.timer)
      }
    }
    this.jobs.clear()
  }

  async enable(scheduleId: string): Promise<void> {
    const definition = this.getDefinition(scheduleId)
    const nextDefinition: LocalJsonScheduleDefinition = {
      ...definition,
      enabled: true,
    }
    await this.register(nextDefinition)
  }

  async disable(scheduleId: string): Promise<void> {
    const existing = this.jobs.get(scheduleId)
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }
    this.jobs.delete(scheduleId)

    this.stateById.set(scheduleId, {
      ...(this.stateById.get(scheduleId) ?? {
        scheduleId,
      }),
      enabled: false,
      nextTriggerAt: undefined,
      lastStatus: "disabled",
    })
  }

  getSnapshot(): LocalJsonScheduleSnapshot[] {
    return Array.from(this.jobs.values()).map((job) => ({
      schedule: job.definition,
      state:
        this.stateById.get(job.definition.scheduleId) ?? {
          scheduleId: job.definition.scheduleId,
          enabled: job.definition.enabled,
          lastStatus: "idle",
        },
    }))
  }

  getState(scheduleId: string): LocalJsonScheduleState | undefined {
    return this.stateById.get(scheduleId)
  }

  private async register(
    schedule: LocalJsonScheduleDefinition,
    currentDate = this.now()
  ): Promise<void> {
    const nextTriggerDate = getNextTriggerDate(
      schedule.cronExpression,
      schedule.timezone,
      currentDate
    )
    const delay = Math.max(nextTriggerDate.getTime() - currentDate.getTime(), 0)
    const nextTriggerAt = formatDateTime(nextTriggerDate)

    const existing = this.jobs.get(schedule.scheduleId)
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }

    const timer = setTimeout(async () => {
      await this.runSchedule(schedule, nextTriggerDate)
    }, delay)

    this.jobs.set(schedule.scheduleId, {
      definition: schedule,
      timer,
    })

    this.stateById.set(schedule.scheduleId, {
      ...(this.stateById.get(schedule.scheduleId) ?? { scheduleId: schedule.scheduleId }),
      enabled: true,
      nextTriggerAt,
      lastStatus: "scheduled",
    })
  }

  private async runSchedule(
    schedule: LocalJsonScheduleDefinition,
    dueAt: Date
  ): Promise<void> {
    const triggeredAt = formatDateTime(dueAt)
    this.stateById.set(schedule.scheduleId, {
      ...(this.stateById.get(schedule.scheduleId) ?? { scheduleId: schedule.scheduleId }),
      enabled: true,
      lastTriggeredAt: triggeredAt,
      lastStatus: "running",
      lastError: undefined,
    })

    try {
      await Promise.resolve(
        this.options.onTrigger({
          schedule,
          dueAt,
          skillFilePath: path.join(this.options.workspaceRoot, schedule.skillFile),
        })
      )

      this.stateById.set(schedule.scheduleId, {
        ...(this.stateById.get(schedule.scheduleId) ?? { scheduleId: schedule.scheduleId }),
        enabled: true,
        lastTriggeredAt: triggeredAt,
        lastCompletedAt: formatDateTime(this.now()),
        lastStatus: "completed",
        lastError: undefined,
      })
    } catch (error) {
      this.stateById.set(schedule.scheduleId, {
        ...(this.stateById.get(schedule.scheduleId) ?? { scheduleId: schedule.scheduleId }),
        enabled: true,
        lastTriggeredAt: triggeredAt,
        lastCompletedAt: formatDateTime(this.now()),
        lastStatus: "failed",
        lastError: error instanceof Error ? error.message : String(error),
      })
    } finally {
      await this.register(schedule, new Date(dueAt.getTime() + 1000))
    }
  }

  private getDefinition(scheduleId: string): LocalJsonScheduleDefinition {
    const existing = this.jobs.get(scheduleId)?.definition
    if (existing) {
      return existing
    }

    const snapshot = this.getSnapshot().find((item) => item.schedule.scheduleId === scheduleId)
    if (snapshot) {
      return snapshot.schedule
    }

    throw new Error(`Schedule not found: ${scheduleId}`)
  }
}

function assertScheduleDefinition(
  schedule: unknown,
  location: string
): asserts schedule is LocalJsonScheduleDefinition {
  if (!schedule || typeof schedule !== "object") {
    throw new Error(`Invalid schedule definition at ${location}`)
  }

  const candidate = schedule as Record<string, unknown>
  const requiredStringFields = [
    "scheduleId",
    "name",
    "cronExpression",
    "timezone",
    "skillFile",
  ] as const

  for (const field of requiredStringFields) {
    if (typeof candidate[field] !== "string" || candidate[field]?.length === 0) {
      throw new Error(`Invalid ${field} at ${location}`)
    }
  }

  if (typeof candidate.enabled !== "boolean") {
    throw new Error(`Invalid enabled at ${location}`)
  }
}
