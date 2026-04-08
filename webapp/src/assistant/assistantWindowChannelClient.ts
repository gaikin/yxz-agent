import type {
  DcfToFrontendEvent,
  FrontendAuthorizeAutomationEvent,
  FrontendScheduleDisableEvent,
  FrontendScheduleEnableEvent,
  FrontendScheduleStateEvent,
} from "../../../types/frontendProtocol"
import { YXZ_FRONTEND_EVENT_URL } from "../../../shared/hostRoutes"
import { sendYxzRequest } from "../socket/yxzSocketClient"

export class AssistantWindowChannelClient {
  constructor(
    private readonly deviceId: string,
    private readonly channel = "assistant_window",
    private readonly candidateKeys: string[] = ["dcf", "DCF", "dcf-subprocess", "dcf_subprocess"]
  ) {}

  bindEvents(listener: (event: DcfToFrontendEvent) => void): void {
    const bridge = this.getBridge()
    bridge.listen(this.channel, (message) => {
      const raw = message?.data?.[0]
      if (!raw) {
        return
      }
      listener(JSON.parse(raw) as DcfToFrontendEvent)
    })
  }

  async authorizeAutomation(): Promise<void> {
    const event: FrontendAuthorizeAutomationEvent = {
      type: "AUTHORIZE_AUTOMATION",
      deviceId: this.deviceId,
      sentAt: new Date().toISOString(),
    }
    await this.send(event)
  }

  async requestScheduleState(): Promise<void> {
    const event: FrontendScheduleStateEvent = {
      type: "SCHEDULE_STATE",
      deviceId: this.deviceId,
      sentAt: new Date().toISOString(),
    }
    await this.send(event)
  }

  async enableSchedule(scheduleId: string): Promise<void> {
    const event: FrontendScheduleEnableEvent = {
      type: "SCHEDULE_ENABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: new Date().toISOString(),
    }
    await this.send(event)
  }

  async disableSchedule(scheduleId: string): Promise<void> {
    const event: FrontendScheduleDisableEvent = {
      type: "SCHEDULE_DISABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: new Date().toISOString(),
    }
    await this.send(event)
  }

  private async send(event: unknown): Promise<void> {
    if (typeof globalThis.socket?.sendRequest === "function") {
      await sendYxzRequest<boolean>(YXZ_FRONTEND_EVENT_URL, [event])
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
}



