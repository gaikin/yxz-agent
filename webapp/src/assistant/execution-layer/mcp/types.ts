type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }
  return value as UnknownRecord
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

export type HumanTakeoverPayload = {
  conversationId?: string
  tabId?: string
  menuCode?: string
  menuName?: string
  type?: string
  message?: string
}

export type OpenMenuToolResultPayload = {
  menuCode?: string
  menuName?: string
  price?: number
  description?: string
  pageUrl?: string
  tabId?: string
  source?: string
}

export type McpTextContentPart = {
  type: "text"
  text: string
}

export type McpToolContentPart = McpTextContentPart | { type: string }

export type McpToolCallRawResult = {
  content?: McpToolContentPart[]
  structuredContent?: unknown
  isError?: boolean
}

export function toHumanTakeoverPayload(value: unknown): HumanTakeoverPayload | null {
  const record = asRecord(value)
  if (!record) {
    return null
  }

  return {
    conversationId: readString(record.conversationId),
    tabId: readString(record.tabId),
    menuCode: readString(record.menuCode),
    menuName: readString(record.menuName),
    type: readString(record.type),
    message: readString(record.message),
  }
}

export function toOpenMenuToolResultPayload(value: unknown): OpenMenuToolResultPayload | null {
  const topLevel = asRecord(value)
  const result = asRecord(topLevel?.structuredContent) ?? topLevel
  if (!result) {
    return null
  }

  const rawPrice = result.price
  const parsedPrice =
    readNumber(rawPrice) ??
    (typeof rawPrice === "string" && rawPrice.trim() ? Number(rawPrice) : undefined)

  return {
    menuCode: readString(result.menuCode),
    menuName: readString(result.menuName),
    price: parsedPrice !== undefined && Number.isFinite(parsedPrice) ? parsedPrice : undefined,
    description: readString(result.description),
    pageUrl: readString(result.pageUrl),
    tabId: readString(result.tabId),
    source: readString(result.source),
  }
}
