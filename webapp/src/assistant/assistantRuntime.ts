import type { ScheduleStoreState } from "./scheduleStore"
import { bootstrapAssistantWindow } from "./bootstrapAssistantWindow"

export interface AssistantViewModel {
  bootstrapState: ScheduleStoreState["bootstrapState"]
  automationAuthorization: ScheduleStoreState["automationAuthorization"]
  schedule: ScheduleStoreState["schedule"]
  panelVisible: ScheduleStoreState["panelVisible"]
  shouldShowAutomationAuthorization: boolean
  canOperateSchedule: boolean
}

export interface AssistantRuntime {
  getViewModel(): AssistantViewModel
  subscribe(listener: () => void): () => void
  confirmAutomationAuthorization(): Promise<void>
  openSchedulePanel(): Promise<void>
  closeSchedulePanel(): void
  enableSchedule(): Promise<void>
  disableSchedule(): Promise<void>
}

function createViewModel(state: ScheduleStoreState): AssistantViewModel {
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

export function createAssistantRuntime(deviceId = "device-001"): AssistantRuntime {
  const runtime = bootstrapAssistantWindow(deviceId)

  return {
    getViewModel() {
      return createViewModel(runtime.scheduleStore.getState())
    },

    subscribe(listener) {
      return runtime.scheduleStore.subscribe(listener)
    },

    async confirmAutomationAuthorization() {
      await runtime.schedulePanelController.confirmAutomationAuthorization()
    },

    async openSchedulePanel() {
      await runtime.schedulePanelController.openSchedulePanel()
    },

    closeSchedulePanel() {
      runtime.schedulePanelController.closeSchedulePanel()
    },

    async enableSchedule() {
      await runtime.schedulePanelController.enableCurrentSchedule()
    },

    async disableSchedule() {
      await runtime.schedulePanelController.disableCurrentSchedule()
    },
  }
}
