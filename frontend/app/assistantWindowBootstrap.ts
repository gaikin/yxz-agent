import type { DcfToFrontendEvent } from "../../types/appProtocol"
import { AssistantWindowChannelClient } from "../services/assistantWindowChannelClient"
import { EventDispatcher } from "../services/eventDispatcher"
import { ScheduleStore } from "../stores/scheduleStore"
import { SchedulePanelController } from "../controllers/schedulePanelController"

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
