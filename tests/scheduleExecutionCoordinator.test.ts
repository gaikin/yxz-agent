import test from "node:test"
import assert from "node:assert/strict"
import { ScheduleExecutionService } from "../subprocess/service/scheduler/SchedulerService"
import {
  SchedulePendingExecutionService,
  ScheduleRunRecordService,
  ScheduleRuntimeService,
  ScheduleDefinition,
} from "../subprocess/service/scheduler/ScheduleStateService"
import type { SkillExecutionResult } from "../subprocess/service/SkillService"
import type { ScheduleExecutionOverview } from "../share/protocol"
import type { RumJsCacheApi } from "../subprocess/service/common/rumJsJsonStore"
import { formatDateTime } from "../share/dateTime"

class MemoryPendingExecutionHandler {
  calls = 0

  async notify(_overview: ScheduleExecutionOverview): Promise<void> {
    this.calls += 1
  }
}

class MemoryScheduleEventPublisher {
  enabledEvents: Array<{ scheduleId: string; nextTriggerAt?: string }> = []
  disabledEvents: string[] = []

  async publishScheduleEnabled(scheduleId: string, nextTriggerAt?: string): Promise<void> {
    this.enabledEvents.push({ scheduleId, nextTriggerAt })
  }

  async publishScheduleDisabled(scheduleId: string): Promise<void> {
    this.disabledEvents.push(scheduleId)
  }
}

class DeferredSkillRunner {
  private resolver?: (value: { runId: string; result: SkillExecutionResult }) => void

  runCount = 0

  async run(): Promise<{ runId: string; result: SkillExecutionResult }> {
    this.runCount += 1
    return new Promise((resolve) => {
      this.resolver = resolve
    })
  }

  resolve(result: { runId: string; result: SkillExecutionResult }) {
    this.resolver?.(result)
  }
}

class MemoryRumJsCache implements RumJsCacheApi {
  private readonly map = new Map<string, string>()

  async readCacheFileAsync(args: { fileName: string }): Promise<string | undefined> {
    return this.map.get(args.fileName)
  }

  async writeCacheFileAsync(args: { fileName: string; content: string }): Promise<void> {
    this.map.set(args.fileName, args.content)
  }
}

async function createExecutionService() {
  const cache = new MemoryRumJsCache()
  const pendingStore = new SchedulePendingExecutionService(cache, "pending.json")
  const runRecordStore = new ScheduleRunRecordService(cache, "records.json")
  const runtimeStore = new ScheduleRuntimeService(cache, "runtime.json")
  const pendingExecutionHandler = new MemoryPendingExecutionHandler()
  const scheduleEventPublisher = new MemoryScheduleEventPublisher()
  const skillRunner = new DeferredSkillRunner()

  const executionService = new ScheduleExecutionService(
    pendingStore,
    runRecordStore,
    runtimeStore,
    pendingExecutionHandler.notify.bind(pendingExecutionHandler),
    scheduleEventPublisher.publishScheduleEnabled.bind(scheduleEventPublisher),
    scheduleEventPublisher.publishScheduleDisabled.bind(scheduleEventPublisher),
    skillRunner as never
  )

  return {
    executionService,
    pendingStore,
    runRecordStore,
    runtimeStore,
    pendingExecutionHandler,
    scheduleEventPublisher,
    skillRunner,
  }
}

const schedule3040: ScheduleDefinition = {
  scheduleId: "schedule_3040_daily",
  name: "3040每日查询",
  cronExpression: "0 0 10 * * *",
  timezone: "Asia/Shanghai",
  skillId: "query_3040_today",
}

test("onScheduleDue creates pending item and updates overview", async () => {
  const { executionService, pendingStore, pendingExecutionHandler, runtimeStore } =
    await createExecutionService()

  await executionService.onScheduleDue(schedule3040, new Date("2026-04-07T10:00:00+08:00"))

  const items = await pendingStore.list()
  assert.equal(items.length, 1)
  assert.equal(items[0].status, "pending")
  assert.equal(pendingExecutionHandler.calls, 1)

  const runtime = await runtimeStore.get(schedule3040.scheduleId)
  assert.equal(
    runtime?.lastTriggeredAt,
    formatDateTime(new Date("2026-04-07T10:00:00+08:00"))
  )
})

test("dismissAll marks shown items as skipped and updates runtime", async () => {
  const { executionService, pendingStore, runtimeStore, runRecordStore } =
    await createExecutionService()

  await executionService.onScheduleDue(schedule3040, new Date("2026-04-07T10:00:00+08:00"))
  const [item] = await pendingStore.list()

  await executionService.dismissAll([item.executionId])

  const [updated] = await pendingStore.list()
  assert.equal(updated.status, "skipped")
  const runtime = await runtimeStore.get(schedule3040.scheduleId)
  assert.equal(runtime?.lastStatus, "skipped")
  const records = await runRecordStore.list()
  assert.equal(records[0].status, "skipped")
})

test("confirmAll uses snapshot only and keeps new due items pending", async () => {
  const { executionService, pendingStore, pendingExecutionHandler, skillRunner } =
    await createExecutionService()

  await executionService.onScheduleDue(schedule3040, new Date("2026-04-07T10:00:00+08:00"))
  const [first] = await pendingStore.list()

  const confirmPromise = executionService.confirmAll([first.executionId], [schedule3040])
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const items = await pendingStore.list()
    if (items[0]?.status === "running") {
      break
    }
    await new Promise((resolve) => setImmediate(resolve))
  }

  await executionService.onScheduleDue(schedule3040, new Date("2026-04-07T10:05:00+08:00"))
  const pendingDuringRun = await pendingStore.list()
  assert.equal(pendingDuringRun.length, 2)
  assert.equal(pendingDuringRun[0].status, "running")
  assert.equal(pendingDuringRun[1].status, "pending")

  skillRunner.resolve({
    runId: "run_1",
    result: { status: "completed", data: { ok: true }, steps: [] },
  })
  await confirmPromise

  const finalItems = await pendingStore.list()
  assert.equal(finalItems[0].status, "completed")
  assert.equal(finalItems[1].status, "pending")
  assert.ok(pendingExecutionHandler.calls >= 3)
})



