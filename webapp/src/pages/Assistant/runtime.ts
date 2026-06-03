import type {
  DcfToFrontendEvent,
  FrontendAutomationAuthorizedEvent,
  FrontendAuthorizeAutomationEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleDisableEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnableEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateEvent,
  FrontendScheduleStateSnapshotEvent,
  FrontendTriggerScheduleEvent,
} from "../../../../share/protocol"
import { AssistantChatClient } from "../../assistant/execution-layer/chat/chat-client"
import { AssistantWebRuntimeTransport } from "../../assistant/execution-layer/chat/web-runtime-transport"
import { RuntimeEventDispatcher } from "../../assistant/execution-layer/events/runtime-event-dispatcher"
import { createBrowserMcpExecutor } from "../../assistant/execution-layer/mcp/browser-mcp-executor"
import { AssistantMcpClient } from "../../assistant/execution-layer/mcp/mcp-client"
import { TaskRecordUploader } from "../../assistant/execution-layer/records/task-record-uploader"
import type { ChatStoreApi } from "../../assistant/stores/chat.store"
import { createChatStore } from "../../assistant/stores/chat.store"
import type { RunStoreApi } from "../../assistant/stores/run.store"
import { createRunStore } from "../../assistant/stores/run.store"
import type { ScheduleStoreState } from "../../assistant/stores/schedule.store"
import { createScheduleStore } from "../../assistant/stores/schedule.store"
import { formatNow } from "../../shared/utils/dateTime"
import { KaiyangBaseCommunicationService } from "../../services/kaiyang-base-communication"

const HOST_EVENT_TYPES = new Set<string>([
  "BOOTSTRAP_STATE",
  "AUTOMATION_AUTHORIZED",
  "SCHEDULE_STATE_SNAPSHOT",
  "SCHEDULE_ENABLED",
  "SCHEDULE_DISABLED",
])

export type { ScheduleStoreState } from "../../assistant/stores/schedule.store"

export interface AssistantWindowViewModel {
  bootstrapState: ScheduleStoreState["bootstrapState"]
  automationAuthorization: ScheduleStoreState["automationAuthorization"]
  schedule: ScheduleStoreState["schedule"]
  panelVisible: ScheduleStoreState["panelVisible"]
  shouldShowAutomationAuthorization: boolean
  canOperateSchedule: boolean
  isHostConnected: boolean
}

export interface AssistantWindowRuntime {
  scheduleStore: ScheduleStore
  chatStore: ChatStoreApi
  runStore: RunStoreApi
  runtimeEventDispatcher: RuntimeEventDispatcher
  hostClient: AssistantHostClient
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

export class AssistantHostClient {
  private readonly communication = new KaiyangBaseCommunicationService()

  constructor(
    private readonly deviceId: string,
    private readonly channel = "assistant_window"
  ) {}

  isAvailable(): boolean {
    return Boolean(globalThis.BridgeJs ?? globalThis.BridgeJS)
  }

  bindEvents(listener: (event: DcfToFrontendEvent) => void): void {
    if (!this.isAvailable()) {
      return
    }

    this.communication.listenJson<DcfToFrontendEvent>(this.channel, (event) => {
      if (!HOST_EVENT_TYPES.has(event.type)) {
        return
      }
      listener(event)
    })
  }

  async authorizeAutomation(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const event = {
      type: "AUTHORIZE_AUTOMATION",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    } satisfies FrontendAuthorizeAutomationEvent
    await this.communication.sendJson(this.channel, event)
    return true
  }

  async requestScheduleState(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const event = {
      type: "SCHEDULE_STATE",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    } satisfies FrontendScheduleStateEvent
    await this.communication.sendJson(this.channel, event)
    return true
  }

  async enableSchedule(scheduleId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const event = {
      type: "SCHEDULE_ENABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    } satisfies FrontendScheduleEnableEvent
    await this.communication.sendJson(this.channel, event)
    return true
  }

  async disableSchedule(scheduleId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const event = {
      type: "SCHEDULE_DISABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    } satisfies FrontendScheduleDisableEvent
    await this.communication.sendJson(this.channel, event)
    return true
  }

  async triggerSchedule(scheduleId: string, requestedAt?: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false
    }

    const event = {
      type: "TRIGGER_SCHEDULE",
      deviceId: this.deviceId,
      scheduleId,
      requestedAt,
      sentAt: formatNow(),
    } satisfies FrontendTriggerScheduleEvent
    await this.communication.sendJson(this.channel, event)
    return true
  }
}

export function bootstrapAssistantWindow(deviceId = "device-001"): AssistantWindowRuntime {
  const scheduleStore = new ScheduleStore()
  const chatStore = createChatStore()
  const runStore = createRunStore()
  const runtimeEventDispatcher = new RuntimeEventDispatcher()
  const hostClient = new AssistantHostClient(deviceId)
  const taskRecordUploader = new TaskRecordUploader()
  const mcpClient = new AssistantMcpClient(createBrowserMcpExecutor())

  const runtime: AssistantWindowRuntime = {
    scheduleStore,
    chatStore,
    runStore,
    runtimeEventDispatcher,
    hostClient,
    chatClient: undefined as unknown as AssistantChatClient,
    mcpClient,
    taskRecordUploader,
  }

  const chatTransport = new AssistantWebRuntimeTransport(
    deviceId,
    (event) => applyAssistantWindowEvent(runtime, event),
    chatStore,
    mcpClient,
    taskRecordUploader,
    hostClient
  )

  runtime.chatClient = new AssistantChatClient(chatTransport)

  hostClient.bindEvents((event) => {
    applyAssistantWindowEvent(runtime, event)
  })

  if (!hostClient.isAvailable()) {
    scheduleStore.handleBootstrapState({
      type: "BOOTSTRAP_STATE",
      deviceId,
      automationAuthorization: {
        authorized: false,
      },
      dcfRuntime: {
        dcfStatus: "error",
        scheduleSubsystemReady: false,
      },
      sentAt: formatNow(),
    })
  }

  return runtime
}

export function applyAssistantWindowEvent(
  runtime: AssistantWindowRuntime,
  event: DcfToFrontendEvent
): void {
  runtime.chatClient?.handleFrontendEvent(event)

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
  const isHostConnected = state.bootstrapState?.dcfStatus === "online"

  return {
    bootstrapState: state.bootstrapState,
    automationAuthorization: state.automationAuthorization,
    schedule: state.schedule,
    panelVisible: state.panelVisible,
    shouldShowAutomationAuthorization:
      isHostConnected &&
      state.bootstrapState?.scheduleSubsystemReady === true &&
      state.automationAuthorization.authorized === false,
    canOperateSchedule:
      isHostConnected &&
      state.bootstrapState?.scheduleSubsystemReady === true &&
      state.automationAuthorization.authorized === true,
    isHostConnected,
  }
}
