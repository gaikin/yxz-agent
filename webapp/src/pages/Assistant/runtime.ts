import type {
  DcfToFrontendEvent,
  FrontendAgentSnapshotEvent,
  FrontendAssistantDoneEvent,
  FrontendAssistantDeltaEvent,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendCancelRunEvent,
  FrontendCreateSessionEvent,
  FrontendGetSessionDetailEvent,
  FrontendListAgentsEvent,
  FrontendListSessionsEvent,
  FrontendRunCancelledEvent,
  FrontendRunFailedEvent,
  FrontendRunStartedEvent,
  FrontendScheduleDisableEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnableEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateEvent,
  FrontendScheduleStateSnapshotEvent,
  FrontendSessionCreatedEvent,
  FrontendSessionDetailEvent,
  FrontendSessionSnapshotEvent,
  FrontendStepFinishedEvent,
  FrontendStepStartedEvent,
  FrontendTriggerScheduleEvent,
  FrontendUserMessageEvent,
} from "../../../../share/protocol"
import { AssistantMcpClient } from "../../assistant/execution-layer/mcp/mcp-client"
import { TaskRecordUploader } from "../../assistant/execution-layer/records/task-record-uploader"
import { AssistantChatClient } from "../../assistant/execution-layer/chat/chat-client"
import { RuntimeEventDispatcher } from "../../assistant/execution-layer/events/runtime-event-dispatcher"
import type { ChatStoreApi } from "../../assistant/stores/chat.store"
import { createChatStore } from "../../assistant/stores/chat.store"
import type { RunStoreApi } from "../../assistant/stores/run.store"
import { createRunStore } from "../../assistant/stores/run.store"
import type {
  ScheduleStoreApi,
  ScheduleStoreState,
} from "../../assistant/stores/schedule.store"
import { createScheduleStore } from "../../assistant/stores/schedule.store"
import { formatNow } from "../../shared/utils/dateTime"
import { KaiyangBaseCommunicationService } from "../../services/kaiyang-base-communication"

export type { ScheduleStoreState } from "../../assistant/stores/schedule.store"

export interface AssistantWindowViewModel {
  bootstrapState: ScheduleStoreState["bootstrapState"]
  automationAuthorization: ScheduleStoreState["automationAuthorization"]
  schedule: ScheduleStoreState["schedule"]
  panelVisible: ScheduleStoreState["panelVisible"]
  shouldShowAutomationAuthorization: boolean
  canOperateSchedule: boolean
}

export interface AssistantWindowRuntime {
  scheduleStore: ScheduleStore
  chatStore: ChatStoreApi
  runStore: RunStoreApi
  runtimeEventDispatcher: RuntimeEventDispatcher
  channelClient: AssistantWindowChannelClient
  chatClient: AssistantChatClient
  mcpClient: AssistantMcpClient
  taskRecordUploader: TaskRecordUploader
}

export class ScheduleStore {
  private readonly storeApi = createScheduleStore()

  getState(): ScheduleStoreState {
    return this.storeApi.getState()
  }

  subscribe(listener: () => void): () => void {
    return this.storeApi.subscribe(listener)
  }

  openPanel(): void {
    this.storeApi.getState().openPanel()
  }

  closePanel(): void {
    this.storeApi.getState().closePanel()
  }

  handleBootstrapState(event: FrontendBootstrapStateEvent): void {
    this.storeApi.getState().applyBootstrapState(event)
  }

  handleAutomationAuthorized(event: FrontendAutomationAuthorizedEvent): void {
    this.storeApi.getState().applyAutomationAuthorized(event)
  }

  handleScheduleStateSnapshot(event: FrontendScheduleStateSnapshotEvent): void {
    this.storeApi.getState().applyScheduleStateSnapshot(event)
  }

  handleScheduleEnabled(event: FrontendScheduleEnabledEvent): void {
    this.storeApi.getState().applyScheduleEnabled(event)
  }

  handleScheduleDisabled(event: FrontendScheduleDisabledEvent): void {
    this.storeApi.getState().applyScheduleDisabled(event)
  }
}

export class AssistantWindowChannelClient {
  private readonly communication = new KaiyangBaseCommunicationService()

  constructor(
    private readonly deviceId: string,
    private readonly channel = "assistant_window"
  ) {}

  bindEvents(listener: (event: DcfToFrontendEvent) => void): void {
    this.communication.listenJson(this.channel, listener)
  }

  async authorizeAutomation(): Promise<void> {
    const event = {
      type: "AUTHORIZE_AUTOMATION",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    } satisfies FrontendAuthorizeAutomationEvent
    await this.communication.sendJson(this.channel, event)
  }

  async requestScheduleState(): Promise<void> {
    const event = {
      type: "SCHEDULE_STATE",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    } satisfies FrontendScheduleStateEvent
    await this.communication.sendJson(this.channel, event)
  }

