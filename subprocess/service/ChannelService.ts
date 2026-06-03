import type {
  DcfToFrontendEvent,
  DcfToPopupEvent,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateSnapshotEvent,
  FrontendTriggerScheduleEvent,
  FrontendToDcfEvent,
  PopupConfirmAllScheduleExecutionsEvent,
  PopupDismissAllScheduleExecutionsEvent,
  PopupScheduleExecutionOverviewUpdatedEvent,
  PopupToDcfEvent,
  ScheduleExecutionOverview,
} from "../../share/protocol"
import { formatNow, parseDateTime } from "../../share/dateTime"
import {
  AutomationAuthorizationService,
  ScheduleDefinitionService,
  SchedulePendingExecutionService,
  ScheduleRuntimeService,
} from "./scheduler/ScheduleStateService"
import { ScheduleExecutionService, ScheduleTimerService } from "./scheduler/SchedulerService"
import {
  AssistantConversationRuntimeService,
} from "./chat/AssistantSessionService"

export type FrontendEventPublisher = (event: DcfToFrontendEvent) => Promise<void>

export type PopupEventPublisher = (event: DcfToPopupEvent) => Promise<void>

export class FrontendChannelService {
  private scheduleTimerService?: ScheduleTimerService
  private scheduleExecutionService?: ScheduleExecutionService
  private assistantConversationRuntimeService?: AssistantConversationRuntimeService

  constructor(
    private readonly publishFrontendEvent: FrontendEventPublisher,
    private readonly deviceId: string,
    private readonly automationAuthorizationService: AutomationAuthorizationService,
    private readonly runtimeState: {
      snapshot(): FrontendBootstrapStateEvent["dcfRuntime"]
    },
    private readonly scheduleRuntimeService: ScheduleRuntimeService,
    private readonly scheduleDefinitionService: ScheduleDefinitionService
  ) {}

  bindRuntime(
    scheduleTimerService: ScheduleTimerService,
    scheduleExecutionService: ScheduleExecutionService,
    assistantConversationRuntimeService: AssistantConversationRuntimeService
  ): void {
    this.scheduleTimerService = scheduleTimerService
    this.scheduleExecutionService = scheduleExecutionService
    this.assistantConversationRuntimeService = assistantConversationRuntimeService
  }

  async receive(event: FrontendToDcfEvent | string): Promise<void> {
    const parsed = typeof event === "string" ? (JSON.parse(event) as FrontendToDcfEvent) : event

    switch (parsed.type) {
      case "AUTHORIZE_AUTOMATION":
        await this.authorizeAutomation()
        return
      case "SCHEDULE_STATE":
        await this.publishBootstrapState()
        await this.publishScheduleStateSnapshot()
        return
      case "SCHEDULE_ENABLE":
        await this.enableSchedule(parsed.scheduleId)
        return
      case "SCHEDULE_DISABLE":
        await this.disableSchedule(parsed.scheduleId)
        return
      case "TRIGGER_SCHEDULE":
        await this.triggerSchedule(parsed)
        return
      case "LIST_AGENTS":
        await this.publishAgentSnapshot()
        return
      case "LIST_SESSIONS":
        await this.publishSessionSnapshot()
        return
      case "GET_SESSION_DETAIL":
        await this.publishSessionDetail(parsed.sessionId)
        return
      case "CREATE_SESSION":
        await this.createSession(parsed.agentId)
        return
      case "USER_MESSAGE":
        await this.sendUserMessage(parsed.sessionId, parsed.text)
        return
      case "CANCEL_RUN":
        await this.cancelRun(parsed.sessionId, parsed.runId)
        return
      default:
        return
    }
  }

  async publishBootstrapState(): Promise<void> {
    const event: FrontendBootstrapStateEvent = {
      type: "BOOTSTRAP_STATE",
      deviceId: this.deviceId,
      automationAuthorization: await this.automationAuthorizationService.get(),
      dcfRuntime: this.runtimeState.snapshot(),
      sentAt: formatNow(),
    }
    await this.publishFrontendEvent(event)
  }

