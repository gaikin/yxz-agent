import type {
  DcfToPopupEvent,
  PopupConfirmAllScheduleExecutionsEvent,
  PopupDismissAllScheduleExecutionsEvent,
} from "../../../shared/protocol"

export interface PopupBridgeLike {
  send(event: unknown): Promise<void>
  subscribe(listener: (event: DcfToPopupEvent) => void): void
}

export class PopupChannelClient {
  constructor(private readonly bridge: PopupBridgeLike, private readonly deviceId: string) {}

  bindEvents(listener: (event: DcfToPopupEvent) => void): void {
    this.bridge.subscribe(listener)
  }

  confirmAll(executionIds: string[]): Promise<void> {
    const event: PopupConfirmAllScheduleExecutionsEvent = {
      type: "CONFIRM_ALL_SCHEDULE_EXECUTIONS",
      deviceId: this.deviceId,
      executionIds,
      sentAt: new Date().toISOString(),
    }
    return this.bridge.send(event)
  }

  dismissAll(executionIds: string[]): Promise<void> {
    const event: PopupDismissAllScheduleExecutionsEvent = {
      type: "DISMISS_ALL_SCHEDULE_EXECUTIONS",
      deviceId: this.deviceId,
      executionIds,
      sentAt: new Date().toISOString(),
    }
    return this.bridge.send(event)
  }
}

