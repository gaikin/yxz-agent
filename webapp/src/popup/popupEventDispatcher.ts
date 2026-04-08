import type { DcfToPopupEvent } from "../../../types/frontendProtocol"
import { PopupExecutionStore } from "./popupExecutionStore"

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



