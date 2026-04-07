import type { SchedulePendingExecutionItem } from "../../shared/protocol"
import { createId } from "../common/id"
import { SchedulePendingExecutionStore } from "./schedule-pending-execution-store"
import { ScheduleRunRecordStore } from "./schedule-run-record-store"
import { ScheduleRuntimeStore } from "./schedule-runtime-store"
import type { FrontendEventPublisher, PopupEventPublisher, ScheduleDefinition } from "./types"
import { ScheduleSkillRunner } from "./schedule-skill-runner"

export class ScheduleExecutionCoordinator {
  private executing = false

  constructor(
    private readonly pendingStore: SchedulePendingExecutionStore,
    private readonly runRecordStore: ScheduleRunRecordStore,
    private readonly runtimeStore: ScheduleRuntimeStore,
    private readonly popupPublisher: PopupEventPublisher,
    private readonly frontendPublisher: FrontendEventPublisher,
    private readonly skillRunner: ScheduleSkillRunner
  ) {}

  async onScheduleDue(schedule: ScheduleDefinition, requestedAt = new Date()): Promise<void> {
    const item: SchedulePendingExecutionItem = {
      executionId: createId("exec", requestedAt),
      scheduleId: schedule.scheduleId,
      scheduleName: schedule.name,
      requestedAt: requestedAt.toISOString(),
      status: "pending",
    }

    await this.pendingStore.add(item)
    await this.runtimeStore.upsert(schedule.scheduleId, {
      lastTriggeredAt: item.requestedAt,
    })
    if (!this.executing) {
      await this.popupPublisher.publishOverview()
    }
  }

  async confirmAll(executionIds: string[], schedules: ScheduleDefinition[]): Promise<void> {
    const snapshot = (await this.pendingStore.getByIds(executionIds))
      .filter((item) => item.status === "pending")
      .sort((left, right) => left.requestedAt.localeCompare(right.requestedAt))

    if (snapshot.length === 0) {
      return
    }

    await this.pendingStore.updateStatus(
      snapshot.map((item) => item.executionId),
      "confirmed"
    )
    await this.popupPublisher.publishOverview()

    if (this.executing) {
      return
    }

    this.executing = true
    try {
      for (const item of snapshot) {
        await this.pendingStore.updateStatus([item.executionId], "running")
        const schedule = schedules.find((candidate) => candidate.scheduleId === item.scheduleId)
        if (!schedule) {
          await this.pendingStore.updateStatus([item.executionId], "failed")
          await this.runtimeStore.upsert(item.scheduleId, {
            lastStatus: "failed",
            lastError: {
              code: "RUNTIME_EXCEPTION",
              message: `Schedule not found: ${item.scheduleId}`,
            },
          })
          await this.runRecordStore.append({
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
            },
          })
          continue
        }

        const startedAt = new Date()
        const run = await this.skillRunner.run(schedule.skillId, startedAt)
        const completedAt = new Date().toISOString()
        const finalStatus = run.result.status === "completed" ? "completed" : "failed"

        await this.pendingStore.updateStatus([item.executionId], finalStatus)
        await this.runtimeStore.upsert(schedule.scheduleId, {
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
        await this.runRecordStore.append({
          executionId: item.executionId,
          scheduleId: item.scheduleId,
          scheduleName: item.scheduleName,
          requestedAt: item.requestedAt,
          runId: run.runId,
          startedAt: startedAt.toISOString(),
          completedAt,
          status: finalStatus,
          result: run.result,
        })
      }
    } finally {
      this.executing = false
      await this.popupPublisher.publishOverview()
    }
  }

  async dismissAll(executionIds: string[]): Promise<void> {
    const items = await this.pendingStore.updateStatus(executionIds, "skipped")
    for (const item of items) {
      await this.runtimeStore.upsert(item.scheduleId, {
        lastStatus: "skipped",
      })
      await this.runRecordStore.append({
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
    await this.popupPublisher.publishOverview()
  }

  async enableSchedule(scheduleId: string, nextTriggerAt?: string): Promise<void> {
    await this.runtimeStore.upsert(scheduleId, {
      enabled: true,
      nextTriggerAt,
      lastStatus: "enabled",
    })
    await this.frontendPublisher.publishScheduleEnabled(scheduleId, nextTriggerAt)
  }

  async disableSchedule(scheduleId: string): Promise<void> {
    await this.runtimeStore.upsert(scheduleId, {
      enabled: false,
      nextTriggerAt: undefined,
      lastStatus: "disabled",
    })
    await this.frontendPublisher.publishScheduleDisabled(scheduleId)
  }
}
