import type {
  DcfToFrontendEvent,
  FrontendAssistantDeltaEvent,
  FrontendAssistantDoneEvent,
  FrontendRunCancelledEvent,
  FrontendRunFailedEvent,
  FrontendRunStartedEvent,
  FrontendSessionCreatedEvent,
  FrontendStepFinishedEvent,
  FrontendStepStartedEvent,
} from "../../../../../share/protocol"

export type AssistantRuntimeStreamEvent =
  | FrontendSessionCreatedEvent
  | FrontendRunStartedEvent
  | FrontendStepStartedEvent
  | FrontendStepFinishedEvent
  | FrontendAssistantDeltaEvent
  | FrontendAssistantDoneEvent
  | FrontendRunFailedEvent
  | FrontendRunCancelledEvent

export type AssistantStreamSnapshot = {
  sessionId: string
  runId?: string
  latestMessageId?: string
  status: "idle" | "running" | "completed" | "failed" | "cancelled"
  stepCount: number
  assistantText: string
}

const STREAM_EVENT_TYPES: ReadonlySet<string> = new Set([
  "SESSION_CREATED",
  "RUN_STARTED",
  "STEP_STARTED",
  "STEP_FINISHED",
  "ASSISTANT_DELTA",
  "ASSISTANT_DONE",
  "RUN_FAILED",
  "RUN_CANCELLED",
])

export function isAssistantRuntimeStreamEvent(
  event: DcfToFrontendEvent
): event is AssistantRuntimeStreamEvent {
  return STREAM_EVENT_TYPES.has(event.type)
}

export function reduceAssistantStreamSnapshot(
  previous: AssistantStreamSnapshot | undefined,
  event: AssistantRuntimeStreamEvent
): AssistantStreamSnapshot {
  switch (event.type) {
    case "SESSION_CREATED":
      return {
        sessionId: event.session.sessionId,
        runId: previous?.runId,
        latestMessageId: previous?.latestMessageId,
        status: previous?.status ?? "idle",
        stepCount: previous?.stepCount ?? 0,
        assistantText: previous?.assistantText ?? "",
      }
    case "RUN_STARTED":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: previous?.latestMessageId,
        status: "running",
        stepCount: 0,
        assistantText: "",
      }
    case "STEP_STARTED":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: previous?.latestMessageId,
        status: "running",
        stepCount: Math.max(previous?.stepCount ?? 0, 0) + 1,
        assistantText: previous?.assistantText ?? "",
      }
    case "STEP_FINISHED":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: previous?.latestMessageId,
        status: event.status === "failed" ? "failed" : previous?.status ?? "running",
        stepCount: previous?.stepCount ?? 0,
        assistantText: previous?.assistantText ?? "",
      }
    case "ASSISTANT_DELTA":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: event.messageId,
        status: "running",
        stepCount: previous?.stepCount ?? 0,
        assistantText: event.text,
      }
    case "ASSISTANT_DONE":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: event.messageId,
        status: "completed",
        stepCount: previous?.stepCount ?? 0,
        assistantText: event.text,
      }
    case "RUN_FAILED":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: previous?.latestMessageId,
        status: "failed",
        stepCount: previous?.stepCount ?? 0,
        assistantText: previous?.assistantText ?? "",
      }
    case "RUN_CANCELLED":
      return {
        sessionId: event.sessionId,
        runId: event.runId,
        latestMessageId: previous?.latestMessageId,
        status: "cancelled",
        stepCount: previous?.stepCount ?? 0,
        assistantText: previous?.assistantText ?? "",
      }
  }
}
