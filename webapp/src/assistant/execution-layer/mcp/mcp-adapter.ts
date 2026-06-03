import type { ChatCard } from "../../types/chat"
import { normalizeMcpNotification } from "../events/normalize-mcp-notification"
import type {
  HumanTakeoverRuntimeEvent,
  RuntimeEventContext,
} from "../events/runtime-events"
import { toOpenMenuToolResultPayload, type McpToolCallRawResult } from "./types"

export function adaptMcpToolResultToChatCard(
  _toolName: string,
  result: McpToolCallRawResult
): ChatCard | null {
  const payload = toOpenMenuToolResultPayload(result)
  if (!payload?.menuName) {
    return null
  }

  return {
    kind: "menu",
    data: {
      menuName: payload.menuName,
      menuCode: payload.menuCode,
      price: payload.price,
      description: payload.description,
      pageUrl: payload.pageUrl,
      tabId: payload.tabId,
      source: payload.source,
    },
  }
}

export function adaptMcpNotificationToRuntimeEvent(
  notification: {
    method?: string
    params?: unknown
  },
  context?: RuntimeEventContext
): HumanTakeoverRuntimeEvent | null {
  return normalizeMcpNotification(notification, context)
}
