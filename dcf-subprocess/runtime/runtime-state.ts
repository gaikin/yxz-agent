import type { DcfBootstrapRuntimeState } from "../../shared/protocol"

export class RuntimeState {
  private state: DcfBootstrapRuntimeState = {
    dcfStatus: "starting",
    scheduleSubsystemReady: false,
  }

  set(next: Partial<DcfBootstrapRuntimeState>): void {
    this.state = { ...this.state, ...next }
  }

  snapshot(): DcfBootstrapRuntimeState {
    return { ...this.state }
  }
}

