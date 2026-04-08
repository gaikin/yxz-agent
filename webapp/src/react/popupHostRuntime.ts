import { createPopupRuntime, type PopupRuntime } from "../popup/popupRuntime"
import type { PopupPageInitData } from "../../../types/hostGlobals"

let popupRuntimePromise: Promise<PopupRuntime> | undefined

export async function getPopupRuntimeFromHost(): Promise<PopupRuntime> {
  if (!popupRuntimePromise) {
    popupRuntimePromise = createRuntime()
  }
  return popupRuntimePromise
}

async function createRuntime(): Promise<PopupRuntime> {
  const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
  const rawPageInitData =
    typeof bridge?.getPageInitData === "function" ? await bridge.getPageInitData<unknown>() : {}
  const pageInitData = normalizePopupPageInitData(rawPageInitData)

  return createPopupRuntime({
    deviceId: pageInitData.deviceId ?? "device-001",
    initialOverview: pageInitData.overview,
  })
}

function normalizePopupPageInitData(rawPageInitData: unknown): PopupPageInitData {
  if (!rawPageInitData) {
    return {}
  }

  if (typeof rawPageInitData === "string") {
    try {
      return JSON.parse(rawPageInitData) as PopupPageInitData
    } catch {
      return {}
    }
  }

  return rawPageInitData as PopupPageInitData
}



