import type {
  PopupConfirmAllScheduleExecutionsEvent,
  PopupDismissAllScheduleExecutionsEvent,
} from "../../shared/protocol"
import { PopupEventHandler } from "./decorators"
import { ScheduleExecutionCoordinator } from "../scheduler/schedule-execution-coordinator"
import { ScheduleLoader } from "../scheduler/schedule-loader"

export class PopupEventController {
  constructor(
    private readonly scheduleExecutionCoordinator: ScheduleExecutionCoordinator,
    private readonly scheduleLoader: ScheduleLoader
  ) {}

  @PopupEventHandler("CONFIRM_ALL_SCHEDULE_EXECUTIONS")
  async handleConfirmAll(event: PopupConfirmAllScheduleExecutionsEvent): Promise<void> {
    const schedules = await this.scheduleLoader.list()
    await this.scheduleExecutionCoordinator.confirmAll(event.executionIds, schedules)
  }

  @PopupEventHandler("DISMISS_ALL_SCHEDULE_EXECUTIONS")
  async handleDismissAll(event: PopupDismissAllScheduleExecutionsEvent): Promise<void> {
    await this.scheduleExecutionCoordinator.dismissAll(event.executionIds)
  }
}
