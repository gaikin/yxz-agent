import type { PopupPageInitData } from "../../share/hostTypes"
import {
  YXZ_AUTHORIZE_AUTOMATION_URL,
  YXZ_POPUP_CONFIRM_ALL_URL,
  YXZ_POPUP_DISMISS_ALL_URL,
  YXZ_SCHEDULE_DISABLE_URL,
  YXZ_SCHEDULE_ENABLE_URL,
  YXZ_SCHEDULE_STATE_URL,
  YXZ_TRIGGER_SCHEDULE_URL,
} from "../../share/hostRoutes"
import { formatNow, parseDateTime } from "../../share/dateTime"
import type { ScheduleExecutionOverview } from "../../share/protocol"
import {
  bootstrapDcf,
  type DcfBootstrapDependencies,
  type DcfRuntime,
} from "./bootstrap"

const HostControllerBase = (globalThis.ControllerAbstract ??
  class {
    constructor(_socketServer: unknown) {}
  }) as new (socketServer: unknown) => object
const requestEvent: RequestEventDecorator = globalThis.requestEvent ?? (() => () => {})

export interface PopupWindowOpenOptions {
  x: number
  y: number
  width: number
  height: number
  pageInitParam: string
  title: string
  hash: string
  name: string
}

export interface WindowService {
  openYxzWinByOptions(options: PopupWindowOpenOptions): Promise<void> | void
}

export interface WindowEventBridge {
  sendEventByWinId(
    winId: string,
    channel: string,
    data: string
  ): Promise<void> | void
}

type FrontendEventPublisher = DcfBootstrapDependencies["publishFrontendEvent"]
type PopupEventPublisher = DcfBootstrapDependencies["publishPopupEvent"]

export interface DcfRuntimeServiceOptions
  extends Omit<DcfBootstrapDependencies, "publishFrontendEvent" | "publishPopupEvent"> {
  publishFrontendEvent?: FrontendEventPublisher
  publishPopupEvent?: PopupEventPublisher
  windowService?: WindowService
  windowEventBridge?: WindowEventBridge
  frontendWindowId?: string
  popupWindowId?: string
  popupWindowOptions?: Partial<Omit<PopupWindowOpenOptions, "pageInitParam">>
}

export interface InitializeDcfRuntimeOptions {
  deviceId?: string
  openPendingOverview?: (
    overview: ScheduleExecutionOverview
  ) => Promise<void> | void
}

export async function initializeDcfRuntime(
  serviceOptions: DcfRuntimeServiceOptions,
  options: InitializeDcfRuntimeOptions = {}
): Promise<DcfRuntime> {
  const deviceId = options.deviceId ?? serviceOptions.deviceId ?? "device-001"
  const publishFrontendEvent =
    serviceOptions.publishFrontendEvent ??
    createFrontendWindowEventPublisher(
      serviceOptions.windowEventBridge,
      serviceOptions.frontendWindowId,
      "assistant_window"
    ) ??
    (async () => {})
  const publishPopupEvent =
    serviceOptions.publishPopupEvent ??
    createPopupWindowEventPublisher(
      serviceOptions.windowEventBridge,
      serviceOptions.popupWindowId,
      "schedule_popup"
    ) ??
    (async () => {})

  return bootstrapDcf({
    ...serviceOptions,
    deviceId,
    onPendingExecutionsUpdated: async (overview) => {
      await Promise.resolve(serviceOptions.onPendingExecutionsUpdated?.(overview))
      await Promise.resolve(options.openPendingOverview?.(overview))
    },
    publishFrontendEvent: publishFrontendEvent,
    publishPopupEvent: publishPopupEvent,
  })
}

function createFrontendWindowEventPublisher(
  bridge: WindowEventBridge | undefined,
  winId: string | undefined,
  channel: string
): FrontendEventPublisher | undefined {
  if (!bridge || !winId) {
    return undefined
  }

  return async (event) => {
    await Promise.resolve(bridge.sendEventByWinId(winId, channel, JSON.stringify(event)))
  }
}

function createPopupWindowEventPublisher(
  bridge: WindowEventBridge | undefined,
  winId: string | undefined,
  channel: string
): PopupEventPublisher | undefined {
  if (!bridge || !winId) {
    return undefined
  }

  return async (event) => {
    await Promise.resolve(bridge.sendEventByWinId(winId, channel, JSON.stringify(event)))
  }
}

export class DcfRuntimeService extends HostControllerBase {
  private runtime?: DcfRuntime
  private readonly deviceId: string

