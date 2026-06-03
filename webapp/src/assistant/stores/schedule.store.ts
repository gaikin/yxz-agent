import { createStore } from "zustand/vanilla"
import type { StoreApi } from "zustand"
import type {
  AutomationAuthorizationState,
  DcfBootstrapRuntimeState,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnabledEvent,
  FrontendScheduleStateSnapshotEvent,
  ScheduleSummary,
} from "../../../../share/protocol"

export interface ScheduleStoreState {
  automationAuthorization: AutomationAuthorizationState
  bootstrapState?: DcfBootstrapRuntimeState
  schedules: ScheduleSummary[]
  schedule?: ScheduleSummary
  panelVisible: boolean
  openPanel: () => void
  closePanel: () => void
  applyBootstrapState: (event: FrontendBootstrapStateEvent) => void
  applyAutomationAuthorized: (event: FrontendAutomationAuthorizedEvent) => void
  applyScheduleStateSnapshot: (event: FrontendScheduleStateSnapshotEvent) => void
  applyScheduleEnabled: (event: FrontendScheduleEnabledEvent) => void
  applyScheduleDisabled: (event: FrontendScheduleDisabledEvent) => void
}

export type ScheduleStoreApi = StoreApi<ScheduleStoreState>

function patchActiveSchedule(
  schedules: ScheduleSummary[],
  currentSchedule: ScheduleSummary | undefined
): ScheduleSummary | undefined {
  if (!schedules.length) {
    return undefined
  }

  if (!currentSchedule) {
    return schedules[0]
  }

  return schedules.find((item) => item.scheduleId === currentSchedule.scheduleId) ?? schedules[0]
}

export function createScheduleStore(): ScheduleStoreApi {
  return createStore<ScheduleStoreState>()((set) => ({
    automationAuthorization: { authorized: false },
    panelVisible: false,
    schedules: [],
    schedule: undefined,
    openPanel: () => set({ panelVisible: true }),
    closePanel: () => set({ panelVisible: false }),
    applyBootstrapState: (event) =>
      set({
        automationAuthorization: event.automationAuthorization,
        bootstrapState: event.dcfRuntime,
      }),
    applyAutomationAuthorized: (event) =>
      set({
        automationAuthorization: {
          authorized: true,
          authorizedAt: event.authorizedAt,
        },
      }),
    applyScheduleStateSnapshot: (event) =>
      set((state) => ({
        schedules: event.schedules,
        schedule: patchActiveSchedule(event.schedules, state.schedule),
      })),
    applyScheduleEnabled: (event) =>
      set((state) => {
        const schedules: ScheduleSummary[] = state.schedules.map((item) =>
          item.scheduleId === event.scheduleId
            ? {
                ...item,
                enabled: true,
                nextTriggerAt: event.nextTriggerAt,
                lastStatus: "enabled",
              }
            : item
        )

        return {
          schedules,
          schedule: patchActiveSchedule(schedules, state.schedule),
        }
      }),
    applyScheduleDisabled: (event) =>
      set((state) => {
        const schedules: ScheduleSummary[] = state.schedules.map((item) =>
          item.scheduleId === event.scheduleId
            ? {
                ...item,
                enabled: false,
                nextTriggerAt: undefined,
                lastStatus: "disabled",
              }
            : item
        )

        return {
          schedules,
          schedule: patchActiveSchedule(schedules, state.schedule),
        }
      }),
  }))
}
