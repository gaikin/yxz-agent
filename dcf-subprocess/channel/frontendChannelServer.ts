import type { FrontendToDcfEvent } from "../../types/appProtocol"
import { FrontendEventHandlerRegistry } from "./handlerFramework"

export class FrontendChannelServer {
  constructor(private readonly registry: FrontendEventHandlerRegistry) {}

  async receive(event: FrontendToDcfEvent | string): Promise<void> {
    const parsed = typeof event === "string" ? (JSON.parse(event) as FrontendToDcfEvent) : event
    await this.registry.dispatch(parsed)
  }
}
