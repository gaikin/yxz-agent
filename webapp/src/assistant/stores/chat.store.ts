import { createStore } from "zustand/vanilla"
import type { StoreApi } from "zustand"
import type {
  AgentSummary,
  FrontendAgentSnapshotEvent,
  FrontendAssistantDeltaEvent,
  FrontendAssistantDoneEvent,
  FrontendRunCancelledEvent,
  FrontendRunFailedEvent,
  FrontendRunStartedEvent,
  FrontendSessionCreatedEvent,
  FrontendSessionDetailEvent,
  FrontendSessionSnapshotEvent,
  SessionDetail,
  SessionListRunStatus,
  SessionSummary,
} from "../../../../share/protocol"
import { formatDisplayTime, formatNow } from "../../shared/utils/dateTime"
import { defaultAgents, welcomeMessages } from "../dev-fixtures/agentWorkspace"
import type { ChatMessage, ChatMessageVariant } from "../types/chat"

type SessionSource = "draft" | "web"

export interface AssistantSessionItem {
  sessionId: string
  title: string
  preview: string
  updatedAt: string
  createTime?: string
  conversationId: string | null
  agentName?: string
  lastRunStatus: SessionListRunStatus
  runtimeStatus: string
  source: SessionSource
  messages: ChatMessage[]
}

export interface ChatStoreState {
  agents: AgentSummary[]
  activeAgentId?: string
  sessions: AssistantSessionItem[]
  activeSessionId: string
  draft: string
  setDraft: (draft: string) => void
  activateSession: (sessionId: string) => void
  selectAgent: (agentId: string) => void
  createLocalDraftSession: () => void
  appendLocalUserMessage: (sessionId: string, text: string) => void
  appendLocalSystemMessage: (
    sessionId: string,
    text: string,
    variant?: ChatMessageVariant,
    card?: ChatMessage["card"]
  ) => void
  applyAgentSnapshot: (event: FrontendAgentSnapshotEvent) => void
  applySessionSnapshot: (event: FrontendSessionSnapshotEvent) => void
  applySessionDetail: (event: FrontendSessionDetailEvent) => void
  applySessionCreated: (event: FrontendSessionCreatedEvent) => void
  applyRunStarted: (event: FrontendRunStartedEvent) => void
  applyAssistantDelta: (event: FrontendAssistantDeltaEvent) => void
  applyAssistantDone: (event: FrontendAssistantDoneEvent) => void
  applyRunFailed: (event: FrontendRunFailedEvent) => void
  applyRunCancelled: (event: FrontendRunCancelledEvent) => void
}

export type ChatStoreApi = StoreApi<ChatStoreState>

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function createSystemMessage(text: string, variant: ChatMessageVariant = "default"): ChatMessage {
  return {
    id: createId("system"),
    role: "system",
    author: "系统提示",
    time: formatDisplayTime(formatNow()),
    text,
    status: "done",
    variant,
  }
}

function draftSession(agentName?: string): AssistantSessionItem {
  return {
    sessionId: createId("draft-session"),
    title: "新对话",
    preview: "等待发送第一条消息",
    updatedAt: formatDisplayTime(formatNow()),
    conversationId: null,
    agentName,
    lastRunStatus: "idle",
    runtimeStatus: "等待发送",
    source: "draft",
    messages: welcomeMessages.map((item) => ({ ...item })),
  }
}

function protocolMessageToUi(message: SessionDetail["messages"][number]): ChatMessage {
  return {
    id: message.messageId,
    role: message.role,
    author: message.role === "user" ? "你" : "营小助",
    time: formatDisplayTime(message.createTime),
    text: message.content,
    status: message.role === "assistant" && message.status === "streaming" ? "streaming" : "done",
  }
}

function derivePreview(messages: ChatMessage[]): string {
  const latestVisibleMessage = [...messages]
    .reverse()
    .find((item) => item.text.trim().length > 0)

  if (!latestVisibleMessage) {
    return "等待第一条消息"
  }

  const text = latestVisibleMessage.text.replace(/\s+/g, " ").trim()
  return text.length > 36 ? `${text.slice(0, 36)}...` : text
}