  async enableSchedule(scheduleId: string): Promise<void> {
    const event = {
      type: "SCHEDULE_ENABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    } satisfies FrontendScheduleEnableEvent
    await this.communication.sendJson(this.channel, event)
  }

  async disableSchedule(scheduleId: string): Promise<void> {
    const event = {
      type: "SCHEDULE_DISABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    } satisfies FrontendScheduleDisableEvent
    await this.communication.sendJson(this.channel, event)
  }

  async triggerSchedule(scheduleId: string, requestedAt?: string): Promise<void> {
    const event = {
      type: "TRIGGER_SCHEDULE",
      deviceId: this.deviceId,
      scheduleId,
      requestedAt,
      sentAt: formatNow(),
    } satisfies FrontendTriggerScheduleEvent
    await this.communication.sendJson(this.channel, event)
  }

  async listAgents(): Promise<void> {
    const event = {
      type: "LIST_AGENTS",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    } satisfies FrontendListAgentsEvent
    await this.communication.sendJson(this.channel, event)
  }

  async listSessions(): Promise<void> {
    const event = {
      type: "LIST_SESSIONS",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    } satisfies FrontendListSessionsEvent
    await this.communication.sendJson(this.channel, event)
  }

  async getSessionDetail(sessionId: string): Promise<void> {
    const event = {
      type: "GET_SESSION_DETAIL",
      deviceId: this.deviceId,
      sessionId,
      sentAt: formatNow(),
    } satisfies FrontendGetSessionDetailEvent
    await this.communication.sendJson(this.channel, event)
  }

  async createSession(agentId: string): Promise<void> {
    const event = {
      type: "CREATE_SESSION",
      deviceId: this.deviceId,
      agentId,
      sentAt: formatNow(),
    } satisfies FrontendCreateSessionEvent
    await this.communication.sendJson(this.channel, event)
  }

  async sendUserMessage(sessionId: string, text: string): Promise<void> {
    const event = {
      type: "USER_MESSAGE",
      deviceId: this.deviceId,
      sessionId,
      text,
      sentAt: formatNow(),
    } satisfies FrontendUserMessageEvent
    await this.communication.sendJson(this.channel, event)
  }

  async cancelRun(sessionId: string, runId: string): Promise<void> {
    const event = {
      type: "CANCEL_RUN",
      deviceId: this.deviceId,
      sessionId,
      runId,
      sentAt: formatNow(),
    } satisfies FrontendCancelRunEvent
    await this.communication.sendJson(this.channel, event)
  }
}

type FrontendAuthorizeAutomationEvent = {
  type: "AUTHORIZE_AUTOMATION"
  deviceId: string
  sentAt: string
}

export function bootstrapAssistantWindow(deviceId = "device-001"): AssistantWindowRuntime {
  const channelClient = new AssistantWindowChannelClient(deviceId)
  const runtime: AssistantWindowRuntime = {
    scheduleStore: new ScheduleStore(),
    chatStore: createChatStore(),
    runStore: createRunStore(),
    runtimeEventDispatcher: new RuntimeEventDispatcher(),
    channelClient,
    chatClient: new AssistantChatClient(channelClient),
    mcpClient: new AssistantMcpClient(),
    taskRecordUploader: new TaskRecordUploader(),
  }

  runtime.channelClient.bindEvents((event) => {
    applyAssistantWindowEvent(runtime, event)
  })

  return runtime
}

export function applyAssistantWindowEvent(
  runtime: AssistantWindowRuntime,
  event: DcfToFrontendEvent
): void {
  runtime.chatClient.handleFrontendEvent(event)

  switch (event.type) {
    case "BOOTSTRAP_STATE":
      runtime.scheduleStore.handleBootstrapState(event)
      return
    case "AUTOMATION_AUTHORIZED":
      runtime.scheduleStore.handleAutomationAuthorized(event)
      return
    case "SCHEDULE_STATE_SNAPSHOT":
      runtime.scheduleStore.handleScheduleStateSnapshot(event)
      return
    case "SCHEDULE_ENABLED":
      runtime.scheduleStore.handleScheduleEnabled(event)
      return
    case "SCHEDULE_DISABLED":
      runtime.scheduleStore.handleScheduleDisabled(event)
      return
    case "AGENT_SNAPSHOT":
      runtime.chatStore.getState().applyAgentSnapshot(event)
      return
    case "SESSION_SNAPSHOT":
      runtime.chatStore.getState().applySessionSnapshot(event)
      return
    case "SESSION_DETAIL":
      runtime.chatStore.getState().applySessionDetail(event)
      return
    case "SESSION_CREATED":
      runtime.chatStore.getState().applySessionCreated(event)
      return
    case "RUN_STARTED":
      runtime.chatStore.getState().applyRunStarted(event)
      runtime.runStore.getState().applyRunStarted(event)
      return
    case "STEP_STARTED":
      runtime.runStore.getState().applyStepStarted(event)
      return
    case "STEP_FINISHED":
      runtime.runStore.getState().applyStepFinished(event)
      return
    case "ASSISTANT_DELTA":
      runtime.chatStore.getState().applyAssistantDelta(event)
      return
    case "ASSISTANT_DONE":
      runtime.chatStore.getState().applyAssistantDone(event)
      runtime.runStore.getState().applyAssistantDone(event)
      return
    case "RUN_FAILED":
      runtime.chatStore.getState().applyRunFailed(event)
      runtime.runStore.getState().applyRunFailed(event)
      return
    case "RUN_CANCELLED":
      runtime.chatStore.getState().applyRunCancelled(event)
      runtime.runStore.getState().applyRunCancelled(event)
      return
    default:
      return
  }
}

export function createAssistantWindowViewModel(
  state: ScheduleStoreState
): AssistantWindowViewModel {
  return {
    bootstrapState: state.bootstrapState,
    automationAuthorization: state.automationAuthorization,
    schedule: state.schedule,
    panelVisible: state.panelVisible,
    shouldShowAutomationAuthorization:
      state.bootstrapState?.dcfStatus === "online" &&
      state.bootstrapState?.scheduleSubsystemReady === true &&
      state.automationAuthorization.authorized === false,
    canOperateSchedule:
      state.bootstrapState?.dcfStatus === "online" &&
      state.bootstrapState?.scheduleSubsystemReady === true &&
      state.automationAuthorization.authorized === true,
  }
}
