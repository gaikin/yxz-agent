import type {
  DcfToFrontendEvent,
  FrontendAuthorizeAutomationEvent,
  FrontendScheduleDisableEvent,
  FrontendScheduleEnableEvent,
  FrontendScheduleStateEvent,
} from "../../shared/protocol"

export interface BridgeLike {
  send(event: unknown): Promise<void>
  subscribe(listener: (event: DcfToFrontendEvent) => void): void
}

export class AssistantWindowChannelClient {
  constructor(private readonly bridge: BridgeLike, private readonly deviceId: string) {}

  bindEvents(listener: (event: DcfToFrontendEvent) => void): void {
    this.bridge.subscribe(listener)
  }

  authorizeAutomation(): Promise<void> {
    const event: FrontendAuthorizeAutomationEvent = {
      type: "AUTHORIZE_AUTOMATION",
      deviceId: this.deviceId,
      sentAt: new Date().toISOString(),
    }
    return this.bridge.send(event)
  }

  requestScheduleState(): Promise<void> {
    const event: FrontendScheduleStateEvent = {
      type: "SCHEDULE_STATE",
      deviceId: this.deviceId,
      sentAt: new Date().toISOString(),
    }
    return this.bridge.send(event)
  }

  enableSchedule(scheduleId: string): Promise<void> {
    const event: FrontendScheduleEnableEvent = {
      type: "SCHEDULE_ENABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: new Date().toISOString(),
    }
    return this.bridge.send(event)
  }

  disableSchedule(scheduleId: string): Promise<void> {
    const event: FrontendScheduleDisableEvent = {
      type: "SCHEDULE_DISABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: new Date().toISOString(),
    }
    return this.bridge.send(event)
  }
}
