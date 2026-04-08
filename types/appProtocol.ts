export type DeviceId = string
export type SessionId = string
export type RunId = string
export type MessageId = string
export type ISODateTime = string

export type KaiyangStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "degraded"

export type ScheduleExecutionStatus =
  | "idle"
  | "enabled"
  | "disabled"
  | "running"
  | "completed"
  | "failed"
  | "skipped"

export type SchedulePendingExecutionStatus =
  | "pending"
  | "confirmed"
  | "running"
  | "completed"
  | "failed"
  | "skipped"

export interface AutomationAuthorizationState {
  authorized: boolean
  authorizedAt?: ISODateTime
}

export interface DcfBootstrapRuntimeState {
  dcfStatus: "starting" | "online" | "error"
  kaiyangStatus?: KaiyangStatus
  kaiyangAuthorizationStatus?: "authorizing" | "authorized" | "failed"
  kaiyangEventHookStatus?: "subscribing" | "subscribed" | "failed"
  scheduleSubsystemReady: boolean
}

export interface ScheduleSummary {
  scheduleId: string
  name: string
  enabled: boolean
  cronExpression?: string
  timezone?: string
  nextTriggerAt?: ISODateTime
  lastTriggeredAt?: ISODateTime
  lastCompletedAt?: ISODateTime
  lastStatus?: ScheduleExecutionStatus
}

export interface SchedulePendingExecutionItem {
  executionId: string
  scheduleId: string
  scheduleName: string
  requestedAt: ISODateTime
  status: SchedulePendingExecutionStatus
}

export interface ScheduleExecutionOverview {
  pendingCount: number
  items: SchedulePendingExecutionItem[]
  updatedAt: ISODateTime
}

export interface FrontendBootstrapStateEvent {
  type: "BOOTSTRAP_STATE"
  deviceId: DeviceId
  automationAuthorization: AutomationAuthorizationState
  dcfRuntime: DcfBootstrapRuntimeState
  sentAt: ISODateTime
}

