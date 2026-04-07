import type {
  FrontendAuthorizeAutomationEvent,
  FrontendScheduleDisableEvent,
  FrontendScheduleEnableEvent,
  FrontendScheduleStateEvent,
  FrontendToDcfEvent,
} from "../../shared/protocol"
import { FrontendEventHandler } from "./decorators"
import { AutomationAuthorizationStore } from "../scheduler/automation-authorization-store"
import { ScheduleExecutionCoordinator } from "../scheduler/schedule-execution-coordinator"
import { ScheduleLoader } from "../scheduler/schedule-loader"
import { SchedulerManager } from "../scheduler/scheduler-manager"
import { ScheduleRuntimeStore } from "../scheduler/schedule-runtime-store"
import { FrontendEventPublisher } from "./frontend-event-publisher"

export class FrontendEventController {
  constructor(
    private readonly automationAuthorizationStore: AutomationAuthorizationStore,
    private readonly scheduleLoader: ScheduleLoader,
    private readonly schedulerManager: SchedulerManager,
    private readonly scheduleExecutionCoordinator: ScheduleExecutionCoordinator,
    private readonly scheduleRuntimeStore: ScheduleRuntimeStore,
    private readonly frontendEventPublisher: FrontendEventPublisher
  ) {}

  @FrontendEventHandler("AUTHORIZE_AUTOMATION")
  async handleAuthorizeAutomation(_event: FrontendAuthorizeAutomationEvent): Promise<void> {
    const authorizedAt = new Date().toISOString()
    await this.automationAuthorizationStore.authorize(authorizedAt)
    await this.frontendEventPublisher.publishAutomationAuthorized(authorizedAt)
  }

  @FrontendEventHandler("SCHEDULE_STATE")
  async handleScheduleState(_event: FrontendScheduleStateEvent): Promise<void> {
    await this.frontendEventPublisher.publishScheduleStateSnapshot()
  }

  @FrontendEventHandler("SCHEDULE_ENABLE")
  async handleScheduleEnable(event: FrontendScheduleEnableEvent): Promise<void> {
    const authorized = await this.automationAuthorizationStore.get()
    if (!authorized.authorized) {
      return
    }
    const schedule = await this.scheduleLoader.get(event.scheduleId)
    if (!schedule) {
      return
    }
    const nextTriggerAt = await this.schedulerManager.register(schedule)
    await this.scheduleExecutionCoordinator.enableSchedule(schedule.scheduleId, nextTriggerAt)
  }

  @FrontendEventHandler("SCHEDULE_DISABLE")
  async handleScheduleDisable(event: FrontendScheduleDisableEvent): Promise<void> {
    await this.schedulerManager.unregister(event.scheduleId)
    await this.scheduleExecutionCoordinator.disableSchedule(event.scheduleId)
  }

  @FrontendEventHandler("LIST_AGENTS")
  async handleListAgents(_event: Extract<FrontendToDcfEvent, { type: "LIST_AGENTS" }>): Promise<void> {}

  @FrontendEventHandler("LIST_SESSIONS")
  async handleListSessions(_event: Extract<FrontendToDcfEvent, { type: "LIST_SESSIONS" }>): Promise<void> {}

  @FrontendEventHandler("GET_SESSION_DETAIL")
  async handleGetSessionDetail(_event: Extract<FrontendToDcfEvent, { type: "GET_SESSION_DETAIL" }>): Promise<void> {}

  @FrontendEventHandler("CREATE_SESSION")
  async handleCreateSession(_event: Extract<FrontendToDcfEvent, { type: "CREATE_SESSION" }>): Promise<void> {}

  @FrontendEventHandler("USER_MESSAGE")
  async handleUserMessage(_event: Extract<FrontendToDcfEvent, { type: "USER_MESSAGE" }>): Promise<void> {}

  @FrontendEventHandler("CANCEL_RUN")
  async handleCancelRun(_event: Extract<FrontendToDcfEvent, { type: "CANCEL_RUN" }>): Promise<void> {}
}

