import { createStore } from "zustand/vanilla"
import type { StoreApi } from "zustand"
import type {
  FrontendAssistantDoneEvent,
  FrontendRunCancelledEvent,
  FrontendRunFailedEvent,
  FrontendRunStartedEvent,
  FrontendStepFinishedEvent,
  FrontendStepStartedEvent,
  RunDetailStatus,
  RunStepView,
} from "../../../../share/protocol"

export interface SessionRunView {
  runId: string
  sessionId: string
  status: RunDetailStatus
  steps: RunStepView[]
  createTime: string
  updateTime: string
  lastError?: string
}

export interface RunStoreState {
  runsBySessionId: Record<string, SessionRunView>
  activeRunCount: number
  applyRunStarted: (event: FrontendRunStartedEvent) => void
  applyStepStarted: (event: FrontendStepStartedEvent) => void
  applyStepFinished: (event: FrontendStepFinishedEvent) => void
  applyRunFailed: (event: FrontendRunFailedEvent) => void
  applyRunCancelled: (event: FrontendRunCancelledEvent) => void
  applyAssistantDone: (event: FrontendAssistantDoneEvent) => void
}

export type RunStoreApi = StoreApi<RunStoreState>

function countActiveRuns(runsBySessionId: Record<string, SessionRunView>): number {
  return Object.values(runsBySessionId).filter((item) => item.status === "running").length
}

export function createRunStore(): RunStoreApi {
  return createStore<RunStoreState>()((set) => ({
    runsBySessionId: {},
    activeRunCount: 0,
    applyRunStarted: (event) =>
      set((state) => {
        const nextRun: SessionRunView = {
          runId: event.runId,
          sessionId: event.sessionId,
          status: "running",
          steps: [],
          createTime: event.createTime,
          updateTime: event.sentAt,
        }
        const runsBySessionId: Record<string, SessionRunView> = {
          ...state.runsBySessionId,
          [event.sessionId]: nextRun,
        }

        return {
          runsBySessionId,
          activeRunCount: countActiveRuns(runsBySessionId),
        }
      }),
    applyStepStarted: (event) =>
      set((state) => {
        const current: SessionRunView =
          state.runsBySessionId[event.sessionId] ?? {
            runId: event.runId,
            sessionId: event.sessionId,
            status: "running",
            steps: [],
            createTime: event.startTime,
            updateTime: event.sentAt,
          }

        const nextStep: RunStepView = {
          stepId: event.stepId,
          runId: event.runId,
          title: event.title,
          toolName: event.toolName,
          input: event.input,
          status: "running",
          startTime: event.startTime,
        }

        const nextRun: SessionRunView = {
          ...current,
          status: "running",
          updateTime: event.sentAt,
          steps: [...current.steps.filter((item) => item.stepId !== event.stepId), nextStep],
        }

        const runsBySessionId: Record<string, SessionRunView> = {
          ...state.runsBySessionId,
          [event.sessionId]: nextRun,
        }

        return {
          runsBySessionId,
          activeRunCount: countActiveRuns(runsBySessionId),
        }
      }),
    applyStepFinished: (event) =>
      set((state) => {
        const current = state.runsBySessionId[event.sessionId]
        if (!current) {
          return state
        }

        const nextRun: SessionRunView = {
          ...current,
          updateTime: event.sentAt,
          steps: current.steps.map((item) =>
            item.stepId === event.stepId
              ? {
                  ...item,
                  status: event.status,
                  errorMessage: event.errorMessage,
                  endTime: event.endTime,
                }
              : item
          ),
        }

        const runsBySessionId: Record<string, SessionRunView> = {
          ...state.runsBySessionId,
          [event.sessionId]: nextRun,
        }

        return {
          runsBySessionId,
          activeRunCount: countActiveRuns(runsBySessionId),
        }
      }),
    applyRunFailed: (event) =>
      set((state) => {
        const current = state.runsBySessionId[event.sessionId]
        const nextRun: SessionRunView = {
          ...(current ?? {
            runId: event.runId,
            sessionId: event.sessionId,
            steps: [],
            createTime: event.sentAt,
            updateTime: event.sentAt,
          }),
          status: "failed",
          updateTime: event.sentAt,
          lastError: event.error,
        }

        const runsBySessionId: Record<string, SessionRunView> = {
          ...state.runsBySessionId,
          [event.sessionId]: nextRun,
        }

        return {
          runsBySessionId,
          activeRunCount: countActiveRuns(runsBySessionId),
        }
      }),
    applyRunCancelled: (event) =>
      set((state) => {
        const current = state.runsBySessionId[event.sessionId]
        const nextRun: SessionRunView = {
          ...(current ?? {
            runId: event.runId,
            sessionId: event.sessionId,
            steps: [],
            createTime: event.sentAt,
            updateTime: event.sentAt,
          }),
          status: "cancelled",
          updateTime: event.sentAt,
        }

        const runsBySessionId: Record<string, SessionRunView> = {
          ...state.runsBySessionId,
          [event.sessionId]: nextRun,
        }

        return {
          runsBySessionId,
          activeRunCount: countActiveRuns(runsBySessionId),
        }
      }),
    applyAssistantDone: (event) =>
      set((state) => {
        const current = state.runsBySessionId[event.sessionId]
        if (!current) {
          return state
        }

        const nextRun: SessionRunView = {
          ...current,
          status: current.status === "failed" ? "failed" : "completed",
          updateTime: event.sentAt,
        }

        const runsBySessionId: Record<string, SessionRunView> = {
          ...state.runsBySessionId,
          [event.sessionId]: nextRun,
        }

        return {
          runsBySessionId,
          activeRunCount: countActiveRuns(runsBySessionId),
        }
      }),
  }))
}
