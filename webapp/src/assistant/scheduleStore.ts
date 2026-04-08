import type {
  AutomationAuthorizationState,
  DcfBootstrapRuntimeState,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateSnapshotEvent,
  ScheduleSummary,
} from "../../../types/frontendProtocol"

export interface ScheduleStoreState {
  automationAuthorization: AutomationAuthorizationState
  bootstrapState?: DcfBootstrapRuntimeState
  schedule?: ScheduleSummary
  panelVisible: boolean
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

  handleBootstrapState(event: FrontendBootstrapStateEvent): void {
    this.state = {
      ...this.state,
      automationAuthorization: event.automationAuthorization,
      bootstrapState: event.dcfRuntime,
    }
    this.emitChange()
  }

  handleAutomationAuthorized(event: FrontendAutomationAuthorizedEvent): void {
    this.state = {
      ...this.state,
      automationAuthorization: {
        authorized: true,
        authorizedAt: event.authorizedAt,
      },
    }
    this.emitChange()
  }

  handleScheduleStateSnapshot(event: FrontendScheduleStateSnapshotEvent): void {
    this.state = {
      ...this.state,
      schedule: event.schedules[0],
    }
    this.emitChange()
  }

  handleScheduleEnabled(event: FrontendScheduleEnabledEvent): void {
    if (!this.state.schedule) {
      return
    }
    this.state = {
      ...this.state,
      schedule: {
        ...this.state.schedule,
        enabled: true,
        nextTriggerAt: event.nextTriggerAt,
        lastStatus: "enabled",
      },
    }
    this.emitChange()
  }

  handleScheduleDisabled(event: FrontendScheduleDisabledEvent): void {
    if (!this.state.schedule) {
      return
    }
    this.state = {
      ...this.state,
      schedule: {
        ...this.state.schedule,
        enabled: false,
        nextTriggerAt: undefined,
        lastStatus: "disabled",
      },
    }
    this.emitChange()
  }

  openPanel(): void {
    this.state = {
      ...this.state,
      panelVisible: true,
    }
    this.emitChange()
  }

  closePanel(): void {
    this.state = {
      ...this.state,
      panelVisible: false,
    }
    this.emitChange()
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }
}



