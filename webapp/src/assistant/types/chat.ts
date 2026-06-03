export type ChatRole = "assistant" | "user" | "system"

export type ChatMessageVariant = "default" | "action" | "success" | "error"

export type ChatMessageStatus = "streaming" | "done" | "error"

export type ChatMessage = {
  id: string
  role: ChatRole
  author: string
  time: string
  text: string
  status?: ChatMessageStatus
  variant?: ChatMessageVariant
  card?: ChatCard
}

export type MenuCardData = {
  menuCode?: string
  menuName: string
  price?: number
  description?: string
  pageUrl?: string
  tabId?: string
  source?: string
}

export type ChatCard =
  | {
      kind: "menu"
      data: MenuCardData
    }
