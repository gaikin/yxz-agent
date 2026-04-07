export type DeviceId = string
export type SessionId = string
export type RunId = string
export type MessageId = string
export type ToolCallId = string
export type RequestId = string
export type ISODate = string
export type ISODateTime = string

export type DcfStatus = "offline" | "starting" | "connecting" | "online" | "error"
export type KaiyangStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "degraded"
export type KaiyangAuthorizationStatus = "unauthorized" | "authorizing" | "authorized" | "expired" | "failed"
export type KaiyangEventHookStatus = "unsubscribed" | "subscribing" | "subscribed" | "failed"
export type RunStatus = "queued" | "planning" | "running" | "completed" | "failed" | "cancelled"
export type StepStatus = "pending" | "running" | "success" | "failed"
export type ToolCallStatus = "success" | "failed" | "timeout" | "cancelled"
export type PageCommandType = "setValue" | "click" | "focus" | "select" | "check" | "uncheck"
export type UserMessageStatus = "sending" | "sent" | "failed"
export type AssistantMessageStatus = "streaming" | "done" | "failed" | "cancelled"
export type SessionListRunStatus = "idle" | "running" | "failed"
export type RunDetailStatus = "running" | "completed" | "failed" | "cancelled"
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

export interface ToolDescriptor {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface ToolsetSnapshot {
  deviceId: DeviceId
  source: "kaiyang"
  toolsetVersion: string
  fetchedAt: ISODateTime
  tools: ToolDescriptor[]
}

export interface RuntimeViewState {
  dcfStatus: DcfStatus
  kaiyangStatus: KaiyangStatus
  kaiyangAuthorizationStatus?: KaiyangAuthorizationStatus
  kaiyangEventHookStatus?: KaiyangEventHookStatus
  toolsetVersion?: string
  updatedAt: ISODateTime
}

export interface AgentSummary {
  agentId: string
  agentName: string
  agentType: string
  description?: string
  avatar?: string
  enabled: boolean
}

export interface ChatMessage {
  messageId: MessageId
  sessionId: SessionId
  role: "user" | "assistant"
  content: string
  status?: UserMessageStatus | AssistantMessageStatus
  createTime: ISODateTime
}

export interface RunStepView {
  stepId: string
  runId: RunId
  title: string
  toolName?: string
  status: "running" | "success" | "failed" | "cancelled"
  input?: Record<string, unknown>
  errorMessage?: string
  startTime?: ISODateTime
  endTime?: ISODateTime
}

export interface RunDetail {
  runId: RunId
  sessionId: SessionId
  status: RunDetailStatus
  steps: RunStepView[]
  createTime: ISODateTime
  updateTime: ISODateTime
}

export interface SessionSummary {
  sessionId: SessionId
  title: string
  createTime: ISODateTime
  updateTime: ISODateTime
  agent: AgentSummary
  lastMessagePreview?: string
  lastRunStatus: SessionListRunStatus
}

export interface SessionDetail {
  sessionId: SessionId
  title: string
  createTime: ISODateTime
  updateTime: ISODateTime
  agent: AgentSummary
  messages: ChatMessage[]
  lastRun?: RunDetail
}

export interface HelloEvent {
  type: "hello"
  deviceId: DeviceId
  clientVersion: string
  sentAt: ISODateTime
}

export interface DcfStatusChangedEvent {
  type: "dcf_status_changed"
  deviceId: DeviceId
  status: DcfStatus
  sentAt: ISODateTime
}

export interface KaiyangStatusChangedEvent {
  type: "kaiyang_status_changed"
  deviceId: DeviceId
  status: KaiyangStatus
  sentAt: ISODateTime
}

export interface KaiyangAuthorizationSucceededEvent {
  type: "kaiyang_authorization_succeeded"
  deviceId: DeviceId
  expiresAt?: ISODateTime
  sentAt: ISODateTime
}

export interface KaiyangAuthorizationFailedEvent {
  type: "kaiyang_authorization_failed"
  deviceId: DeviceId
  error: {
    code: string
    message: string
  }
  sentAt: ISODateTime
}

export interface KaiyangEventHookSubscribedEvent {
  type: "kaiyang_event_hook_subscribed"
  deviceId: DeviceId
  topics?: string[]
  sentAt: ISODateTime
}

export interface KaiyangEventHookSubscriptionFailedEvent {
  type: "kaiyang_event_hook_subscription_failed"
  deviceId: DeviceId
  error: {
    code: string
    message: string
  }
  sentAt: ISODateTime
}

export interface ToolsetSnapshotEvent {
  type: "toolset_snapshot"
  payload: ToolsetSnapshot
}

export interface UserMessageEvent {
  type: "user_message"
  deviceId: DeviceId
  sessionId: SessionId
  text: string
  toolsetVersion?: string
  sentAt: ISODateTime
}

export interface CancelRunEvent {
  type: "cancel_run"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  sentAt: ISODateTime
}

export interface ListAgentsEvent {
  type: "list_agents"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface ListSessionsEvent {
  type: "list_sessions"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface GetSessionDetailEvent {
  type: "get_session_detail"
  deviceId: DeviceId
  sessionId: SessionId
  sentAt: ISODateTime
}

export interface CreateSessionEvent {
  type: "create_session"
  deviceId: DeviceId
  agentId: string
  sentAt: ISODateTime
}

export interface AgentSnapshotEvent {
  type: "agent_snapshot"
  deviceId: DeviceId
  agents: AgentSummary[]
  sentAt: ISODateTime
}

export interface SessionSnapshotEvent {
  type: "session_snapshot"
  deviceId: DeviceId
  sessions: SessionSummary[]
  sentAt: ISODateTime
}

export interface SessionDetailEvent {
  type: "session_detail"
  deviceId: DeviceId
  session: SessionDetail
  sentAt: ISODateTime
}

export interface SessionCreatedEvent {
  type: "session_created"
  deviceId: DeviceId
  session: SessionDetail
  sentAt: ISODateTime
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

export interface ScheduleStateEvent {
  type: "schedule_state"
  deviceId: DeviceId
  sentAt: ISODateTime
}

export interface ScheduleEnableEvent {
  type: "schedule_enable"
  deviceId: DeviceId
  scheduleId: string
  sentAt: ISODateTime
}

export interface ScheduleDisableEvent {
  type: "schedule_disable"
  deviceId: DeviceId
  scheduleId: string
  sentAt: ISODateTime
}

export interface ScheduleStateSnapshotEvent {
  type: "schedule_state_snapshot"
  deviceId: DeviceId
  schedules: ScheduleSummary[]
  sentAt: ISODateTime
}

export interface ScheduleEnabledEvent {
  type: "schedule_enabled"
  deviceId: DeviceId
  scheduleId: string
  nextTriggerAt?: ISODateTime
  sentAt: ISODateTime
}

export interface ScheduleDisabledEvent {
  type: "schedule_disabled"
  deviceId: DeviceId
  scheduleId: string
  sentAt: ISODateTime
}

export interface OpenMenuArgs {
  menuShortCode: string
}

export interface OpenMenuResult {
  menuShortCode: string
  tabId: string
}

export interface PageCommand {
  componentId: string
  command: PageCommandType
  value?: string | number | boolean | null
}

export interface ExecutePageCommandsArgs {
  tabId: string
  commands: PageCommand[]
}

export interface ExecutePageCommandResult {
  componentId: string
  command: PageCommandType
  status: "success" | "failed"
  message?: string
}

export interface ExecutePageCommandsResult {
  ok: boolean
  results: ExecutePageCommandResult[]
}

export interface ReadResourceParams {
  tabId: string
}

export interface LowCodeComponent {
  componentId: string
  label?: string
  type?: string
  supportedCommands?: PageCommandType[]
}

export interface LowCodeSchemaResource {
  tabId: string
  components: LowCodeComponent[]
}

export interface ExecuteToolRequest {
  type: "execute_tool"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  toolCallId: ToolCallId
  toolName: string
  args: Record<string, unknown>
  sentAt: ISODateTime
}

export interface ReadResourceRequest {
  type: "read_resource"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  requestId: RequestId
  uri: string
  params?: Record<string, unknown>
  sentAt: ISODateTime
}

export interface ToolResultEvent<T = unknown> {
  type: "tool_result"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  toolCallId: ToolCallId
  status: ToolCallStatus
  result?: T
  sentAt: ISODateTime
}

export interface ToolErrorEvent {
  type: "tool_error"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  toolCallId: ToolCallId
  status: "failed" | "timeout" | "cancelled"
  error: {
    code: string
    message: string
    retryable: boolean
  }
  sentAt: ISODateTime
}

export interface ResourceResultEvent<T = unknown> {
  type: "resource_result"
  deviceId: DeviceId
  sessionId: SessionId
  runId: RunId
  requestId: RequestId
  status: "success" | "failed"
  resource?: {
    uri: string
    data: T
  }
  error?: {
    code: string
    message: string
  }
  sentAt: ISODateTime
}

export interface RunStartedEvent {
  type: "run_started"
  sessionId: SessionId
  runId: RunId
  status: "running"
  createTime: ISODateTime
  sentAt: ISODateTime
}

export interface StepStartedEvent {
  type: "step_started"
  sessionId: SessionId
  runId: RunId
  stepId: string
  title: string
  toolName?: string
  input?: Record<string, unknown>
  startTime: ISODateTime
  sentAt: ISODateTime
}

export interface StepFinishedEvent {
  type: "step_finished"
  sessionId: SessionId
  runId: RunId
  stepId: string
  status: "success" | "failed" | "cancelled"
  errorMessage?: string
  endTime: ISODateTime
  sentAt: ISODateTime
}

export interface AssistantDeltaEvent {
  type: "assistant_delta"
  sessionId: SessionId
  runId: RunId
  messageId: MessageId
  text: string
  sentAt: ISODateTime
}

export interface AssistantDoneEvent {
  type: "assistant_done"
  sessionId: SessionId
  runId: RunId
  messageId: MessageId
  text: string
  sentAt: ISODateTime
}

export interface RunFailedEvent {
  type: "run_failed"
  sessionId: SessionId
  runId: RunId
  error: string
  sentAt: ISODateTime
}

export interface RunCancelledEvent {
  type: "run_cancelled"
  sessionId: SessionId
  runId: RunId
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

export interface FrontendAgentSnapshotEvent {
  type: "AGENT_SNAPSHOT"
  deviceId: DeviceId
  agents: AgentSummary[]
  sentAt: ISODateTime
}

export interface FrontendSessionSnapshotEvent {
  type: "SESSION_SNAPSHOT"
  deviceId: DeviceId
  sessions: SessionSummary[]
  sentAt: ISODateTime
}

export interface FrontendSessionDetailEvent {
  type: "SESSION_DETAIL"
  deviceId: DeviceId
  session: SessionDetail
  sentAt: ISODateTime
}

export interface FrontendSessionCreatedEvent {
  type: "SESSION_CREATED"
  deviceId: DeviceId
  session: SessionDetail
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

export type DcfToBackendEvent =
  | CreateSessionEvent
  | ListAgentsEvent
  | ListSessionsEvent
  | GetSessionDetailEvent
  | UserMessageEvent
  | CancelRunEvent
  | HelloEvent
  | DcfStatusChangedEvent
  | KaiyangStatusChangedEvent
  | KaiyangAuthorizationSucceededEvent
  | KaiyangAuthorizationFailedEvent
  | KaiyangEventHookSubscribedEvent
  | KaiyangEventHookSubscriptionFailedEvent
  | ToolsetSnapshotEvent
  | ToolResultEvent
  | ToolErrorEvent
  | ResourceResultEvent

export type BackendToDcfEvent =
  | RunStartedEvent
  | StepStartedEvent
  | StepFinishedEvent
  | AssistantDeltaEvent
  | AssistantDoneEvent
  | RunFailedEvent
  | RunCancelledEvent
  | ExecuteToolRequest
  | ReadResourceRequest

export type FrontendToDcfEvent =
  | FrontendListAgentsEvent
  | FrontendListSessionsEvent
  | FrontendGetSessionDetailEvent
  | FrontendCreateSessionEvent
  | FrontendUserMessageEvent
  | FrontendCancelRunEvent
  | FrontendAuthorizeAutomationEvent
  | FrontendScheduleStateEvent
  | FrontendScheduleEnableEvent
  | FrontendScheduleDisableEvent

export type DcfToFrontendEvent =
  | FrontendBootstrapStateEvent
  | FrontendAutomationAuthorizedEvent
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
  | FrontendScheduleStateSnapshotEvent
  | FrontendScheduleEnabledEvent
  | FrontendScheduleDisabledEvent

export type PopupToDcfEvent =
  | PopupConfirmAllScheduleExecutionsEvent
  | PopupDismissAllScheduleExecutionsEvent

export type DcfToPopupEvent = PopupScheduleExecutionOverviewUpdatedEvent