  constructor(
    socketServer: unknown,
    private readonly options: DcfRuntimeServiceOptions
  ) {
    super(socketServer)
    this.deviceId = options.deviceId ?? "device-001"
  }

  async init(): Promise<void> {
    this.runtime = await initializeDcfRuntime(this.options, {
      deviceId: this.deviceId,
      openPendingOverview: (overview) => this.openPendingOverview(overview),
    })
  }

  @requestEvent(YXZ_AUTHORIZE_AUTOMATION_URL)
  async authorizeAutomation(deviceId = this.deviceId): Promise<boolean> {
    await this.getRuntime().receiveFrontendEvent({
      type: "AUTHORIZE_AUTOMATION",
      deviceId,
      sentAt: formatNow(),
    })
    return true
  }

  @requestEvent(YXZ_SCHEDULE_STATE_URL)
  async requestScheduleState(deviceId = this.deviceId): Promise<boolean> {
    await this.getRuntime().receiveFrontendEvent({
      type: "SCHEDULE_STATE",
      deviceId,
      sentAt: formatNow(),
    })
    return true
  }

  @requestEvent(YXZ_SCHEDULE_ENABLE_URL)
  async enableSchedule(scheduleId: string, deviceId = this.deviceId): Promise<boolean> {
    await this.getRuntime().receiveFrontendEvent({
      type: "SCHEDULE_ENABLE",
      deviceId,
      scheduleId,
      sentAt: formatNow(),
    })
    return true
  }

  @requestEvent(YXZ_SCHEDULE_DISABLE_URL)
  async disableSchedule(scheduleId: string, deviceId = this.deviceId): Promise<boolean> {
    await this.getRuntime().receiveFrontendEvent({
      type: "SCHEDULE_DISABLE",
      deviceId,
      scheduleId,
      sentAt: formatNow(),
    })
    return true
  }

  @requestEvent(YXZ_POPUP_CONFIRM_ALL_URL)
  async confirmAllScheduleExecutions(
    executionIds: string[],
    deviceId = this.deviceId
  ): Promise<boolean> {
    await this.getRuntime().receivePopupEvent({
      type: "CONFIRM_ALL_SCHEDULE_EXECUTIONS",
      deviceId,
      executionIds,
      sentAt: formatNow(),
    })
    return true
  }

  @requestEvent(YXZ_POPUP_DISMISS_ALL_URL)
  async dismissAllScheduleExecutions(
    executionIds: string[],
    deviceId = this.deviceId
  ): Promise<boolean> {
    await this.getRuntime().receivePopupEvent({
      type: "DISMISS_ALL_SCHEDULE_EXECUTIONS",
      deviceId,
      executionIds,
      sentAt: formatNow(),
    })
    return true
  }

  private async triggerScheduleInternal(scheduleId: string, requestedAt?: string): Promise<void> {
    const runtime = this.getRuntime()
    const schedule = await runtime.scheduleDefinitionService.get(scheduleId)
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`)
    }

    await runtime.scheduleTimerService.trigger(
      schedule,
      requestedAt ? parseDateTime(requestedAt) : undefined
    )
  }

  @requestEvent(YXZ_TRIGGER_SCHEDULE_URL)
  async triggerSchedule(scheduleId: string, requestedAt?: string): Promise<boolean> {
    await this.triggerScheduleInternal(scheduleId, requestedAt)
    return true
  }

  getInternalRuntime(): DcfRuntime {
    return this.getRuntime()
  }

  private async openPendingOverview(overview: ScheduleExecutionOverview): Promise<void> {
    if (!this.options.windowService || overview.pendingCount === 0) {
      return
    }

    const pageInitData: PopupPageInitData = {
      deviceId: this.deviceId,
      overview,
    }

    await Promise.resolve(
      this.options.windowService.openYxzWinByOptions(
        this.createPopupWindowOptions(JSON.stringify(pageInitData))
      )
    )
  }

  private createPopupWindowOptions(pageInitParam: string): PopupWindowOpenOptions {
    return {
      x: 1120,
      y: 640,
      width: 380,
      height: 320,
      title: "营小助待确认任务",
      hash: "/yxz/popup",
      name: "yxz-agent-popup",
      ...this.options.popupWindowOptions,
      pageInitParam,
    }
  }

  private getRuntime(): DcfRuntime {
    if (!this.runtime) {
      throw new Error("DcfRuntimeService has not been initialized")
    }
    return this.runtime
  }
}


