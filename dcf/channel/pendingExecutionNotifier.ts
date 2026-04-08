import type { ScheduleExecutionOverview } from "../../types/frontendProtocol"

export interface PendingExecutionNotifier {
  notify(overview: ScheduleExecutionOverview): Promise<void>
}

export interface HostPendingExecutionCallback {
  onPendingExecutionsUpdated(overview: ScheduleExecutionOverview): Promise<void> | void
}

export class HostPendingExecutionNotifier implements PendingExecutionNotifier {
  constructor(private readonly callback: HostPendingExecutionCallback) {}

  async notify(overview: ScheduleExecutionOverview): Promise<void> {
    await Promise.resolve(this.callback.onPendingExecutionsUpdated(overview))
  }
}

export class CompositePendingExecutionNotifier implements PendingExecutionNotifier {
  constructor(private readonly notifiers: PendingExecutionNotifier[]) {}

  async notify(overview: ScheduleExecutionOverview): Promise<void> {
    for (const notifier of this.notifiers) {
      await notifier.notify(overview)
    }
  }
}


