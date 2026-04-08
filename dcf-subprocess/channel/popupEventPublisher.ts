import type { DcfToPopupEvent, PopupScheduleExecutionOverviewUpdatedEvent } from "../../types/appProtocol"
import { SchedulePendingExecutionStore } from "../scheduler/stores"
import type { PendingExecutionNotifier } from "./pendingExecutionNotifier"
import type { PopupEventPublisher as PopupEventPublisherContract } from "../scheduler/types"

export interface PopupEventSink {
  publish(event: DcfToPopupEvent): Promise<void>
}

export class PopupEventPublisher implements PopupEventPublisherContract, PendingExecutionNotifier {
  constructor(
    private readonly sink: PopupEventSink,
    private readonly deviceId: string,
    private readonly pendingStore: SchedulePendingExecutionStore
  ) {}

  async publishOverview(): Promise<void> {
    const overview = await this.pendingStore.getPendingOverview()
    const event: PopupScheduleExecutionOverviewUpdatedEvent = {
      type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
      deviceId: this.deviceId,
      overview,
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }

  async notify(overview: import("../../types/appProtocol").ScheduleExecutionOverview): Promise<void> {
    const event: PopupScheduleExecutionOverviewUpdatedEvent = {
      type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
      deviceId: this.deviceId,
      overview,
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }
}