  async publishAutomationAuthorized(authorizedAt: string): Promise<void> {
    const event: FrontendAutomationAuthorizedEvent = {
      type: "AUTOMATION_AUTHORIZED",
      deviceId: this.deviceId,
      authorizedAt,
      sentAt: formatNow(),
    }
    await this.publishFrontendEvent(event)
  }

  async publishScheduleStateSnapshot(): Promise<void> {
    const definitions = await this.scheduleDefinitionService.list()
    const runtimeById = new Map(
      (await this.scheduleRuntimeService.list()).map((item) => [item.scheduleId, item])
    )
    const schedules = definitions.map((definition) => {
      const runtime = runtimeById.get(definition.scheduleId)
      return {
        scheduleId: definition.scheduleId,
        name: definition.name,
        enabled: runtime?.enabled ?? false,
        cronExpression: definition.cronExpression,
        timezone: definition.timezone,
        nextTriggerAt: runtime?.nextTriggerAt,
        lastTriggeredAt: runtime?.lastTriggeredAt,
        lastCompletedAt: runtime?.lastCompletedAt,
        lastStatus: runtime?.lastStatus ?? "idle",
      }
    })
    const event: FrontendScheduleStateSnapshotEvent = {
      type: "SCHEDULE_STATE_SNAPSHOT",
      deviceId: this.deviceId,
      schedules,
      sentAt: formatNow(),
    }
    await this.publishFrontendEvent(event)
  }

  async publishScheduleEnabled(scheduleId: string, nextTriggerAt?: string): Promise<void> {
    const event: FrontendScheduleEnabledEvent = {
      type: "SCHEDULE_ENABLED",
      deviceId: this.deviceId,
      scheduleId,
      nextTriggerAt,
      sentAt: formatNow(),
    }
    await this.publishFrontendEvent(event)
  }

  async publishScheduleDisabled(scheduleId: string): Promise<void> {
    const event: FrontendScheduleDisabledEvent = {
      type: "SCHEDULE_DISABLED",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    }
    await this.publishFrontendEvent(event)
  }

  async publishAgentSnapshot(): Promise<void> {
    const event = {
      type: "AGENT_SNAPSHOT",
      deviceId: this.deviceId,
      agents: await this.getAssistantConversationRuntimeService().listAgents(),
      sentAt: formatNow(),
    } as const
    await this.publishFrontendEvent(event)
  }

  async publishSessionSnapshot(): Promise<void> {
    const event = {
      type: "SESSION_SNAPSHOT",
      deviceId: this.deviceId,
      sessions: await this.getAssistantConversationRuntimeService().listSessions(),
      sentAt: formatNow(),
    } as const
    await this.publishFrontendEvent(event)
  }

  async publishSessionDetail(sessionId: string): Promise<void> {
    const session = await this.getAssistantConversationRuntimeService().getSessionDetail(sessionId)
    if (!session) {
      return
    }

    const event = {
      type: "SESSION_DETAIL",
      deviceId: this.deviceId,
      session,
      sentAt: formatNow(),
    } as const
    await this.publishFrontendEvent(event)
  }

  private async authorizeAutomation(): Promise<void> {
    const authorizedAt = formatNow()
    await this.automationAuthorizationService.authorize(authorizedAt)
    await this.publishAutomationAuthorized(authorizedAt)
  }

  private async enableSchedule(scheduleId: string): Promise<void> {
    const scheduleTimerService = this.getScheduleTimerService()
    const scheduleExecutionService = this.getScheduleExecutionService()
    const authorization = await this.automationAuthorizationService.get()
    if (!authorization.authorized) {
      return
    }

    const schedule = await this.scheduleDefinitionService.get(scheduleId)
    if (!schedule) {
      return
    }

    const nextTriggerAt = await scheduleTimerService.register(schedule)
    await scheduleExecutionService.enableSchedule(scheduleId, nextTriggerAt)
  }

  private async disableSchedule(scheduleId: string): Promise<void> {
    await this.getScheduleTimerService().unregister(scheduleId)
    await this.getScheduleExecutionService().disableSchedule(scheduleId)
  }

