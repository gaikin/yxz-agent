import { YXZ_EXTENSION_TARGET } from "../../../shared/hostRoutes"

export async function sendYxzRequest<T>(url: string, options: unknown[] = []): Promise<T> {
  if (typeof globalThis.socket?.sendRequest !== "function") {
    throw new Error("global socket.sendRequest is not available")
  }

  return globalThis.socket.sendRequest<T>({
    url,
    options,
    target: YXZ_EXTENSION_TARGET,
  })
}



