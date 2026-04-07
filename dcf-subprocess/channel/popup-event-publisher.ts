import type { DcfToPopupEvent, PopupScheduleExecutionOverviewUpdatedEvent } from "../../shared/protocol"
import { SchedulePendingExecutionStore } from "../scheduler/schedule-pending-execution-store"
import type { PopupEventPublisher as PopupEventPublisherContract } from "../scheduler/types"

export interface PopupEventSink {
  publish(event: DcfToPopupEvent): Promise<void>
}

export class PopupEventPublisher implements PopupEventPublisherContract {
  constructor(
    private readonly sink: PopupEventSink,
    private readonly deviceId: string,
    private readonly pendingStore: SchedulePendingExecutionStore
  ) {}

  async publishOverview(): Promise<void> {
    const event: PopupScheduleExecutionOverviewUpdatedEvent = {
      type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
      deviceId: this.deviceId,
      overview: await this.pendingStore.getPendingOverview(),
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }
}

