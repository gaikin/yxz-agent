import type { PopupScheduleExecutionOverviewUpdatedEvent, ScheduleExecutionOverview, SchedulePendingExecutionItem } from "../../../types/appProtocol"

export type PopupExecutionMode = "hidden" | "pending" | "executing"

export interface PopupExecutionState {
  mode: PopupExecutionMode
  overview?: ScheduleExecutionOverview
  executingIds: string[]
}

export class PopupExecutionStore {
  private state: PopupExecutionState = {
    mode: "hidden",
    executingIds: [],
  }

  getState(): PopupExecutionState {
    return this.state
  }

  handleOverviewUpdated(event: PopupScheduleExecutionOverviewUpdatedEvent): void {
    const overview = event.overview

    if (this.state.mode === "executing") {
      if (overview.pendingCount === 0) {
        this.state = {
          mode: "hidden",
          executingIds: [],
        }
        return
      }

      this.state = {
        mode: "pending",
        overview,
        executingIds: [],
      }
      return
    }

    if (overview.pendingCount === 0) {
      this.state = {
        mode: "hidden",
        executingIds: [],
      }
      return
    }

    this.state = {
      mode: "pending",
      overview,
      executingIds: [],
    }
  }

  beginExecutingCurrentSnapshot(): SchedulePendingExecutionItem[] {
    const items = this.state.overview?.items ?? []
    this.state = {
      mode: "executing",
      overview: this.state.overview,
      executingIds: items.map((item) => item.executionId),
    }
    return items
  }

  closeAsDismissed(): SchedulePendingExecutionItem[] {
    const items = this.state.overview?.items ?? []
    this.state = {
      mode: "hidden",
      executingIds: [],
    }
    return items
  }

  canConfirm(): boolean {
    return this.state.mode === "pending" && (this.state.overview?.pendingCount ?? 0) > 0
  }

  canDismiss(): boolean {
    return this.state.mode === "pending" && (this.state.overview?.pendingCount ?? 0) > 0
  }
}

