import React, { useEffect, useState } from "react"
import { message as antdMessage } from "antd"
import { MainWindowPage } from "../../assistant/pages/MainWindowPage"
import { resolveSessionAgentId } from "../../assistant/execution-layer/chat/chat-client"
import { AppProviders } from "../../providers/AppProviders"
import {
  bootstrapAssistantWindow,
  createAssistantWindowViewModel,
  type AssistantWindowViewModel,
  type AssistantWindowRuntime,
} from "./runtime"

export interface AssistantWindowPageProps {
  deviceId?: string
}

export class AssistantWindowService {
  private readonly runtime: AssistantWindowRuntime
  private readonly deviceId: string

  constructor(deviceId = "device-001") {
    this.deviceId = deviceId
    this.runtime = bootstrapAssistantWindow(deviceId)
  }

  getViewModel(): AssistantWindowViewModel {
    return createAssistantWindowViewModel(this.runtime.scheduleStore.getState())
  }

  getRuntime(): AssistantWindowRuntime {
    return this.runtime
  }

  subscribe(listener: () => void): () => void {
    return this.runtime.scheduleStore.subscribe(listener)
  }

  async syncState(): Promise<void> {
    await this.runtime.hostClient.requestScheduleState()
  }

  async syncWorkspace(): Promise<void> {
    await this.runtime.chatClient.syncWorkspace()
  }

  async confirmAutomationAuthorization(): Promise<void> {
    const handled = await this.runtime.hostClient.authorizeAutomation()
    if (!handled) {
      void antdMessage.info("当前是独立网页端模式，未连接宿主调度能力。")
    }
  }

  async openSchedulePanel(): Promise<void> {
    this.runtime.scheduleStore.getState().openPanel()
    await this.runtime.hostClient.requestScheduleState()
  }

  closeSchedulePanel(): void {
    this.runtime.scheduleStore.getState().closePanel()
  }

  async enableSchedule(): Promise<void> {
    const schedule = this.runtime.scheduleStore.getState().schedule
    if (!schedule) {
      return
    }
    const handled = await this.runtime.hostClient.enableSchedule(schedule.scheduleId)
    if (!handled) {
      void antdMessage.info("当前是独立网页端模式，未连接宿主调度能力。")
    }
  }

  async disableSchedule(): Promise<void> {
    const schedule = this.runtime.scheduleStore.getState().schedule
    if (!schedule) {
      return
    }
    const handled = await this.runtime.hostClient.disableSchedule(schedule.scheduleId)
    if (!handled) {
      void antdMessage.info("当前是独立网页端模式，未连接宿主调度能力。")
    }
  }

  async triggerCurrentScheduleNow(): Promise<boolean> {
    const scheduleId =
      this.runtime.scheduleStore.getState().schedule?.scheduleId ?? "schedule_3040_daily"
    const handled = await this.runtime.hostClient.triggerSchedule(scheduleId)
    if (!handled) {
      void antdMessage.info("当前是独立网页端模式，未连接宿主调度能力。")
    }
    return handled
  }

  async loadSessionDetail(sessionId: string): Promise<void> {
    await this.runtime.chatClient.loadSessionDetail(sessionId)
  }

  async createSession(): Promise<void> {
    this.runtime.chatStore.getState().createLocalDraftSession()
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    const state = this.runtime.chatStore.getState()
    const session = state.sessions.find((item) => item.sessionId === sessionId)
    const trimmed = text.trim()
    if (!trimmed || !session) {
      return
    }

    let targetSessionId = sessionId
    if (session.source === "draft") {
      const agentId = resolveSessionAgentId(state.agents, state.activeAgentId)
      if (!agentId) {
        return
      }
      targetSessionId = await this.runtime.chatClient.createSession(agentId)
    }

    this.runtime.chatStore.getState().appendLocalUserMessage(targetSessionId, trimmed)
    this.runtime.chatStore.getState().setDraft("")
    await this.runtime.chatClient.sendMessage(targetSessionId, trimmed)
  }

  async abortRun(sessionId: string, runId: string): Promise<void> {
    await this.runtime.chatClient.abortRun(sessionId, runId)
  }
}

export const AssistantWindowPage: React.FC<AssistantWindowPageProps> = ({
  deviceId = "device-001",
}) => {
  const [service] = useState(() => new AssistantWindowService(deviceId))
  const [actions] = useState(() => ({
    onSyncWorkspace: () => service.syncWorkspace(),
    onAuthorize: () => service.confirmAutomationAuthorization(),
    onOpenPanel: () => service.openSchedulePanel(),
    onClosePanel: () => service.closeSchedulePanel(),
    onEnable: () => service.enableSchedule(),
    onDisable: () => service.disableSchedule(),
    onTriggerNow: () => service.triggerCurrentScheduleNow(),
    onLoadSessionDetail: (sessionId: string) => service.loadSessionDetail(sessionId),
    onCreateSession: () => service.createSession(),
    onSendMessage: (sessionId: string, text: string) => service.sendMessage(sessionId, text),
    onAbort: (sessionId: string, runId: string) => service.abortRun(sessionId, runId),
  }))
  const [viewModel, setViewModel] = useState(() => service.getViewModel())

  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      setViewModel(service.getViewModel())
    })
    void service.syncWorkspace().catch(() => {})

    return unsubscribe
  }, [service])

  return (
    <AppProviders>
      <MainWindowPage
        runtime={service.getRuntime()}
        scheduleViewModel={viewModel}
        onSyncWorkspace={actions.onSyncWorkspace}
        onAuthorize={actions.onAuthorize}
        onOpenPanel={actions.onOpenPanel}
        onClosePanel={actions.onClosePanel}
        onEnable={actions.onEnable}
        onDisable={actions.onDisable}
        onTriggerNow={actions.onTriggerNow}
        onLoadSessionDetail={actions.onLoadSessionDetail}
        onCreateSession={actions.onCreateSession}
        onSendMessage={actions.onSendMessage}
        onAbort={actions.onAbort}
      />
    </AppProviders>
  )
}


