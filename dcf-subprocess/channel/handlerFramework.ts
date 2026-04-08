import type { FrontendToDcfEvent, PopupToDcfEvent } from "../../types/appProtocol"

const frontendHandlerMetadata = new WeakMap<object, Array<{ eventType: string; propertyKey: string }>>()
const popupHandlerMetadata = new WeakMap<object, Array<{ eventType: string; propertyKey: string }>>()

function registerMetadata(
  store: WeakMap<object, Array<{ eventType: string; propertyKey: string }>>,
  target: object,
  eventType: string,
  propertyKey: string
): void {
  const current = store.get(target) ?? []
  current.push({ eventType, propertyKey })
  store.set(target, current)
}

export interface SocketServerLike {
  emit(eventName: string, payload: unknown): Promise<void> | void
}

class NoopSocketServer implements SocketServerLike {
  emit(_eventName: string, _payload: unknown): void {}
}

export abstract class ControllerAbstract {
  protected readonly socketServer: SocketServerLike

  constructor(socketServer: SocketServerLike = new NoopSocketServer()) {
    this.socketServer = socketServer
  }

  protected emit(eventName: string, payload: unknown): Promise<void> {
    return Promise.resolve(this.socketServer.emit(eventName, payload))
  }
}

export function FrontendEventHandler<TType extends string>(eventType: TType) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ): void {
    registerMetadata(frontendHandlerMetadata, target, eventType, propertyKey)
  }
}

export function PopupEventHandler<TType extends string>(eventType: TType) {
  return function (
    target: object,
    propertyKey: string,
    _descriptor: PropertyDescriptor
  ): void {
    registerMetadata(popupHandlerMetadata, target, eventType, propertyKey)
  }
}

export function collectFrontendHandlerMetadata(target: object) {
  return frontendHandlerMetadata.get(Object.getPrototypeOf(target)) ?? []
}

export function collectPopupHandlerMetadata(target: object) {
  return popupHandlerMetadata.get(Object.getPrototypeOf(target)) ?? []
}

type FrontendHandler = (event: FrontendToDcfEvent) => Promise<void> | void
type PopupHandler = (event: PopupToDcfEvent) => Promise<void> | void

export class FrontendEventHandlerRegistry {
  private readonly handlers = new Map<string, FrontendHandler>()

  registerController(controller: object): void {
    for (const metadata of collectFrontendHandlerMetadata(controller)) {
      const handler = (controller as Record<string, FrontendHandler>)[metadata.propertyKey]
      this.handlers.set(metadata.eventType, handler.bind(controller))
    }
  }

  async dispatch(event: FrontendToDcfEvent): Promise<void> {
    const handler = this.handlers.get(event.type)
    if (!handler) {
      return
    }
    await handler(event)
  }
}

export class PopupEventHandlerRegistry {
  private readonly handlers = new Map<string, PopupHandler>()

  registerController(controller: object): void {
    for (const metadata of collectPopupHandlerMetadata(controller)) {
      const handler = (controller as Record<string, PopupHandler>)[metadata.propertyKey]
      this.handlers.set(metadata.eventType, handler.bind(controller))
    }
  }

  async dispatch(event: PopupToDcfEvent): Promise<void> {
    const handler = this.handlers.get(event.type)
    if (!handler) {
      return
    }
    await handler(event)
  }
}

