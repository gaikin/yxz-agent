import { CronExpressionParser } from "cron-parser"
import type {
  ScheduleExecutionOverview,
  SchedulePendingExecutionItem,
} from "../../../share/protocol"
import { formatDateTime, formatNow } from "../../../share/dateTime"
import { createId } from "../common/id"
import { JsonRpcMcpToolClient, type JsonRpcToolTransportFactory } from "../execution/mcpToolClient"
import {
  DirectMcpSkillEngine,
  SkillDefinition,
  type SkillExecutionResult,
} from "../SkillService"
import {
  type ScheduleDefinition,
  SchedulePendingExecutionService,
  ScheduleRunRecordService,
  ScheduleRuntimeService,
} from "./ScheduleStateService"

type DueHandler = (schedule: ScheduleDefinition, requestedAt: Date) => Promise<void>
type ScheduledHandler = (schedule: ScheduleDefinition, nextTriggerAt: string) => Promise<void>

type RegisteredJob = {
  schedule: ScheduleDefinition
  timer?: NodeJS.Timeout
  nextTriggerAt?: string
}

export interface ScheduleSkillRunOutput {
  runId: string
  result: SkillExecutionResult
}

type PendingExecutionHandler = (
  overview: ScheduleExecutionOverview
) => Promise<void>
type PublishScheduleEnabled = (
  scheduleId: string,
  nextTriggerAt?: string
) => Promise<void>
type PublishScheduleDisabled = (scheduleId: string) => Promise<void>

export class ScheduleSkillCatalogService {
  private readonly skills = new Map<string, SkillDefinition>()

  register(skill: SkillDefinition): void {
    this.skills.set(skill.skillId, skill)
  }

  get(skillId: string): SkillDefinition | undefined {
    return this.skills.get(skillId)
  }
}

export class ScheduleSkillExecutionService {
  constructor(
    private readonly skillCatalogService: ScheduleSkillCatalogService,
    private readonly transportFactory: JsonRpcToolTransportFactory
  ) {}

  async run(skillId: string, now = new Date()): Promise<ScheduleSkillRunOutput> {
    const skill = this.skillCatalogService.get(skillId)
    if (!skill) {
      return {
        runId: createId("run", now),
        result: {
          status: "failed",
          error: {
            code: "RUNTIME_EXCEPTION",
            message: `Skill not found: ${skillId}`,
          },
          steps: [],
        },
      }
    }

    return {
      runId: createId("run", now),
      result: await this.createEngine().run(skill),
    }
  }

  private createEngine(): DirectMcpSkillEngine {
    const transport = this.transportFactory.create()
    const mcpToolClient = new JsonRpcMcpToolClient(transport)
    return new DirectMcpSkillEngine(mcpToolClient)
  }
}

export class ScheduleTimerService {
  private readonly jobs = new Map<string, RegisteredJob>()

  constructor(
    private readonly onDue: DueHandler,
    private readonly onScheduled?: ScheduledHandler
  ) {}

