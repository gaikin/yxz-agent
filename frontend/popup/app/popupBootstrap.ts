import type { DcfToPopupEvent } from "../../../types/appProtocol"
import { PopupChannelClient } from "../services/popupChannelClient"
import { PopupEventDispatcher } from "../services/popupEventDispatcher"
import { PopupExecutionStore } from "../stores/popupExecutionStore"

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
