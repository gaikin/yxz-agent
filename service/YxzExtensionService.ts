import type { FrontendToDcfEvent, PopupToDcfEvent } from "../types/frontendProtocol"
import {
  YXZ_FRONTEND_EVENT_URL,
  YXZ_POPUP_EVENT_URL,
  YXZ_TRIGGER_SCHEDULE_URL,
} from "../shared/hostRoutes"
import type { ScheduleExecutionOverview } from "../types/frontendProtocol"
import type { PopupPageInitData } from "../types/hostGlobals"
import {
  bootstrapDcf,
  type DcfBootstrapDependencies,
  type DcfRuntime,
} from "../dcf/runtime/bootstrap"

const HostControllerBase = (globalThis.ControllerAbstract ??
  class {
    constructor(_socketServer: unknown) {}
  }) as new (socketServer: unknown) => object
const requestEvent: RequestEventDecorator = globalThis.requestEvent ?? (() => () => {})

type RuntimeSink = DcfBootstrapDependencies["frontendSink"]
type PopupSink = DcfBootstrapDependencies["popupSink"]

export interface WindowServiceLike {
  openYxzWinByOptions(options: PopupWindowOpenOptions): Promise<void> | void
}

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

export interface YxzExtensionServiceOptions
  extends Omit<DcfBootstrapDependencies, "frontendSink" | "popupSink"> {
  frontendSink?: RuntimeSink
  popupSink?: PopupSink
  windowService?: WindowServiceLike
  popupWindowOptions?: Partial<Omit<PopupWindowOpenOptions, "pageInitParam">>
}

export class YxzExtensionService extends HostControllerBase {
  private runtime?: DcfRuntime

  constructor(
    socketServer: unknown,
    private readonly options: YxzExtensionServiceOptions
  ) {
    super(socketServer)
  }

  async init(): Promise<void> {
    this.runtime = await bootstrapDcf({
      ...this.options,
      hostPendingExecutionCallback: {
        onPendingExecutionsUpdated: async (overview) => {
          await Promise.resolve(
            this.options.hostPendingExecutionCallback?.onPendingExecutionsUpdated(overview)
          )
          await this.openPopupWindow(overview)
        },
      },
      frontendSink:
        this.options.frontendSink ??
        ({
          async publish() {},
        } satisfies RuntimeSink),
      popupSink:
        this.options.popupSink ??
        ({
          async publish() {},
        } satisfies PopupSink),
    })
  }

  @requestEvent(YXZ_FRONTEND_EVENT_URL)
  async handleFrontendEvent(event: FrontendToDcfEvent | string): Promise<boolean> {
    await this.getRuntime().frontendChannelServer.receive(event)
    return true
  }

  @requestEvent(YXZ_POPUP_EVENT_URL)
  async handlePopupEvent(event: PopupToDcfEvent | string): Promise<boolean> {
    await this.getRuntime().popupChannelServer.receive(event)
    return true
  }

  @requestEvent(YXZ_TRIGGER_SCHEDULE_URL)
  async triggerSchedule(scheduleId: string, requestedAt?: string): Promise<boolean> {
    const runtime = this.getRuntime()
    const schedule = await runtime.scheduleLoader.get(scheduleId)
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`)
    }
    await runtime.schedulerManager.trigger(schedule, requestedAt ? new Date(requestedAt) : undefined)
    return true
  }

  private getRuntime(): DcfRuntime {
    if (!this.runtime) {
      throw new Error("YxzExtensionService has not been initialized")
    }
    return this.runtime
  }

  private async openPopupWindow(overview: ScheduleExecutionOverview): Promise<void> {
    if (!this.options.windowService || overview.pendingCount === 0) {
      return
    }

    const pageInitData: PopupPageInitData = {
      deviceId: this.options.deviceId ?? "device-001",
      overview,
    }
    const popupWindowOptions = this.createPopupWindowOptions(JSON.stringify(pageInitData))

    await Promise.resolve(
      this.options.windowService.openYxzWinByOptions(popupWindowOptions)
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
}