export interface FrontendAuthorizeAutomationEvent {
  type: "AUTHORIZE_AUTOMATION"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface FrontendAutomationAuthorizedEvent {
  type: "AUTOMATION_AUTHORIZED"
  deviceId: DeviceId
  authorizedAt: ISODateTime
  sentAt: ISODateTime
}

export interface FrontendScheduleStateEvent {
  type: "SCHEDULE_STATE"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface FrontendScheduleEnableEvent {
  type: "SCHEDULE_ENABLE"
  deviceId: DeviceId
  scheduleId: string
  sentAt: ISODateTime
}

export interface FrontendScheduleDisableEvent {
  type: "SCHEDULE_DISABLE"
  deviceId: DeviceId
  scheduleId: string
  sentAt: ISODateTime
}

export interface FrontendScheduleStateSnapshotEvent {
  type: "SCHEDULE_STATE_SNAPSHOT"
  deviceId: DeviceId
  schedules: ScheduleSummary[]
  sentAt: ISODateTime
}

export interface FrontendScheduleEnabledEvent {
  type: "SCHEDULE_ENABLED"
  deviceId: DeviceId
  scheduleId: string
  nextTriggerAt?: ISODateTime
  sentAt: ISODateTime
}

export interface FrontendScheduleDisabledEvent {
  type: "SCHEDULE_DISABLED"
  deviceId: DeviceId
  scheduleId: string
  sentAt: ISODateTime
}

export interface FrontendListAgentsEvent {
  type: "LIST_AGENTS"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface FrontendListSessionsEvent {
  type: "LIST_SESSIONS"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface FrontendGetSessionDetailEvent {
  type: "GET_SESSION_DETAIL"
  deviceId: DeviceId
  sessionId: SessionId
  sentAt: ISODateTime
}

export interface FrontendCreateSessionEvent {
  type: "CREATE_SESSION"
  deviceId: DeviceId
  agentId: string
  sentAt: ISODateTime
}

export interface FrontendUserMessageEvent {
  type: "USER_MESSAGE"
  deviceId: DeviceId
  sessionId: SessionId
  text: string
  toolsetVersion?: string
  sentAt: ISODateTime
}

export interface FrontendCancelRunEvent {
  type: "CANCEL_RUN"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  sentAt: ISODateTime
}

export interface FrontendAgentSnapshotEvent {
  type: "AGENT_SNAPSHOT"
  deviceId: DeviceId
  agents: unknown[]
  sentAt: ISODateTime
}

export interface FrontendSessionSnapshotEvent {
  type: "SESSION_SNAPSHOT"
  deviceId: DeviceId
  sessions: unknown[]
  sentAt: ISODateTime
}

export interface FrontendSessionDetailEvent {
  type: "SESSION_DETAIL"
  deviceId: DeviceId
  session: unknown
  sentAt: ISODateTime
}

export interface FrontendSessionCreatedEvent {
  type: "SESSION_CREATED"
  deviceId: DeviceId
  session: unknown
  sentAt: ISODateTime
}

export interface FrontendRunStartedEvent {
  type: "RUN_STARTED"
  sessionId: SessionId
  runId: RunId
  status: "running"
  createTime: ISODateTime
  sentAt: ISODateTime
}

export interface FrontendStepStartedEvent {
  type: "STEP_STARTED"
  sessionId: SessionId
  runId: RunId
  stepId: string
  title: string
  toolName?: string
  input?: Record<string, unknown>
  startTime: ISODateTime
  sentAt: ISODateTime
}

export interface FrontendStepFinishedEvent {
  type: "STEP_FINISHED"
  sessionId: SessionId
  runId: RunId
  stepId: string
  status: "success" | "failed" | "cancelled"
  errorMessage?: string
  endTime: ISODateTime
  sentAt: ISODateTime
}

export interface FrontendAssistantDeltaEvent {
  type: "ASSISTANT_DELTA"
  sessionId: SessionId
  runId: RunId
  messageId: MessageId
  text: string
  sentAt: ISODateTime
}

export interface FrontendAssistantDoneEvent {
  type: "ASSISTANT_DONE"
  sessionId: SessionId
  runId: RunId
  messageId: MessageId
  text: string
  sentAt: ISODateTime
}

export interface FrontendRunFailedEvent {
  type: "RUN_FAILED"
  sessionId: SessionId
  runId: RunId
  error: string
  sentAt: ISODateTime
}

export interface FrontendRunCancelledEvent {
  type: "RUN_CANCELLED"
  sessionId: SessionId
  runId: RunId
  sentAt: ISODateTime
}

export type FrontendToDcfEvent =
  | FrontendAuthorizeAutomationEvent
  | FrontendScheduleStateEvent
  | FrontendScheduleEnableEvent
  | FrontendScheduleDisableEvent
  | FrontendListAgentsEvent
  | FrontendListSessionsEvent
  | FrontendGetSessionDetailEvent
  | FrontendCreateSessionEvent
  | FrontendUserMessageEvent
  | FrontendCancelRunEvent

export type DcfToFrontendEvent =
  | FrontendBootstrapStateEvent
  | FrontendAutomationAuthorizedEvent
  | FrontendScheduleStateSnapshotEvent
  | FrontendScheduleEnabledEvent
  | FrontendScheduleDisabledEvent
  | FrontendAgentSnapshotEvent
  | FrontendSessionSnapshotEvent
  | FrontendSessionDetailEvent
  | FrontendSessionCreatedEvent
  | FrontendRunStartedEvent
  | FrontendStepStartedEvent
  | FrontendStepFinishedEvent
  | FrontendAssistantDeltaEvent
  | FrontendAssistantDoneEvent
  | FrontendRunFailedEvent
  | FrontendRunCancelledEvent

export interface PopupScheduleExecutionOverviewUpdatedEvent {
  type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED"
  deviceId: DeviceId
  overview: ScheduleExecutionOverview
  sentAt: ISODateTime
}

export interface PopupConfirmAllScheduleExecutionsEvent {
  type: "CONFIRM_ALL_SCHEDULE_EXECUTIONS"
  deviceId: DeviceId
  executionIds: string[]
  sentAt: ISODateTime
}

export interface PopupDismissAllScheduleExecutionsEvent {
  type: "DISMISS_ALL_SCHEDULE_EXECUTIONS"
  deviceId: DeviceId
  executionIds: string[]
  sentAt: ISODateTime
}

export type DcfToPopupEvent = PopupScheduleExecutionOverviewUpdatedEvent

export type PopupToDcfEvent =
  | PopupConfirmAllScheduleExecutionsEvent
  | PopupDismissAllScheduleExecutionsEvent

