import type { DcfToFrontendEvent } from "../../../types/frontendProtocol"
import { AssistantWindowChannelClient } from "./assistantWindowChannelClient"
import { EventDispatcher } from "./eventDispatcher"
import { ScheduleStore } from "./scheduleStore"
import { SchedulePanelController } from "./schedulePanelController"

export interface AssistantWindowBootstrapResult {
  scheduleStore: ScheduleStore
  eventDispatcher: EventDispatcher
  channelClient: AssistantWindowChannelClient
  schedulePanelController: SchedulePanelController
}

export function bootstrapAssistantWindow(deviceId = "device-001"): AssistantWindowBootstrapResult {
  const scheduleStore = new ScheduleStore()
  const eventDispatcher = new EventDispatcher(scheduleStore)
  const channelClient = new AssistantWindowChannelClient(deviceId)
  const schedulePanelController = new SchedulePanelController(scheduleStore, channelClient)

  channelClient.bindEvents((event: DcfToFrontendEvent) => {
    eventDispatcher.dispatch(event)
  })

  return {
    scheduleStore,
    eventDispatcher,
    channelClient,
    schedulePanelController,
  }
}



