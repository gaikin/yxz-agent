import test from "node:test"
import assert from "node:assert/strict"
import { bootstrapAssistantWindow } from "../webapp/src/assistant/bootstrapAssistantWindow"
import { bootstrapPopup } from "../webapp/src/popup/bootstrapPopup"
import { bootstrapDcf } from "../dcf/runtime/bootstrap"
import type { RumJsCacheApi } from "../dcf/common/rumJsJsonStore"

class FakeBridgeJs {
  listeners = new Map<string, (message: { data?: string[] }) => void>()

  listen(channel: string, listener: (message: { data?: string[] }) => void): void {
    this.listeners.set(channel, listener)
  }

  sendToWindow(): void {}
}

class FakeWindowIdResolver {
  async getDcfWindowId(): Promise<string> {
    return "dcf-window-id"
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

test("assistant window bootstrap wires event dispatching", () => {
  const fakeBridge = new FakeBridgeJs()
  const fakeWindow = {
    BridgeJs: fakeBridge,
    getWinidsMap: async () => ({ dcf: "dcf-window-id" }),
  }

  const originalBridge = (globalThis as Record<string, unknown>).BridgeJs
  const originalGetWinidsMap = (globalThis as Record<string, unknown>).getWinidsMap
  ;(globalThis as Record<string, unknown>).BridgeJs = fakeWindow.BridgeJs
  ;(globalThis as Record<string, unknown>).getWinidsMap = fakeWindow.getWinidsMap

  try {
    const result = bootstrapAssistantWindow("device-001")
    const listener = fakeBridge.listeners.get("assistant_window")
    assert.ok(listener)

    listener?.({
      data: [
        JSON.stringify({
          type: "BOOTSTRAP_STATE",
          deviceId: "device-001",
          automationAuthorization: { authorized: true },
          dcfRuntime: {
            dcfStatus: "online",
            scheduleSubsystemReady: true,
          },
          sentAt: new Date().toISOString(),
        }),
      ],
    })

    assert.equal(result.scheduleStore.getState().automationAuthorization.authorized, true)
  } finally {
    ;(globalThis as Record<string, unknown>).BridgeJs = originalBridge
    ;(globalThis as Record<string, unknown>).getWinidsMap = originalGetWinidsMap
  }
})

test("popup bootstrap wires popup overview dispatching", () => {
  const fakeBridge = new FakeBridgeJs()
  const fakeWindow = {
    BridgeJs: fakeBridge,
    getWinidsMap: async () => ({ dcf: "dcf-window-id" }),
  }

  const originalBridge = (globalThis as Record<string, unknown>).BridgeJs
  const originalGetWinidsMap = (globalThis as Record<string, unknown>).getWinidsMap
  ;(globalThis as Record<string, unknown>).BridgeJs = fakeWindow.BridgeJs
  ;(globalThis as Record<string, unknown>).getWinidsMap = fakeWindow.getWinidsMap

  try {
    const result = bootstrapPopup("device-001")
    const listener = fakeBridge.listeners.get("schedule_popup")
    assert.ok(listener)

    listener?.({
      data: [
        JSON.stringify({
          type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
          deviceId: "device-001",
          overview: {
            pendingCount: 1,
            items: [
              {
                executionId: "exec_1",
                scheduleId: "schedule_3040_daily",
                scheduleName: "3040每日查询",
                requestedAt: new Date().toISOString(),
                status: "pending",
              },
            ],
            updatedAt: new Date().toISOString(),
          },
          sentAt: new Date().toISOString(),
        }),
      ],
    })

    assert.equal(result.popupExecutionStore.getState().mode, "pending")
  } finally {
    ;(globalThis as Record<string, unknown>).BridgeJs = originalBridge
    ;(globalThis as Record<string, unknown>).getWinidsMap = originalGetWinidsMap
  }
})

test("dcf bootstrap publishes bootstrap state using rumJs cache backed stores", async () => {
  const frontendEvents: unknown[] = []
  const popupEvents: unknown[] = []

  const runtime = await bootstrapDcf({
    workspaceRoot: process.cwd(),
    frontendSink: {
      async publish(event) {
        frontendEvents.push(event)
      },
    },
    popupSink: {
      async publish(event) {
        popupEvents.push(event)
      },
    },
    toolTransport: {
      async send() {
        return {
          result: {
            content: [{ type: "text", text: "{}" }],
          },
        }
      },
    },
    rumJsCache: new MemoryRumJsCache(),
  })

  assert.ok(runtime)
  assert.equal(frontendEvents.length, 1)
  assert.equal((frontendEvents[0] as { type: string }).type, "BOOTSTRAP_STATE")
  assert.equal(popupEvents.length, 0)
})

test("dcf bootstrap supports host pending execution callback together with popup publishing", async () => {
  const frontendEvents: unknown[] = []
  const popupEvents: unknown[] = []
  const hostOverviews: unknown[] = []

  const runtime = await bootstrapDcf({
    workspaceRoot: process.cwd(),
    frontendSink: {
      async publish(event) {
        frontendEvents.push(event)
      },
    },
    popupSink: {
      async publish(event) {
        popupEvents.push(event)
      },
    },
    toolTransport: {
      async send() {
        return {
          result: {
            content: [{ type: "text", text: "{}" }],
          },
        }
      },
    },
    rumJsCache: new MemoryRumJsCache(),
    hostPendingExecutionCallback: {
      async onPendingExecutionsUpdated(overview) {
        hostOverviews.push(overview)
      },
    },
  })

  await runtime.schedulerManager.trigger(
    {
      scheduleId: "schedule_3040_daily",
      name: "3040每日查询",
      cronExpression: "0 0 10 * * *",
      timezone: "Asia/Shanghai",
      skillId: "query_3040_today",
    },
    new Date("2026-04-07T10:00:00+08:00")
  )

  assert.equal(frontendEvents.length >= 1, true)
  assert.equal(popupEvents.length, 1)
  assert.equal(hostOverviews.length, 1)
})

test("dcf bootstrap restores enabled schedules after restart", async () => {
  const cache = new MemoryRumJsCache()
  await cache.writeCacheFileAsync({
    fileName: "automation-authorization.json",
    content: JSON.stringify({ authorized: true, authorizedAt: "2026-04-07T02:00:00.000Z" }),
  })
  await cache.writeCacheFileAsync({
    fileName: "schedule-runtime.json",
    content: JSON.stringify({
      schedule_3040_daily: {
        scheduleId: "schedule_3040_daily",
        enabled: true,
        lastStatus: "enabled",
      },
    }),
  })

  const runtime = await bootstrapDcf({
    workspaceRoot: process.cwd(),
    frontendSink: {
      async publish() {},
    },
    popupSink: {
      async publish() {},
    },
    toolTransport: {
      async send() {
        return {
          result: {
            content: [{ type: "text", text: "{}" }],
          },
        }
      },
    },
    rumJsCache: cache,
  })

  const nextTriggerAt = runtime.schedulerManager.getNextTriggerAt("schedule_3040_daily")
  assert.ok(nextTriggerAt)

  const runtimeState = await runtime.scheduleRuntimeStore.get("schedule_3040_daily")
  assert.equal(runtimeState?.enabled, true)
  assert.equal(runtimeState?.nextTriggerAt, nextTriggerAt)

  await runtime.schedulerManager.stop()
})

test("dcf bootstrap can use a transport factory so each run gets a fresh transport", async () => {
  const createdTransports: number[] = []

  const runtime = await bootstrapDcf({
    workspaceRoot: process.cwd(),
    frontendSink: {
      async publish() {},
    },
    popupSink: {
      async publish() {},
    },
    toolTransportFactory: {
      create() {
        createdTransports.push(createdTransports.length + 1)
        return {
          async send() {
            return {
              result: {
                content: [{ type: "text", text: "{}" }],
              },
            }
          },
        }
      },
    },
    rumJsCache: new MemoryRumJsCache(),
  })

  await runtime.scheduleExecutionCoordinator.confirmAll(
    [
      "exec-1",
      "exec-2",
    ],
    [
      {
        scheduleId: "schedule_3040_daily",
        name: "3040每日查询",
        cronExpression: "0 0 10 * * *",
        timezone: "Asia/Shanghai",
        skillId: "query_3040_today",
      },
    ]
  )

  assert.equal(createdTransports.length, 0)

  await runtime.schedulerManager.trigger(
    {
      scheduleId: "schedule_3040_daily",
      name: "3040每日查询",
      cronExpression: "0 0 10 * * *",
      timezone: "Asia/Shanghai",
      skillId: "query_3040_today",
    },
    new Date("2026-04-07T10:00:00+08:00")
  )

  const pendingItems = await runtime.schedulePendingExecutionStore.list()
  await runtime.scheduleExecutionCoordinator.confirmAll(
    pendingItems.map((item) => item.executionId),
    [
      {
        scheduleId: "schedule_3040_daily",
        name: "3040每日查询",
        cronExpression: "0 0 10 * * *",
        timezone: "Asia/Shanghai",
        skillId: "query_3040_today",
      },
    ]
  )

  await runtime.schedulerManager.trigger(
    {
      scheduleId: "schedule_3040_daily",
      name: "3040每日查询",
      cronExpression: "0 0 10 * * *",
      timezone: "Asia/Shanghai",
      skillId: "query_3040_today",
    },
    new Date("2026-04-07T10:05:00+08:00")
  )

  const secondPendingItems = await runtime.schedulePendingExecutionStore.list()
  await runtime.scheduleExecutionCoordinator.confirmAll(
    secondPendingItems
      .filter((item) => item.status === "pending")
      .map((item) => item.executionId),
    [
      {
        scheduleId: "schedule_3040_daily",
        name: "3040每日查询",
        cronExpression: "0 0 10 * * *",
        timezone: "Asia/Shanghai",
        skillId: "query_3040_today",
      },
    ]
  )

  assert.equal(createdTransports.length, 2)
})