function fromSummary(summary: SessionSummary, previous?: AssistantSessionItem): AssistantSessionItem {
  return {
    sessionId: summary.sessionId,
    title: summary.title,
    preview: summary.lastMessagePreview ?? previous?.preview ?? "等待查看会话详情",
    updatedAt: formatDisplayTime(summary.updateTime),
    createTime: summary.createTime,
    conversationId: summary.sessionId,
    agentName: summary.agent.agentName,
    lastRunStatus: summary.lastRunStatus,
    runtimeStatus:
      summary.lastRunStatus === "running"
        ? "执行中"
        : summary.lastRunStatus === "failed"
          ? "执行失败"
          : "在线待命",
    source: "web",
    messages: previous?.messages ?? [],
  }
}

function fromDetail(detail: SessionDetail): AssistantSessionItem {
  const messages = detail.messages.map(protocolMessageToUi)

  return {
    sessionId: detail.sessionId,
    title: detail.title,
    preview: derivePreview(messages),
    updatedAt: formatDisplayTime(detail.updateTime),
    createTime: detail.createTime,
    conversationId: detail.sessionId,
    agentName: detail.agent.agentName,
    lastRunStatus: detail.lastRun?.status === "failed" ? "failed" : "idle",
    runtimeStatus: detail.lastRun?.status === "running" ? "执行中" : "在线待命",
    source: "web",
    messages,
  }
}

function upsertSession(
  sessions: AssistantSessionItem[],
  nextSession: AssistantSessionItem
): AssistantSessionItem[] {
  const filtered = sessions.filter((item) => item.sessionId !== nextSession.sessionId)
  return [nextSession, ...filtered]
}

function patchSession(
  sessions: AssistantSessionItem[],
  sessionId: string,
  updater: (session: AssistantSessionItem) => AssistantSessionItem
): AssistantSessionItem[] {
  return sessions.map((session) => (session.sessionId === sessionId ? updater(session) : session))
}

function ensureSession(
  sessions: AssistantSessionItem[],
  sessionId: string
): AssistantSessionItem[] {
  if (sessions.some((item) => item.sessionId === sessionId)) {
    return sessions
  }

  return [
    {
      sessionId,
      title: "业务会话",
      preview: "等待更多运行事件",
      updatedAt: formatDisplayTime(formatNow()),
      conversationId: sessionId,
      lastRunStatus: "running",
      runtimeStatus: "执行中",
      source: "web",
      messages: [],
    },
    ...sessions,
  ]
}

function upsertAssistantMessage(
  messages: ChatMessage[],
  messageId: string,
  text: string,
  done: boolean
): ChatMessage[] {
  const existing = messages.find((item) => item.id === messageId)
  if (!existing) {
    return [
      ...messages,
      {
        id: messageId,
        role: "assistant",
        author: "营小助",
        time: formatDisplayTime(formatNow()),
        text,
        status: done ? "done" : "streaming",
      },
    ]
  }

  return messages.map((item) =>
    item.id === messageId
      ? {
          ...item,
          text,
          status: done ? "done" : "streaming",
        }
      : item
  )
}

