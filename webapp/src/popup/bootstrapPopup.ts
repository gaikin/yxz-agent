import type { DcfToPopupEvent } from "../../../types/frontendProtocol"
import { PopupChannelClient } from "./popupChannelClient"
import { PopupEventDispatcher } from "./popupEventDispatcher"
import { PopupExecutionStore } from "./popupExecutionStore"

export interface PopupBootstrapResult {
  popupExecutionStore: PopupExecutionStore
  popupEventDispatcher: PopupEventDispatcher
  popupChannelClient: PopupChannelClient
}

export function bootstrapPopup(deviceId = "device-001"): PopupBootstrapResult {
  const popupExecutionStore = new PopupExecutionStore()
  const popupEventDispatcher = new PopupEventDispatcher(popupExecutionStore)
  const popupChannelClient = new PopupChannelClient(deviceId)

  popupChannelClient.bindEvents((event: DcfToPopupEvent) => {
    popupEventDispatcher.dispatch(event)
  })

  return {
    popupExecutionStore,
    popupEventDispatcher,
    popupChannelClient,
  }
}



