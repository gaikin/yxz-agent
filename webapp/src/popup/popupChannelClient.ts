import type {
  DcfToPopupEvent,
  PopupConfirmAllScheduleExecutionsEvent,
  PopupDismissAllScheduleExecutionsEvent,
} from "../../../types/frontendProtocol"
import { YXZ_POPUP_EVENT_URL } from "../../../shared/hostRoutes"
import type { PopupPageInitData } from "../../../types/hostGlobals"
import { sendYxzRequest } from "../socket/yxzSocketClient"

export class PopupChannelClient {
  constructor(
    private readonly deviceId: string,
    private readonly channel = "schedule_popup",
    private readonly candidateKeys: string[] = ["dcf", "DCF", "dcf-subprocess", "dcf_subprocess"]
  ) {}

  bindEvents(listener: (event: DcfToPopupEvent) => void): void {
    const bridge = this.getBridge()
    bridge.listen(this.channel, (message) => {
      const raw = message?.data?.[0]
      if (!raw) {
        return
      }
      listener(JSON.parse(raw) as DcfToPopupEvent)
    })
  }

  async confirmAll(executionIds: string[]): Promise<void> {
    const event: PopupConfirmAllScheduleExecutionsEvent = {
      type: "CONFIRM_ALL_SCHEDULE_EXECUTIONS",
      deviceId: this.deviceId,
      executionIds,
      sentAt: new Date().toISOString(),
    }
    await this.send(event)
  }

  async dismissAll(executionIds: string[]): Promise<void> {
    const event: PopupDismissAllScheduleExecutionsEvent = {
      type: "DISMISS_ALL_SCHEDULE_EXECUTIONS",
      deviceId: this.deviceId,
      executionIds,
      sentAt: new Date().toISOString(),
    }
    await this.send(event)
  }

  private async send(event: unknown): Promise<void> {
    if (typeof globalThis.socket?.sendRequest === "function") {
      await sendYxzRequest<boolean>(YXZ_POPUP_EVENT_URL, [event])
      return
    }

    const bridge = this.getBridge()
    const windowId = await this.getDcfWindowId()
    await Promise.resolve(
      bridge.sendToWindow(windowId, this.channel, JSON.stringify(event))
    )
  }

  private getBridge(): BridgeApi {
    const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
    if (!bridge) {
      throw new Error("global BridgeJs/BridgeJS is not available")
    }
    return bridge
  }

  private async getDcfWindowId(): Promise<string> {
    const pageInitData = await this.getPageInitData()
    if (pageInitData?.dcfWindowId) {
      return pageInitData.dcfWindowId
    }

    if (typeof globalThis.getWinidsMap !== "function") {
      throw new Error("global getWinidsMap is not available")
    }

    const map = await globalThis.getWinidsMap()
    for (const key of this.candidateKeys) {
      const matched = Object.entries(map).find(
        ([mapKey, mapValue]) =>
          mapKey === key ||
          mapKey.includes(key) ||
          mapValue === key ||
          mapValue.includes(key)
      )
      if (matched) {
        return matched[1]
      }
    }

    const fallback = Object.values(map)[0]
    if (!fallback) {
      throw new Error("DCF windowId not found")
    }
    return fallback
  }

  private async getPageInitData(): Promise<PopupPageInitData | undefined> {
    const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
    if (typeof bridge?.getPageInitData !== "function") {
      return undefined
    }
    return bridge.getPageInitData<PopupPageInitData>()
  }
}



