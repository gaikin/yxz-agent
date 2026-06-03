import { toHumanTakeoverPayload } from "../mcp/types"
import type {
  HumanTakeoverRuntimeEvent,
  RuntimeEventContext,
} from "./runtime-events"

type McpNotificationPayload = {
  method?: string
  params?: unknown
}

const HUMAN_TAKEOVER_METHOD = "notifications/event/human_takeover"

export function normalizeMcpNotification(
  notification: McpNotificationPayload,
  context?: RuntimeEventContext
): HumanTakeoverRuntimeEvent | null {
  if (notification.method !== HUMAN_TAKEOVER_METHOD) {
    return null
  }

  const payload = toHumanTakeoverPayload(notification.params)
  if (!payload) {
    return null
  }

  return {
    EventId: `runtime-event-${crypto.randomUUID()}`,
    EventType: "HumanTakeoverReceived",
    EventTime: new Date().toISOString(),
    Source: "McpNotification",
    RawMethod: notification.method,
    ConversationId: payload.conversationId ?? context?.ConversationId,
    SessionLocalId: context?.SessionLocalId,
    RunId: context?.RunId,
    ToolName: context?.ToolName,
    Payload: {
      TakeoverType: payload.type,
      Message: payload.message,
      TabId: payload.tabId,
      MenuCode: payload.menuCode,
      MenuName: payload.menuName,
    },
  }
}
