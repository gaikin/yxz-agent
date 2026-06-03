import test from "node:test"
import assert from "node:assert/strict"
import {
  AssistantWindowPage,
  AssistantWindowService,
} from "../webapp/src/pages/Assistant"
import {
  PopupPageService,
  getPopupPageServiceFromHost,
  ScheduleConfirmationPopup,
} from "../webapp/src/pages/Popup"
import {
  DcfRuntimeService,
  initializeDcfRuntime,
} from "../subprocess/service/DcfRuntimeService"
import type { PopupScheduleExecutionOverviewUpdatedEvent } from "../share/protocol"
import type { RumJsCacheApi } from "../subprocess/service/common/rumJsJsonStore"

class MemoryRumJsCache implements RumJsCacheApi {
  private readonly map = new Map<string, string>()

  async readCacheFileAsync(args: { fileName: string }): Promise<string | undefined> {
    return this.map.get(args.fileName)
  }

  async writeCacheFileAsync(args: { fileName: string; content: string }): Promise<void> {
    this.map.set(args.fileName, args.content)
  }
}

class FakeBridgeJs {
  listeners = new Map<string, (message: { data?: string[] }) => void>()
  pageInitData: unknown = undefined
  sentMessages: Array<{ windowId: string; channel: string; data: string }> = []

  listen(channel: string, listener: (message: { data?: string[] }) => void): void {
    this.listeners.set(channel, listener)
  }

  sendToWindow(windowId: string, channel: string, data: string): void {
    this.sentMessages.push({ windowId, channel, data })
  }

  getPageInitData<T>(): T {
    return this.pageInitData as T
  }
}

function installFakeBridge() {
  const fakeBridge = new FakeBridgeJs()
  const originalBridge = (globalThis as Record<string, unknown>).BridgeJs
  const originalBridgeUpper = (globalThis as Record<string, unknown>).BridgeJS
  const originalGetWinidsMap = (globalThis as Record<string, unknown>).getWinidsMap
  const originalSocket = (globalThis as Record<string, unknown>).socket

  ;(globalThis as Record<string, unknown>).BridgeJs = fakeBridge
  ;(globalThis as Record<string, unknown>).BridgeJS = fakeBridge
  ;(globalThis as Record<string, unknown>).getWinidsMap = async () => ({ dcf: "dcf-window-id" })
  ;(globalThis as Record<string, unknown>).socket = undefined

  return {
    fakeBridge,
    restore() {
      ;(globalThis as Record<string, unknown>).BridgeJs = originalBridge
      ;(globalThis as Record<string, unknown>).BridgeJS = originalBridgeUpper
      ;(globalThis as Record<string, unknown>).getWinidsMap = originalGetWinidsMap
      ;(globalThis as Record<string, unknown>).socket = originalSocket
    },
  }
}

test("assistant window service exposes subscribe/getViewModel for react ui", () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    const service = new AssistantWindowService("device-001")
    let notifications = 0
    const unsubscribe = service.subscribe(() => {
      notifications += 1
    })

    fakeBridge.listeners.get("assistant_window")?.({
      data: [
        JSON.stringify({
          type: "BOOTSTRAP_STATE",
          deviceId: "device-001",
          automationAuthorization: { authorized: false },
          dcfRuntime: {
            dcfStatus: "online",
            scheduleSubsystemReady: true,
          },
          sentAt: new Date().toISOString(),
        }),
      ],
    })

    assert.equal(notifications, 1)
    assert.equal(service.getViewModel().shouldShowAutomationAuthorization, true)

    unsubscribe()
  } finally {
    restore()
  }
})

test("popup page service exposes imperative getViewModel flow for react ui", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    const service = new PopupPageService({ deviceId: "device-001" })

    const event: PopupScheduleExecutionOverviewUpdatedEvent = {
      type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
      deviceId: "device-001",
      overview: {
        pendingCount: 1,
        items: [
          {
            executionId: "exec_1",
            scheduleId: "schedule_3040_daily",
            scheduleName: "3040每日查询",
            requestedAt: "2026-04-08T02:00:00.000Z",
            status: "pending",
          },
        ],
        updatedAt: "2026-04-08T02:00:00.000Z",
      },
      sentAt: "2026-04-08T02:00:00.000Z",
    }

    fakeBridge.listeners.get("schedule_popup")?.({
      data: [JSON.stringify(event)],
    })

    assert.equal(service.getViewModel().mode, "pending")
    const nextViewModel = await service.dismissAll()
    assert.equal(nextViewModel.mode, "hidden")
  } finally {
    restore()
  }
})

