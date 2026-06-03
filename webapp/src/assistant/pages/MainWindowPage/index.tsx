import { message as antdMessage } from "antd"
import { useEffect } from "react"
import { useStore } from "zustand"
import type { AssistantWindowRuntime, AssistantWindowViewModel } from "../../../pages/Assistant/runtime"
import { quickPrompts } from "../../dev-fixtures/agentWorkspace"
import { AppShell } from "../../components/AppShell"
import { ChatWorkspace } from "../../components/ChatWorkspace"
import { HistorySessionList } from "../../components/HistorySessionList"
import { ScheduleEntry } from "../../components/ScheduleEntry"
import { TaskStepPanel } from "../../components/TaskStepPanel"
import type { AssistantSessionItem } from "../../stores/chat.store"

type MainWindowPageProps = {
  runtime: AssistantWindowRuntime
  scheduleViewModel: AssistantWindowViewModel
  onSyncWorkspace: () => Promise<void>
  onAuthorize: () => Promise<void>
  onOpenPanel: () => Promise<void>
  onClosePanel: () => void
  onEnable: () => Promise<void>
  onDisable: () => Promise<void>
  onTriggerNow: () => Promise<boolean>
  onLoadSessionDetail: (sessionId: string) => Promise<void>
  onCreateSession: () => Promise<void>
  onSendMessage: (sessionId: string, content: string) => Promise<void>
  onAbort: (sessionId: string, runId: string) => Promise<void>
}

export function MainWindowPage({
  runtime,
  scheduleViewModel,
  onSyncWorkspace,
  onAuthorize,
  onOpenPanel,
  onClosePanel,
  onEnable,
  onDisable,
  onTriggerNow,
  onLoadSessionDetail,
  onCreateSession,
  onSendMessage,
  onAbort,
}: MainWindowPageProps) {
  const sessions = useStore(runtime.chatStore, (state) => state.sessions)
  const activeSessionId = useStore(runtime.chatStore, (state) => state.activeSessionId)
  const draft = useStore(runtime.chatStore, (state) => state.draft)
  const setDraft = useStore(runtime.chatStore, (state) => state.setDraft)
  const activateSession = useStore(runtime.chatStore, (state) => state.activateSession)
  const appendLocalSystemMessage = useStore(
    runtime.chatStore,
    (state) => state.appendLocalSystemMessage
  )
  const activeRunCount = useStore(runtime.runStore, (state) => state.activeRunCount)
  const activeRun = useStore(runtime.runStore, (state) =>
    activeSessionId ? state.runsBySessionId[activeSessionId] : undefined
  )

  const activeSession =
    sessions.find((session) => session.sessionId === activeSessionId) ?? sessions[0]

  useEffect(() => {
    void onSyncWorkspace()
  }, [onSyncWorkspace])

  const composerHint =
    activeSession?.source === "backend"
      ? "按 Ctrl + Enter 或 Cmd + Enter 发送。"
      : "点击“新建对话”可创建正式业务会话；调度与确认弹窗链路仍保持可用。"

  const handleSelectSession = (session: AssistantSessionItem) => {
    activateSession(session.sessionId)
    if (session.source === "backend") {
      void onLoadSessionDetail(session.sessionId)
    }
  }

  const handleCreateSession = async () => {
    await onCreateSession()
  }

  const handleSendMessage = async (content: string) => {
    const trimmed = content.trim()
    if (!trimmed || !activeSession) {
      return
    }

    if (activeSession.source !== "backend") {
      await onCreateSession()
      appendLocalSystemMessage(
        activeSession.sessionId,
        "已请求创建正式业务会话。会话创建完成后，请再次发送这条消息。",
        "action"
      )
      void antdMessage.info("正在创建正式会话，请在新会话出现后再次发送。")
      return
    }

    await onSendMessage(activeSession.sessionId, trimmed)
  }

  const handleAbort = async () => {
    if (!activeSession || !activeRun || activeSession.source !== "backend") {
      return
    }
    await onAbort(activeSession.sessionId, activeRun.runId)
  }

  return (
    <AppShell
      bootstrapState={scheduleViewModel.bootstrapState}
      activeRunCount={activeRunCount}
      leftSidebar={
        <>
          <HistorySessionList
            sessions={sessions}
            activeSessionId={activeSession?.sessionId ?? activeSessionId}
            onCreateSession={() => {
              void handleCreateSession()
            }}
            onSelectSession={handleSelectSession}
          />
          <ScheduleEntry
            viewModel={scheduleViewModel}
            onAuthorize={() => {
              void onAuthorize()
            }}
            onOpenPanel={() => {
              void onOpenPanel()
            }}
            onClosePanel={onClosePanel}
            onEnable={() => {
              void onEnable()
            }}
            onDisable={() => {
              void onDisable()
            }}
            onTriggerNow={() => {
              void onTriggerNow()
            }}
          />
        </>
      }
      rightSidebar={<TaskStepPanel run={activeRun} />}
    >
      <ChatWorkspace
        title={activeSession?.title ?? "新对话"}
        conversationId={activeSession?.conversationId ?? null}
        sessionStatus={activeRun?.status === "running" ? "执行中" : activeSession?.runtimeStatus ?? "等待首条消息"}
        messages={activeSession?.messages ?? []}
        draft={draft}
        quickPrompts={quickPrompts}
        canAbortCurrentRequest={Boolean(activeRun && activeRun.status === "running")}
        composerHint={composerHint}
        onDraftChange={setDraft}
        onSendMessage={(content) => {
          void handleSendMessage(content)
        }}
        onAbortCurrentRequest={() => {
          void handleAbort()
        }}
      />
    </AppShell>
  )
}
