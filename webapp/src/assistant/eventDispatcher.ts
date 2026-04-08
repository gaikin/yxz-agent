import type { DcfToFrontendEvent } from "../../../types/frontendProtocol"
import { ScheduleStore } from "./scheduleStore"

export class EventDispatcher {
  constructor(private readonly scheduleStore: ScheduleStore) {}

  dispatch(event: DcfToFrontendEvent): void {
    switch (event.type) {
      case "BOOTSTRAP_STATE":
        this.scheduleStore.handleBootstrapState(event)
        return
      case "AUTOMATION_AUTHORIZED":
        this.scheduleStore.handleAutomationAuthorized(event)
        return
      case "SCHEDULE_STATE_SNAPSHOT":
        this.scheduleStore.handleScheduleStateSnapshot(event)
        return
      case "SCHEDULE_ENABLED":
        this.scheduleStore.handleScheduleEnabled(event)
        return
      case "SCHEDULE_DISABLED":
        this.scheduleStore.handleScheduleDisabled(event)
        return
      default:
        return
    }
  }
}



