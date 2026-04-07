import type { ScheduleStore } from "../stores/scheduleStore"
import type { AssistantWindowChannelClient } from "../services/assistantWindowChannelClient"

export class SchedulePanelController {
  constructor(
    private readonly scheduleStore: ScheduleStore,
    private readonly channelClient: AssistantWindowChannelClient
  ) {}

  shouldShowAutomationAuthorization(): boolean {
    const state = this.scheduleStore.getState()
    return (
      state.bootstrapState?.dcfStatus === "online" &&
      state.bootstrapState?.scheduleSubsystemReady === true &&
      state.automationAuthorization.authorized === false
    )
  }

  async confirmAutomationAuthorization(): Promise<void> {
    await this.channelClient.authorizeAutomation()
  }

  async openSchedulePanel(): Promise<void> {
    this.scheduleStore.openPanel()
    await this.channelClient.requestScheduleState()
  }

  closeSchedulePanel(): void {
    this.scheduleStore.closePanel()
  }

  async enableCurrentSchedule(): Promise<void> {
    const schedule = this.scheduleStore.getState().schedule
    if (!schedule) {
      return
    }
    await this.channelClient.enableSchedule(schedule.scheduleId)
  }

  async disableCurrentSchedule(): Promise<void> {
    const schedule = this.scheduleStore.getState().schedule
    if (!schedule) {
      return
    }
    await this.channelClient.disableSchedule(schedule.scheduleId)
  }

  isScheduleActionEnabled(): boolean {
    const state = this.scheduleStore.getState()
    return (
      state.bootstrapState?.dcfStatus === "online" &&
      state.bootstrapState?.scheduleSubsystemReady === true &&
      state.automationAuthorization.authorized === true
    )
  }

  getViewModel() {
    const state = this.scheduleStore.getState()
    return {
      bootstrapState: state.bootstrapState,
      automationAuthorization: state.automationAuthorization,
      schedule: state.schedule,
      panelVisible: state.panelVisible,
      shouldShowAutomationAuthorization: this.shouldShowAutomationAuthorization(),
      canOperateSchedule: this.isScheduleActionEnabled(),
    }
  }
}

