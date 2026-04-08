import type {
  AutomationAuthorizationState,
  DcfBootstrapRuntimeState,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateSnapshotEvent,
  ScheduleSummary,
} from "../../types/appProtocol"

export interface ScheduleStoreState {
  automationAuthorization: AutomationAuthorizationState
  bootstrapState?: DcfBootstrapRuntimeState
  schedule?: ScheduleSummary
  panelVisible: boolean
}

export class ScheduleStore {
  private state: ScheduleStoreState = {
    automationAuthorization: { authorized: false },
    panelVisible: false,
  }

  getState(): ScheduleStoreState {
    return this.state
  }

  handleBootstrapState(event: FrontendBootstrapStateEvent): void {
    this.state = {
      ...this.state,
      automationAuthorization: event.automationAuthorization,
      bootstrapState: event.dcfRuntime,
    }
  }

  handleAutomationAuthorized(event: FrontendAutomationAuthorizedEvent): void {
    this.state = {
      ...this.state,
      automationAuthorization: {
        authorized: true,
        authorizedAt: event.authorizedAt,
      },
    }
  }

  handleScheduleStateSnapshot(event: FrontendScheduleStateSnapshotEvent): void {
    this.state = {
      ...this.state,
      schedule: event.schedules[0],
    }
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
  }

  openPanel(): void {
    this.state = {
      ...this.state,
      panelVisible: true,
    }
  }

  closePanel(): void {
    this.state = {
      ...this.state,
      panelVisible: false,
    }
  }
}

