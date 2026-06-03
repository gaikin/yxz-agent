export type RuntimeEventType =
  | "HumanTakeoverReceived"
  | "AgentStatusChanged"
  | "AgentWarningReceived"

export type RuntimeEventSource = "McpNotification" | "AssistantWindowRuntime"

export type RuntimeEventBase = {
  EventId: string
  EventType: RuntimeEventType
  EventTime: string
  Source: RuntimeEventSource
  RawMethod?: string
  ConversationId?: string
  SessionLocalId?: string
  RunId?: string
  ToolName?: string
}

export type HumanTakeoverRuntimeEvent = RuntimeEventBase & {
  EventType: "HumanTakeoverReceived"
  Payload: {
    TakeoverType?: string
    Message?: string
    TabId?: string
    MenuCode?: string
    MenuName?: string
  }
}

export type AgentStatusRuntimeEvent = RuntimeEventBase & {
  EventType: "AgentStatusChanged"
  Payload: {
    Status: "Connecting" | "Connected" | "Disconnected" | "Reconnecting" | "Error"
    AgentEndpoint?: string
    ErrorMessage?: string
  }
}

export type AgentWarningRuntimeEvent = RuntimeEventBase & {
  EventType: "AgentWarningReceived"
  Payload: {
    WarningCode?: string
    Message: string
    Severity?: "Info" | "Warning" | "Error"
  }
}

export type RuntimeEvent =
  | HumanTakeoverRuntimeEvent
  | AgentStatusRuntimeEvent
  | AgentWarningRuntimeEvent

export type RuntimeEventFilter = {
  EventType?: RuntimeEventType
  ConversationId?: string
  SessionLocalId?: string
  RunId?: string
  ToolName?: string
}

export type RuntimeEventHandler<T extends RuntimeEvent = RuntimeEvent> = (
  event: T
) => void | Promise<void>

export type RuntimeEventContext = {
  ConversationId?: string
  SessionLocalId?: string
  RunId?: string
  ToolName?: string
}
