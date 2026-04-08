import test from "node:test"
import assert from "node:assert/strict"
import {
  createAssistantRuntime,
} from "../webapp/src/assistant/assistantRuntime"
import { createPopupRuntime } from "../webapp/src/popup/popupRuntime"
import {
  getPopupRuntimeFromHost,
  ScheduleConfirmationPopup,
} from "../webapp/src/react"
import {
  YXZ_EXTENSION_TARGET,
  YXZ_FRONTEND_EVENT_URL,
  YXZ_POPUP_EVENT_URL,
} from "../shared/hostRoutes"
import { YxzExtensionService } from "../service/YxzExtensionService"
import type { PopupScheduleExecutionOverviewUpdatedEvent } from "../types/frontendProtocol"
import type { RumJsCacheApi } from "../dcf/common/rumJsJsonStore"

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

test("assistant runtime exposes subscribe/getViewModel for react ui", () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    const runtime = createAssistantRuntime("device-001")
    let notifications = 0
    const unsubscribe = runtime.subscribe(() => {
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
    assert.equal(runtime.getViewModel().shouldShowAutomationAuthorization, true)

    unsubscribe()
  } finally {
    restore()
  }
})

test("popup runtime exposes imperative getViewModel flow for react ui", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    const runtime = createPopupRuntime("device-001")

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

    assert.equal(runtime.getViewModel().mode, "pending")
    const nextViewModel = await runtime.dismissAll()
    assert.equal(nextViewModel.mode, "hidden")
  } finally {
    restore()
  }
})

test("react popup exports are available for direct integration", () => {
  assert.equal(typeof ScheduleConfirmationPopup, "function")
})

test("host popup runtime reads deviceId from BridgeJS page init data", async () => {
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

    const runtime = await getPopupRuntimeFromHost()
    assert.equal(runtime.getViewModel().mode, "pending")

    await runtime.confirmAll()

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

test("popup runtime prefers global socket requests when available", async () => {
  const { fakeBridge, restore } = installFakeBridge()

  try {
    fakeBridge.pageInitData = {
      deviceId: "device-from-socket",
    }

    const socketCalls: Array<{ url: string; options?: unknown[]; target: string }> = []
    ;(globalThis as Record<string, unknown>).socket = {
      async sendRequest<T>(request: { url: string; options?: unknown[]; target: string }) {
        socketCalls.push(request)
        return true as T
      },
    }

    const runtime = createPopupRuntime("device-from-socket")
    runtime.getViewModel()

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

    await runtime.confirmAll()

    assert.equal(socketCalls.length, 1)
    assert.equal(socketCalls[0].url, YXZ_POPUP_EVENT_URL)
    assert.equal(socketCalls[0].target, YXZ_EXTENSION_TARGET)
    assert.equal((socketCalls[0].options?.[0] as { type: string }).type, "CONFIRM_ALL_SCHEDULE_EXECUTIONS")
    assert.equal(fakeBridge.sentMessages.length, 0)
  } finally {
    restore()
  }
})

test("assistant runtime prefers global socket requests when available", async () => {
  const { restore } = installFakeBridge()

  try {
    const socketCalls: Array<{ url: string; options?: unknown[]; target: string }> = []
    ;(globalThis as Record<string, unknown>).socket = {
      async sendRequest<T>(request: { url: string; options?: unknown[]; target: string }) {
        socketCalls.push(request)
        return true as T
      },
    }

    const runtime = createAssistantRuntime("device-assistant")
    await runtime.confirmAutomationAuthorization()

    assert.equal(socketCalls.length, 1)
    assert.equal(socketCalls[0].url, YXZ_FRONTEND_EVENT_URL)
    assert.equal(socketCalls[0].target, YXZ_EXTENSION_TARGET)
    assert.equal((socketCalls[0].options?.[0] as { type: string }).type, "AUTHORIZE_AUTOMATION")
  } finally {
    restore()
  }
})

test("yxz extension service initializes and forwards events", async () => {
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
  const service = new YxzExtensionService(
    {},
    {
      workspaceRoot: process.cwd(),
      deviceId: "device-service",
      frontendSink: {
        async publish() {},
      },
      popupSink: {
        async publish() {},
      },
      toolTransport: {
        async send() {
          return { result: { content: [{ type: "text", text: "{}" }] } }
        },
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

  assert.equal(await service.handleFrontendEvent({
    type: "SCHEDULE_STATE",
    deviceId: "device-001",
    sentAt: new Date().toISOString(),
  }), true)

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
})