test("react popup exports are available for direct integration", () => {
  assert.equal(typeof ScheduleConfirmationPopup, "function")
  assert.equal(typeof AssistantWindowPage, "function")
})

test("host popup page service reads deviceId from BridgeJS page init data", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    fakeBridge.pageInitData = {
      deviceId: "device-from-page-init",
      dcfWindowId: "dcf-window-from-page-init",
      overview: {
        pendingCount: 1,
        items: [
          {
            executionId: "exec_host_init_1",
            scheduleId: "schedule_3040_daily",
            scheduleName: "3040每日查询",
            requestedAt: "2026-04-08T02:00:00.000Z",
            status: "pending",
          },
        ],
        updatedAt: "2026-04-08T02:00:00.000Z",
      },
    }

    const service = await getPopupPageServiceFromHost()
    assert.equal(service.getViewModel().mode, "pending")

    await service.confirmAll()

    assert.equal(fakeBridge.sentMessages.length, 1)
    assert.equal(fakeBridge.sentMessages[0].windowId, "dcf-window-from-page-init")
    assert.equal(fakeBridge.sentMessages[0].channel, "schedule_popup")
    assert.equal(
      JSON.parse(fakeBridge.sentMessages[0].data).deviceId,
      "device-from-page-init"
    )

  } finally {
    restore()
  }
})

test("popup page service sends popup events through BridgeJs channel", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    fakeBridge.pageInitData = {
      deviceId: "device-from-socket",
    }

    const service = new PopupPageService({ deviceId: "device-from-socket" })
    service.getViewModel()

    fakeBridge.listeners.get("schedule_popup")?.({
      data: [
        JSON.stringify({
          type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
          deviceId: "device-from-socket",
          overview: {
            pendingCount: 1,
            items: [
              {
                executionId: "exec_socket_1",
                scheduleId: "schedule_3040_daily",
                scheduleName: "3040每日查询",
                requestedAt: "2026-04-08T02:00:00.000Z",
                status: "pending",
              },
            ],
            updatedAt: "2026-04-08T02:00:00.000Z",
          },
          sentAt: "2026-04-08T02:00:00.000Z",
        }),
      ],
    })

    await service.confirmAll()

    assert.equal(fakeBridge.sentMessages.length, 1)
    assert.equal(fakeBridge.sentMessages[0].channel, "schedule_popup")
    assert.equal(
      JSON.parse(fakeBridge.sentMessages[0].data).type,
      "CONFIRM_ALL_SCHEDULE_EXECUTIONS"
    )
  } finally {
    restore()
  }
})

test("assistant window service sends authorization event through BridgeJs channel", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    const service = new AssistantWindowService("device-assistant")
    await service.confirmAutomationAuthorization()

    assert.equal(fakeBridge.sentMessages.length, 1)
    assert.equal(fakeBridge.sentMessages[0].channel, "assistant_window")
    assert.equal(JSON.parse(fakeBridge.sentMessages[0].data).type, "AUTHORIZE_AUTOMATION")
  } finally {
    restore()
  }
})

test("assistant window service can trigger current schedule through BridgeJs channel", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    const service = new AssistantWindowService("device-assistant")
    await service.triggerCurrentScheduleNow()

    assert.equal(fakeBridge.sentMessages.length, 1)
    assert.equal(fakeBridge.sentMessages[0].channel, "assistant_window")
    assert.equal(JSON.parse(fakeBridge.sentMessages[0].data).type, "TRIGGER_SCHEDULE")
    assert.equal(JSON.parse(fakeBridge.sentMessages[0].data).scheduleId, "schedule_3040_daily")
  } finally {
    restore()
  }
})

