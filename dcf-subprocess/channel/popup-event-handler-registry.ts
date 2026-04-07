import type { PopupToDcfEvent } from "../../shared/protocol"
import { collectPopupHandlerMetadata } from "./decorators"

type PopupHandler = (event: PopupToDcfEvent) => Promise<void> | void

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