  async register(schedule: ScheduleDefinition, currentDate = new Date()): Promise<string> {
    const nextTriggerAt = this.calculateNextTriggerAt(schedule, currentDate)
    const delay = Math.max(nextTriggerAt.getTime() - currentDate.getTime(), 0)
    const nextTriggerAtText = formatDateTime(nextTriggerAt)
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
    timer.unref?.()

    this.jobs.set(schedule.scheduleId, {
      schedule,
      timer,
      nextTriggerAt: nextTriggerAtText,
    })

    await this.onScheduled?.(schedule, nextTriggerAtText)
    return nextTriggerAtText
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

export class ScheduleExecutionService {
  private executing = false

  constructor(
    private readonly pendingExecutionService: SchedulePendingExecutionService,
    private readonly runRecordService: ScheduleRunRecordService,
    private readonly runtimeService: ScheduleRuntimeService,
    private readonly notifyPendingExecution: PendingExecutionHandler,
    private readonly publishScheduleEnabled: PublishScheduleEnabled,
    private readonly publishScheduleDisabled: PublishScheduleDisabled,
    private readonly skillExecutionService: ScheduleSkillExecutionService
  ) {}

  async onScheduleDue(schedule: ScheduleDefinition, requestedAt = new Date()): Promise<void> {
    const item: SchedulePendingExecutionItem = {
      executionId: createId("exec", requestedAt),
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.name,
      requestedAt: formatDateTime(requestedAt),
      status: "pending",
    }

    await this.pendingExecutionService.add(item)
    await this.runtimeService.upsert(schedule.scheduleId, {
      lastTriggeredAt: item.requestedAt,
    })
    if (!this.executing) {
      await this.notifyPendingOverview()
    }
  }

  async confirmAll(executionIds: string[], schedules: ScheduleDefinition[]): Promise<void> {
    const snapshot = (await this.pendingExecutionService.getByIds(executionIds))
      .filter((item) => item.status === "pending")
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))

    if (snapshot.length === 0) {
      return
    }

    await this.pendingExecutionService.updateStatus(
      snapshot.map((item) => item.executionId),
      "confirmed"
    )
    await this.notifyPendingOverview()

    if (this.executing) {
      return
    }

    this.executing = true
    try {
      for (const item of snapshot) {
        await this.pendingExecutionService.updateStatus([item.executionId], "running")
        const schedule = schedules.find((candidate) => candidate.scheduleId === item.scheduleId)
        if (!schedule) {
          await this.failMissingSchedule(item)
          continue
        }

        const startedAt = new Date()
        const run = await this.skillExecutionService.run(schedule.skillId, startedAt)
        const completedAt = formatNow()
        const finalStatus = run.result.status === "completed" ? "completed" : "failed"

        await this.pendingExecutionService.updateStatus([item.executionId], finalStatus)
        await this.runtimeService.upsert(schedule.scheduleId, {
          lastRunId: run.runId,
          lastCompletedAt: completedAt,
          lastStatus: finalStatus,
          lastError:
            run.result.status === "failed"
              ? {
                  code: run.result.error.code,
                  message: run.result.error.message,
                }
              : undefined,
        })
        await this.runRecordService.append({
          executionId: item.executionId,
          scheduleId: item.scheduleId,
          scheduleName: item.scheduleName,
          requestedAt: item.requestedAt,
          runId: run.runId,
          startedAt: formatDateTime(startedAt),
          completedAt,
          status: finalStatus,
          result: run.result,
        })
      }
    } finally {
      this.executing = false
      await this.notifyPendingOverview()
    }
  }

  async dismissAll(executionIds: string[]): Promise<void> {
    const items = await this.pendingExecutionService.updateStatus(executionIds, "skipped")
    for (const item of items) {
      await this.runtimeService.upsert(item.scheduleId, {
        lastStatus: "skipped",
      })
      await this.runRecordService.append({
        executionId: item.executionId,
        scheduleId: item.scheduleId,
        scheduleName: item.scheduleName,
        requestedAt: item.requestedAt,
        status: "skipped",
        result: {
          status: "skipped",
          summary: "用户忽略本次定时执行",
        },
      })
    }
    await this.notifyPendingOverview()
  }

  async enableSchedule(scheduleId: string, nextTriggerAt?: string): Promise<void> {
    await this.runtimeService.upsert(scheduleId, {
      enabled: true,
      nextTriggerAt,
      lastStatus: "enabled",
    })
    await this.publishScheduleEnabled(scheduleId, nextTriggerAt)
  }

  async disableSchedule(scheduleId: string): Promise<void> {
    await this.runtimeService.upsert(scheduleId, {
      enabled: false,
      nextTriggerAt: undefined,
      lastStatus: "disabled",
    })
    await this.publishScheduleDisabled(scheduleId)
  }

  private async failMissingSchedule(item: SchedulePendingExecutionItem): Promise<void> {
    await this.pendingExecutionService.updateStatus([item.executionId], "failed")
    await this.runtimeService.upsert(item.scheduleId, {
      lastStatus: "failed",
      lastError: {
        code: "RUNTIME_EXCEPTION",
        message: `Schedule not found: ${item.scheduleId}`,
      },
    })
    await this.runRecordService.append({
      executionId: item.executionId,
      scheduleId: item.scheduleId,
      scheduleName: item.scheduleName,
      requestedAt: item.requestedAt,
      status: "failed",
      result: {
        status: "failed",
        error: {
          code: "RUNTIME_EXCEPTION",
          message: `Schedule not found: ${item.scheduleId}`,
        },
        steps: [],
      },
    })
  }

  private async notifyPendingOverview(): Promise<void> {
    const overview = await this.pendingExecutionService.getPendingOverview()
    await this.notifyPendingExecution(overview)
  }
}
