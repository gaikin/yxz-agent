import type {
  AutomationAuthorizationState,
  DcfBootstrapRuntimeState,
  DcfToFrontendEvent,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleDisableEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnableEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateEvent,
  FrontendScheduleStateSnapshotEvent,
  FrontendTriggerScheduleEvent,
  ScheduleSummary,
} from "../../../../share/protocol"
import { formatNow } from "../../../../share/dateTime"

export interface ScheduleStoreState {
  automationAuthorization: AutomationAuthorizationState
  bootstrapState?: DcfBootstrapRuntimeState
  schedule?: ScheduleSummary
  panelVisible: boolean
}

export interface AssistantWindowViewModel {
  bootstrapState: ScheduleStoreState["bootstrapState"]
  automationAuthorization: ScheduleStoreState["automationAuthorization"]
  schedule: ScheduleStoreState["schedule"]
  panelVisible: ScheduleStoreState["panelVisible"]
  shouldShowAutomationAuthorization: boolean
  canOperateSchedule: boolean
}

export class ScheduleStore {
  private readonly listeners = new Set<() => void>()

  private state: ScheduleStoreState = {
    automationAuthorization: { authorized: false },
    panelVisible: false,
  }

  getState(): ScheduleStoreState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  openPanel(): void {
    this.patchState({ panelVisible: true })
  }

  closePanel(): void {
    this.patchState({ panelVisible: false })
  }

  handleBootstrapState(event: FrontendBootstrapStateEvent): void {
    this.patchState({
      automationAuthorization: event.automationAuthorization,
      bootstrapState: event.dcfRuntime,
    })
  }

  handleAutomationAuthorized(event: FrontendAutomationAuthorizedEvent): void {
    this.patchState({
      automationAuthorization: {
        authorized: true,
        authorizedAt: event.authorizedAt,
      },
    })
  }

  handleScheduleStateSnapshot(event: FrontendScheduleStateSnapshotEvent): void {
    this.patchState({ schedule: event.schedules[0] })
  }

  handleScheduleEnabled(event: FrontendScheduleEnabledEvent): void {
    if (!this.state.schedule) {
      return
    }

    this.patchState({
      schedule: {
        ...this.state.schedule,
        enabled: true,
        nextTriggerAt: event.nextTriggerAt,
        lastStatus: "enabled",
      },
    })
  }

  handleScheduleDisabled(_event: FrontendScheduleDisabledEvent): void {
    if (!this.state.schedule) {
      return
    }

    this.patchState({
      schedule: {
        ...this.state.schedule,
        enabled: false,
        nextTriggerAt: undefined,
        lastStatus: "disabled",
      },
    })
  }

  private patchState(patch: Partial<ScheduleStoreState>): void {
    this.state = {
      ...this.state,
      ...patch,
    }
    this.emitChange()
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}

export class AssistantWindowChannelClient {
  constructor(
    private readonly deviceId: string,
    private readonly channel = "assistant_window",
    private readonly candidateKeys: string[] = ["dcf", "DCF", "dcf-subprocess", "dcf_subprocess"]
  ) {}

  bindEvents(listener: (event: DcfToFrontendEvent) => void): void {
    const bridge = this.getBridge()
    bridge.listen(this.channel, (message) => {
      const raw = message?.data?.[0]
      if (!raw) {
        return
      }
      listener(JSON.parse(raw) as DcfToFrontendEvent)
    })
  }

  async authorizeAutomation(): Promise<void> {
    const event: FrontendAutomationAuthorizedRequest = {
      type: "AUTHORIZE_AUTOMATION",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  async requestScheduleState(): Promise<void> {
    const event: FrontendScheduleStateEvent = {
      type: "SCHEDULE_STATE",
      deviceId: this.deviceId,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  async enableSchedule(scheduleId: string): Promise<void> {
    const event: FrontendScheduleEnableEvent = {
      type: "SCHEDULE_ENABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  async disableSchedule(scheduleId: string): Promise<void> {
    const event: FrontendScheduleDisableEvent = {
      type: "SCHEDULE_DISABLE",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  async triggerSchedule(scheduleId: string, requestedAt?: string): Promise<void> {
    const event: FrontendTriggerScheduleEvent = {
      type: "TRIGGER_SCHEDULE",
      deviceId: this.deviceId,
      scheduleId,
      requestedAt,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  private async send(event: unknown): Promise<void> {
    const bridge = this.getBridge()
    const windowId = await this.getDcfWindowId()
    await Promise.resolve(bridge.sendToWindow(windowId, this.channel, JSON.stringify(event)))
  }

  private getBridge(): BridgeApi {
    const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
    if (!bridge) {
      throw new Error("global BridgeJs/BridgeJS is not available")
    }
    return bridge
  }

  private async getDcfWindowId(): Promise<string> {
    if (typeof globalThis.getWinidsMap !== "function") {
      throw new Error("global getWinidsMap is not available")
    }

    const map = await globalThis.getWinidsMap()
    for (const key of this.candidateKeys) {
      const matched = Object.entries(map).find(
        ([mapKey, mapValue]) =>
          mapKey === key ||
          mapKey.includes(key) ||
          mapValue === key ||
          mapValue.includes(key)
      )
      if (matched) {
        return matched[1]
      }
    }

    const fallback = Object.values(map)[0]
    if (!fallback) {
      throw new Error("DCF windowId not found")
    }
    return fallback
  }
}

type FrontendAutomationAuthorizedRequest = {
  type: "AUTHORIZE_AUTOMATION"
  deviceId: string
  sentAt: string
}

export interface AssistantWindowRuntime {
  scheduleStore: ScheduleStore
  channelClient: AssistantWindowChannelClient
}

export function bootstrapAssistantWindow(deviceId = "device-001"): AssistantWindowRuntime {
  const scheduleStore = new ScheduleStore()
  const channelClient = new AssistantWindowChannelClient(deviceId)

  channelClient.bindEvents((event) => {
    applyAssistantWindowEvent(scheduleStore, event)
  })

  return {
    scheduleStore,
    channelClient,
  }
}

export function applyAssistantWindowEvent(
  scheduleStore: ScheduleStore,
  event: DcfToFrontendEvent
): void {
  switch (event.type) {
    case "BOOTSTRAP_STATE":
      scheduleStore.handleBootstrapState(event)
      return
    case "AUTOMATION_AUTHORIZED":
      scheduleStore.handleAutomationAuthorized(event)
      return
    case "SCHEDULE_STATE_SNAPSHOT":
      scheduleStore.handleScheduleStateSnapshot(event)
      return
    case "SCHEDULE_ENABLED":
      scheduleStore.handleScheduleEnabled(event)
      return
    case "SCHEDULE_DISABLED":
      scheduleStore.handleScheduleDisabled(event)
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
