import type { FrontendToDcfEvent } from "../../shared/protocol"
import { collectFrontendHandlerMetadata } from "./decorators"

type FrontendHandler = (event: FrontendToDcfEvent) => Promise<void> | void

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

