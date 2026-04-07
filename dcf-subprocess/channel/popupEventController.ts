import type {
  PopupConfirmAllScheduleExecutionsEvent,
  PopupDismissAllScheduleExecutionsEvent,
} from "../../shared/protocol"
import { PopupEventHandler, ControllerAbstract, type SocketServerLike } from "./handlerFramework"
import { ScheduleExecutionCoordinator } from "../scheduler/scheduleExecutionCoordinator"
import { ScheduleLoader } from "../scheduler/stores"

export class PopupEventController extends ControllerAbstract {
  constructor(
    private readonly scheduleExecutionCoordinator: ScheduleExecutionCoordinator,
    private readonly scheduleLoader: ScheduleLoader,
    socketServer?: SocketServerLike
  ) {
    super(socketServer)
  }

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