export function createChatStore(): ChatStoreApi {
  const initialSession = draftSession(defaultAgents[0]?.agentName)

  return createStore<ChatStoreState>()((set) => ({
    agents: defaultAgents,
    activeAgentId: defaultAgents[0]?.agentId,
    sessions: [initialSession],
    activeSessionId: initialSession.sessionId,
    draft: "",
    setDraft: (draft) => set({ draft }),
    activateSession: (sessionId) => set({ activeSessionId: sessionId }),
    selectAgent: (agentId) => set({ activeAgentId: agentId }),
    createLocalDraftSession: () =>
      set((state) => {
        const nextSession = draftSession(
          state.agents.find((item) => item.agentId === state.activeAgentId)?.agentName
        )
        return {
          sessions: [nextSession, ...state.sessions],
          activeSessionId: nextSession.sessionId,
        }
      }),
    appendLocalUserMessage: (sessionId, text) =>
      set((state) => ({
        sessions: patchSession(state.sessions, sessionId, (session) => {
          const nextMessage: ChatMessage = {
            id: createId("user"),
            role: "user",
            author: "你",
            time: formatDisplayTime(formatNow()),
            text,
            status: "done",
          }
          const messages = [
            ...session.messages,
            nextMessage,
          ]

          return {
            ...session,
            preview: derivePreview(messages),
            updatedAt: formatDisplayTime(formatNow()),
            messages,
          }
        }),
      })),
    appendLocalSystemMessage: (sessionId, text, variant = "default", card) =>
      set((state) => ({
        sessions: patchSession(state.sessions, sessionId, (session) => {
          const systemMessage = createSystemMessage(text, variant)
          const messages = [
            ...session.messages,
            card
              ? {
                  ...systemMessage,
                  card,
                }
              : systemMessage,
          ]
          return {
            ...session,
            preview: derivePreview(messages),
            updatedAt: formatDisplayTime(formatNow()),
            messages,
          }
        }),
      })),
    applyAgentSnapshot: (event) =>
      set({
        agents: event.agents.length ? event.agents : defaultAgents,
        activeAgentId: event.agents[0]?.agentId ?? defaultAgents[0]?.agentId,
      }),
    applySessionSnapshot: (event) =>
      set((state) => {
        const previousById = new Map(state.sessions.map((item) => [item.sessionId, item]))
        const backendSessions = event.sessions.map((summary) =>
          fromSummary(summary, previousById.get(summary.sessionId))
        )
        const sessions = backendSessions.length ? backendSessions : state.sessions
        return {
          sessions,
          activeSessionId:
            sessions.find((item) => item.sessionId === state.activeSessionId)?.sessionId ??
            sessions[0]?.sessionId ??
            state.activeSessionId,
        }
      }),
    applySessionDetail: (event) =>
      set((state) => ({
        sessions: upsertSession(state.sessions, fromDetail(event.session)),
        activeSessionId: event.session.sessionId,
      })),
    applySessionCreated: (event) =>
      set((state) => ({
        sessions: upsertSession(state.sessions, fromDetail(event.session)),
        activeSessionId: event.session.sessionId,
      })),
    applyRunStarted: (event) =>
      set((state) => ({
        sessions: patchSession(ensureSession(state.sessions, event.sessionId), event.sessionId, (session) => ({
          ...session,
          lastRunStatus: "running",
          runtimeStatus: "执行中",
          updatedAt: formatDisplayTime(event.sentAt),
        })),
      })),
    applyAssistantDelta: (event) =>
      set((state) => ({
        sessions: patchSession(ensureSession(state.sessions, event.sessionId), event.sessionId, (session) => {
          const messages = upsertAssistantMessage(
            session.messages,
            event.messageId,
            event.text,
            false
          )

          return {
            ...session,
            lastRunStatus: "running",
            runtimeStatus: "生成中",
            preview: derivePreview(messages),
            updatedAt: formatDisplayTime(event.sentAt),
            messages,
          }
        }),
      })),
    applyAssistantDone: (event) =>
      set((state) => ({
        sessions: patchSession(ensureSession(state.sessions, event.sessionId), event.sessionId, (session) => {
          const messages = upsertAssistantMessage(
            session.messages,
            event.messageId,
            event.text,
            true
          )

          return {
            ...session,
            lastRunStatus: "idle",
            runtimeStatus: "在线待命",
            preview: derivePreview(messages),
            updatedAt: formatDisplayTime(event.sentAt),
            messages,
          }
        }),
      })),
    applyRunFailed: (event) =>
      set((state) => ({
        sessions: patchSession(ensureSession(state.sessions, event.sessionId), event.sessionId, (session) => {
          const messages = [...session.messages, createSystemMessage(event.error, "error")]
          return {
            ...session,
            lastRunStatus: "failed",
            runtimeStatus: "执行失败",
            preview: derivePreview(messages),
            updatedAt: formatDisplayTime(event.sentAt),
            messages,
          }
        }),
      })),
    applyRunCancelled: (event) =>
      set((state) => ({
        sessions: patchSession(ensureSession(state.sessions, event.sessionId), event.sessionId, (session) => {
          const messages = [...session.messages, createSystemMessage("当前任务已取消。", "action")]
          return {
            ...session,
            lastRunStatus: "idle",
            runtimeStatus: "已取消",
            preview: derivePreview(messages),
            updatedAt: formatDisplayTime(event.sentAt),
            messages,
          }
        }),
      })),
  }))
}