test("dcf runtime service initializes and handles request-event actions", async () => {
  const openedWindows: Array<{
    x: number
    y: number
    width: number
    height: number
    pageInitParam: string
    title: string
    hash: string
    name: string
  }> = []
  const service = new DcfRuntimeService(
    {},
    {
      workspaceRoot: process.cwd(),
      deviceId: "device-service",
      publishFrontendEvent: async () => {},
      publishPopupEvent: async () => {},
      toolTransport: {
        async send() {
          return { result: { content: [{ type: "text", text: "{}" }] } }
        },
        close() {},
      },
      windowService: {
        async openYxzWinByOptions(options) {
          openedWindows.push(options)
        },
      },
      popupWindowOptions: {
        x: 900,
        y: 520,
        width: 420,
        height: 360,
        title: "营小助弹窗",
        hash: "/agent/popup",
        name: "yxz-popup-window",
      },
    }
  )

  await service.init()

  assert.equal(await service.requestScheduleState("device-001"), true)

  assert.equal(await service.triggerSchedule("schedule_3040_daily"), true)
  assert.equal(openedWindows.length, 1)
  assert.equal(openedWindows[0].x, 900)
  assert.equal(openedWindows[0].y, 520)
  assert.equal(openedWindows[0].width, 420)
  assert.equal(openedWindows[0].height, 360)
  assert.equal(openedWindows[0].title, "营小助弹窗")
  assert.equal(openedWindows[0].hash, "/agent/popup")
  assert.equal(openedWindows[0].name, "yxz-popup-window")
  const pageInitData = JSON.parse(openedWindows[0].pageInitParam) as {
    deviceId: string
    overview: { pendingCount: number }
  }
  assert.equal(pageInitData.deviceId, "device-service")
  assert.equal(pageInitData.overview.pendingCount, 1)
  await service.getInternalRuntime().scheduleTimerService.stop()
})

test("initializeDcfRuntime extracts service initialization flow", async () => {
  const openedOverviews: Array<{ pendingCount: number }> = []

  const runtime = await initializeDcfRuntime(
    {
      workspaceRoot: process.cwd(),
      deviceId: "device-helper",
      publishFrontendEvent: async () => {},
      publishPopupEvent: async () => {},
      toolTransport: {
        async send() {
          return { result: { content: [{ type: "text", text: "{}" }] } }
        },
        close() {},
      },
    },
    {
      openPendingOverview: async (overview) => {
        openedOverviews.push({ pendingCount: overview.pendingCount })
      },
    }
  )

  await runtime.scheduleTimerService.trigger(
    {
      scheduleId: "schedule_3040_daily",
      name: "3040每日查询",
      cronExpression: "0 0 10 * * *",
      timezone: "Asia/Shanghai",
      skillId: "query_3040_today",
    },
    new Date("2026-04-09T10:00:00+08:00")
  )

  assert.equal(openedOverviews.length, 1)
  assert.equal(openedOverviews[0].pendingCount, 1)
  await runtime.scheduleTimerService.stop()
})

test("initializeDcfRuntime can publish events through sendEventByWinId bridge", async () => {
  const sentEvents: Array<{ winId: string; channel: string; data: string }> = []

  const runtime = await initializeDcfRuntime({
    workspaceRoot: process.cwd(),
    deviceId: "device-bridge",
    frontendWindowId: "assistant-win-id",
    popupWindowId: "popup-win-id",
    windowEventBridge: {
      async sendEventByWinId(winId, channel, data) {
        sentEvents.push({ winId, channel, data })
      },
    },
    toolTransport: {
      async send() {
        return { result: { content: [{ type: "text", text: "{}" }] } }
      },
      close() {},
    },
  })

  sentEvents.length = 0

  await runtime.frontendChannelService.publishBootstrapState()
  await runtime.popupChannelService.notify({
    pendingCount: 1,
    items: [],
    updatedAt: "2026-04-09 10:00:00",
  })

  assert.equal(sentEvents.length, 2)
  assert.equal(sentEvents[0].winId, "assistant-win-id")
  assert.equal(sentEvents[0].channel, "assistant_window")
  assert.equal(JSON.parse(sentEvents[0].data).type, "BOOTSTRAP_STATE")
  assert.equal(sentEvents[1].winId, "popup-win-id")
  assert.equal(sentEvents[1].channel, "schedule_popup")
  assert.equal(JSON.parse(sentEvents[1].data).type, "SCHEDULE_EXECUTION_OVERVIEW_UPDATED")
  await runtime.scheduleTimerService.stop()
})



