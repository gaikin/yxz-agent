import { bootstrapPopup } from "./bootstrapPopup"
import type { PopupExecutionState } from "./popupExecutionStore"
import type { ScheduleExecutionOverview } from "../../../types/frontendProtocol"

export interface PopupRuntime {
  getViewModel(): PopupExecutionState
  confirmAll(): Promise<PopupExecutionState>
  dismissAll(): Promise<PopupExecutionState>
}

export interface CreatePopupRuntimeOptions {
  deviceId?: string
  initialOverview?: ScheduleExecutionOverview
}

export function createPopupRuntime(
  options: CreatePopupRuntimeOptions | string = "device-001"
): PopupRuntime {
  const resolvedOptions =
    typeof options === "string"
      ? {
          deviceId: options,
        }
      : options

  const runtime = bootstrapPopup(resolvedOptions.deviceId ?? "device-001")
  if (resolvedOptions.initialOverview) {
    runtime.popupExecutionStore.hydrateOverview(resolvedOptions.initialOverview)
  }

  return {
    getViewModel() {
      return runtime.popupExecutionStore.getState()
    },

    async confirmAll() {
      const items = runtime.popupExecutionStore.beginExecutingCurrentSnapshot()
      await runtime.popupChannelClient.confirmAll(
        items.map((item) => item.executionId)
      )
      return runtime.popupExecutionStore.getState()
    },

    async dismissAll() {
      const items = runtime.popupExecutionStore.closeAsDismissed()
      await runtime.popupChannelClient.dismissAll(
        items.map((item) => item.executionId)
      )
      return runtime.popupExecutionStore.getState()
    },
  }
}



