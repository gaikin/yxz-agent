import type { DcfToPopupEvent } from "../../../shared/protocol"
import { PopupExecutionStore } from "../stores/popup-execution.store"

export class PopupEventDispatcher {
  constructor(private readonly popupExecutionStore: PopupExecutionStore) {}

  dispatch(event: DcfToPopupEvent): void {
    switch (event.type) {
      case "SCHEDULE_EXECUTION_OVERVIEW_UPDATED":
        this.popupExecutionStore.handleOverviewUpdated(event)
        return
      default:
        return
    }
  }
}