  private async triggerSchedule(event: FrontendTriggerScheduleEvent): Promise<void> {
    const schedule = await this.scheduleDefinitionService.get(event.scheduleId)
    if (!schedule) {
      return
    }

    await this.getScheduleTimerService().trigger(
      schedule,
      event.requestedAt ? parseDateTime(event.requestedAt) : undefined
    )
  }

  private async createSession(agentId: string): Promise<void> {
    await this.getAssistantConversationRuntimeService().createSession(agentId)
  }

  private async sendUserMessage(sessionId: string, text: string): Promise<void> {
    await this.getAssistantConversationRuntimeService().sendUserMessage(sessionId, text)
  }

  private async cancelRun(sessionId: string, runId: string): Promise<void> {
    await this.getAssistantConversationRuntimeService().cancelRun(sessionId, runId)
  }

  private getAssistantConversationRuntimeService(): AssistantConversationRuntimeService {
    if (!this.assistantConversationRuntimeService) {
      throw new Error(
        "FrontendChannelService has not been bound to AssistantConversationRuntimeService"
      )
    }
    return this.assistantConversationRuntimeService
  }

  private getScheduleExecutionService(): ScheduleExecutionService {
    if (!this.scheduleExecutionService) {
      throw new Error("FrontendChannelService has not been bound to ScheduleExecutionService")
    }
    return this.scheduleExecutionService
  }

  private getScheduleTimerService(): ScheduleTimerService {
    if (!this.scheduleTimerService) {
      throw new Error("FrontendChannelService has not been bound to ScheduleTimerService")
    }
    return this.scheduleTimerService
  }
}

export class PopupChannelService {
  private scheduleExecutionService?: ScheduleExecutionService
  private scheduleDefinitionService?: ScheduleDefinitionService

  constructor(
    private readonly publishPopupEvent: PopupEventPublisher,
    private readonly deviceId: string,
    private readonly schedulePendingExecutionService: SchedulePendingExecutionService
  ) {}

  bindRuntime(
    scheduleExecutionService: ScheduleExecutionService,
    scheduleDefinitionService: ScheduleDefinitionService
  ): void {
    this.scheduleExecutionService = scheduleExecutionService
    this.scheduleDefinitionService = scheduleDefinitionService
  }

  async receive(event: PopupToDcfEvent | string): Promise<void> {
    const parsed = typeof event === "string" ? (JSON.parse(event) as PopupToDcfEvent) : event

    switch (parsed.type) {
      case "CONFIRM_ALL_SCHEDULE_EXECUTIONS":
        await this.confirmAll(parsed)
        return
      case "DISMISS_ALL_SCHEDULE_EXECUTIONS":
        await this.dismissAll(parsed)
        return
      default:
        return
    }
  }

  async publishOverview(): Promise<void> {
    const overview = await this.schedulePendingExecutionService.getPendingOverview()
    await this.notify(overview)
  }

  async notify(overview: ScheduleExecutionOverview): Promise<void> {
    const event: PopupScheduleExecutionOverviewUpdatedEvent = {
      type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
      deviceId: this.deviceId,
      overview,
      sentAt: formatNow(),
    }
    await this.publishPopupEvent(event)
  }

  private async confirmAll(
    event: PopupConfirmAllScheduleExecutionsEvent
  ): Promise<void> {
    const schedules = await this.getScheduleDefinitionService().list()
    await this.getScheduleExecutionService().confirmAll(event.executionIds, schedules)
  }

  private async dismissAll(
    event: PopupDismissAllScheduleExecutionsEvent
  ): Promise<void> {
    await this.getScheduleExecutionService().dismissAll(event.executionIds)
  }

  private getScheduleDefinitionService(): ScheduleDefinitionService {
    if (!this.scheduleDefinitionService) {
      throw new Error("PopupChannelService has not been bound to ScheduleDefinitionService")
    }
    return this.scheduleDefinitionService
  }

  private getScheduleExecutionService(): ScheduleExecutionService {
    if (!this.scheduleExecutionService) {
      throw new Error("PopupChannelService has not been bound to ScheduleExecutionService")
    }
    return this.scheduleExecutionService
  }
}
