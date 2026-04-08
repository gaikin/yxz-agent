import test from "node:test"
import assert from "node:assert/strict"
import { ScheduleExecutionCoordinator } from "../dcf-subprocess/scheduler/scheduleExecutionCoordinator"
import {
  SchedulePendingExecutionStore,
  ScheduleRunRecordStore,
  ScheduleRuntimeStore,
} from "../dcf-subprocess/scheduler/stores"
import type {
  FrontendEventPublisher,
  PendingExecutionNotifier,
  PopupEventPublisher,
  ScheduleDefinition,
} from "../dcf-subprocess/scheduler/types"
import type { SkillExecutionResult } from "../dcf-subprocess/skills/types"
import type { ScheduleExecutionOverview } from "../types/appProtocol"
import type { RumJsCacheApi } from "../dcf-subprocess/common/rumJsJsonStore"

class MemoryPopupPublisher implements PopupEventPublisher, PendingExecutionNotifier {
  calls = 0

  async publishOverview(): Promise<void> {
    this.calls += 1
  }

  async notify(_overview: ScheduleExecutionOverview): Promise<void> {
    this.calls += 1
  }
}

class MemoryFrontendPublisher implements FrontendEventPublisher {
  enabledEvents: Array<{ scheduleId: string; nextTriggerAt?: string }> = []
  disabledEvents: string[] = []

  async publishBootstrapState(): Promise<void> {}
  async publishAutomationAuthorized(): Promise<void> {}
  async publishScheduleStateSnapshot(): Promise<void> {}

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

async function createCoordinator() {
  const cache = new MemoryRumJsCache()
  const pendingStore = new SchedulePendingExecutionStore(cache, "pending.json")
  const runRecordStore = new ScheduleRunRecordStore(cache, "records.json")
  const runtimeStore = new ScheduleRuntimeStore(cache, "runtime.json")
  const popupPublisher = new MemoryPopupPublisher()
  const frontendPublisher = new MemoryFrontendPublisher()
  const skillRunner = new DeferredSkillRunner()

  const coordinator = new ScheduleExecutionCoordinator(
    pendingStore,
    runRecordStore,
    runtimeStore,
    popupPublisher,
    frontendPublisher,
    skillRunner as never
  )

  return {
    coordinator,
    pendingStore,
    runRecordStore,
    runtimeStore,
    popupPublisher,
    frontendPublisher,
    skillRunner,
  }
}

const schedule3040: ScheduleDefinition = {
  scheduleId: "schedule_3040_daily",
  name: "3040每日查询",
  cronExpression: "0 0 9 * * *",
  timezone: "Asia/Shanghai",
  skillId: "query_3040_today",
}

test("onScheduleDue creates pending item and updates overview", async () => {
  const { coordinator, pendingStore, popupPublisher, runtimeStore } = await createCoordinator()

  await coordinator.onScheduleDue(schedule3040, new Date("2026-04-07T09:00:00+08:00"))

  const items = await pendingStore.list()
  assert.equal(items.length, 1)
  assert.equal(items[0].status, "pending")
  assert.equal(popupPublisher.calls, 1)

  const runtime = await runtimeStore.get(schedule3040.scheduleId)
  assert.equal(runtime?.lastTriggeredAt, "2026-04-07T01:00:00.000Z")
})

test("dismissAll marks shown items as skipped and updates runtime", async () => {
  const { coordinator, pendingStore, runtimeStore, runRecordStore } = await createCoordinator()

  await coordinator.onScheduleDue(schedule3040, new Date("2026-04-07T09:00:00+08:00"))
  const [item] = await pendingStore.list()

  await coordinator.dismissAll([item.executionId])

  const [updated] = await pendingStore.list()
  assert.equal(updated.status, "skipped")
  const runtime = await runtimeStore.get(schedule3040.scheduleId)
  assert.equal(runtime?.lastStatus, "skipped")
  const records = await runRecordStore.list()
  assert.equal(records[0].status, "skipped")
})

test("confirmAll uses snapshot only and keeps new due items pending", async () => {
  const { coordinator, pendingStore, popupPublisher, skillRunner } = await createCoordinator()

  await coordinator.onScheduleDue(schedule3040, new Date("2026-04-07T09:00:00+08:00"))
  const [first] = await pendingStore.list()

  const confirmPromise = coordinator.confirmAll([first.executionId], [schedule3040])
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const items = await pendingStore.list()
    if (items[0]?.status === "running") {
      break
    }
    await new Promise((resolve) => setImmediate(resolve))
  }

  await coordinator.onScheduleDue(schedule3040, new Date("2026-04-07T09:05:00+08:00"))
  const pendingDuringRun = await pendingStore.list()
  assert.equal(pendingDuringRun.length, 2)
  assert.equal(pendingDuringRun[0].status, "running")
  assert.equal(pendingDuringRun[1].status, "pending")

  skillRunner.resolve({
    runId: "run_1",
    result: { status: "completed", data: { ok: true } },
  })
  await confirmPromise

  const finalItems = await pendingStore.list()
  assert.equal(finalItems[0].status, "completed")
  assert.equal(finalItems[1].status, "pending")
  assert.ok(popupPublisher.calls >= 3)
})
