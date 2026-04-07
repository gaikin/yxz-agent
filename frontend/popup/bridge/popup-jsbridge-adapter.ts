import type { DcfToPopupEvent } from "../../../shared/protocol"
import type { PopupBridgeLike } from "../services/popup-channel-client"
import type { WindowIdResolver } from "../../bridge/window-id-resolver"

interface BridgeMessage {
  data?: string[]
}

interface BridgeJsApi {
  listen(channel: string, listener: (message: BridgeMessage) => void): void
  sendToWindow(windowId: string, channel: string, data: string): void | Promise<void>
}

interface HostWindowWithBridge {
  BridgeJs?: BridgeJsApi
}

export class PopupJsBridgeAdapter implements PopupBridgeLike {
  constructor(
    private readonly windowIdResolver: WindowIdResolver,
    private readonly channel = "schedule_popup",
    private readonly hostWindow: HostWindowWithBridge = globalThis as unknown as HostWindowWithBridge
  ) {}

  async send(event: unknown): Promise<void> {
    const bridge = this.getBridge()
    const windowId = await this.windowIdResolver.getDcfWindowId()
    await Promise.resolve(
      bridge.sendToWindow(windowId, this.channel, JSON.stringify(event))
    )
  }

  subscribe(listener: (event: DcfToPopupEvent) => void): void {
    const bridge = this.getBridge()
    bridge.listen(this.channel, (message: BridgeMessage) => {
      const raw = message?.data?.[0]
      if (!raw) {
        return
      }

      listener(JSON.parse(raw) as DcfToPopupEvent)
    })
  }

  private getBridge(): BridgeJsApi {
    const bridge = this.hostWindow.BridgeJs
    if (!bridge) {
      throw new Error("window.BridgeJs is not available")
    }
    return bridge
  }
}
