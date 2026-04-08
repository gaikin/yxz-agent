import type { PopupToDcfEvent } from "../../types/appProtocol"
import { PopupEventHandlerRegistry } from "./handlerFramework"

export class PopupChannelServer {
  constructor(private readonly registry: PopupEventHandlerRegistry) {}

  async receive(event: PopupToDcfEvent | string): Promise<void> {
    const parsed = typeof event === "string" ? (JSON.parse(event) as PopupToDcfEvent) : event
    await this.registry.dispatch(parsed)
  }
}
