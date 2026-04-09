import type { ScheduleExecutionOverview } from "./protocol"

type HostWindowIdMap = Record<string, string>

export interface PopupPageInitData {
  deviceId?: string
  dcfWindowId?: string
  overview?: ScheduleExecutionOverview
}

declare global {
  interface BridgeMessage {
    data?: string[]
  }

  interface BridgeApi {
    listen(channel: string, listener: (message: BridgeMessage) => void): void
    sendToWindow(windowId: string, channel: string, data: string): void | Promise<void>
    getPageInitData?<T = unknown>(): T | Promise<T>
  }

  interface HostWindowEventApi {
    sendEventByWinId(
      winId: string,
      channel: string,
      data: string
    ): void | Promise<void>
  }

  interface HostSocketRequest<T = unknown> {
    url: string
    options?: unknown[]
    target: string
  }

  interface HostSocketApi {
    sendRequest<T>(request: HostSocketRequest<T>): Promise<T>
  }

  type RequestEventDecorator = (url: string) => (target: unknown, propertyKey: string) => void

  var BridgeJs: BridgeApi | undefined
  var BridgeJS: BridgeApi | undefined
  var getWinidsMap: (() => HostWindowIdMap | Promise<HostWindowIdMap>) | undefined
  var socket: HostSocketApi | undefined
  var sendEventByWinId: HostWindowEventApi["sendEventByWinId"] | undefined
  var requestEvent: RequestEventDecorator | undefined
  var ControllerAbstract:
    | ({
        new (socketServer: unknown): object
      } & Function)
    | undefined
}

export {}
