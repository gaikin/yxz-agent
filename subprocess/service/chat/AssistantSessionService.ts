import type {
  AgentSummary,
  ChatMessage,
  FrontendAssistantDeltaEvent,
  FrontendAssistantDoneEvent,
  FrontendRunCancelledEvent,
  FrontendRunFailedEvent,
  FrontendRunStartedEvent,
  FrontendSessionCreatedEvent,
  FrontendSessionDetailEvent,
  FrontendSessionSnapshotEvent,
  FrontendStepFinishedEvent,
  FrontendStepStartedEvent,
  RunDetail,
  RunStepView,
  SessionDetail,
  SessionSummary,
} from "../../../share/protocol"
import { formatNow } from "../../../share/dateTime"
import { createId } from "../common/id"
import { RumJsJsonStore, type RumJsCacheApi } from "../common/rumJsJsonStore"

type SessionMap = Record<string, SessionDetail>

type RuntimePublisher = (
  event:
    | FrontendSessionSnapshotEvent
    | FrontendSessionDetailEvent
    | FrontendSessionCreatedEvent
    | FrontendRunStartedEvent
    | FrontendStepStartedEvent
    | FrontendStepFinishedEvent
    | FrontendAssistantDeltaEvent
    | FrontendAssistantDoneEvent
    | FrontendRunFailedEvent
    | FrontendRunCancelledEvent
) => Promise<void>

type ActiveRunHandle = {
  sessionId: string
  runId: string
  assistantMessageId: string
  cancel: () => void
}

const DEFAULT_AGENT: AgentSummary = {
  agentId: "yxz-assistant",
  agentName: "营小助",
  agentType: "assistant",
  description: "默认业务会话智能体",
  enabled: true,
}

function createRunDetail(sessionId: string, runId: string, createTime: string): RunDetail {
  return {
    runId,
    sessionId,
    status: "running",
    steps: [],
    createTime,
    updateTime: createTime,
  }
}

function toSessionSummary(session: SessionDetail): SessionSummary {
  const latestMessage = [...session.messages].reverse()[0]
  const preview = latestMessage?.content?.replace(/\s+/g, " ").trim()

  return {
    sessionId: session.sessionId,
    title: session.title,
    createTime: session.createTime,
    updateTime: session.updateTime,
    agent: session.agent,
    lastMessagePreview: preview || undefined,
    lastRunStatus:
      session.lastRun?.status === "running"
        ? "running"
        : session.lastRun?.status === "failed"
          ? "failed"
          : "idle",
  }
}

function buildAssistantReply(text: string): string {
  if (text.includes("3040")) {
    return [
      "我已经记录这次 3040 相关请求。",
      "当前迁移版本会先通过正式会话链路把消息、运行步骤和回复事件打通。",
      "下一步我们可以继续把真实营小助服务和 MCP 工具执行层接上来。",
    ].join("\n")
  }

  if (text.includes("调度")) {
    return [
      "当前主窗体已经能看到正式调度入口和授权状态。",
      "这条回复来自新的会话运行时链路，说明 SESSION、RUN 和 ASSISTANT 事件已经打通。",
    ].join("\n")
  }

  return [
    "主窗体迁移后的正式会话链路已经可用。",
    `我收到的消息是：${text}`,
    "当前版本先提供最小可用运行闭环，后续再替换成正式营小助服务调用。",
  ].join("\n")
}

export class AssistantAgentCatalogService {
  async list(): Promise<AgentSummary[]> {
    return [DEFAULT_AGENT]
  }

  async get(agentId: string): Promise<AgentSummary | undefined> {
    return (await this.list()).find((item) => item.agentId === agentId)
  }
}

export class AssistantSessionStoreService {
  private readonly store: RumJsJsonStore<SessionMap>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, {})
  }

  async list(): Promise<SessionDetail[]> {
    return this.serialize(async () => {
      const all = await this.store.read()
      return Object.values(all).sort((left, right) => right.updateTime.localeCompare(left.updateTime))
    })
  }

  async get(sessionId: string): Promise<SessionDetail | undefined> {
    return this.serialize(async () => {
      const all = await this.store.read()
      return all[sessionId]
    })
  }

  async upsert(session: SessionDetail): Promise<SessionDetail> {
    return this.serialize(async () => {
      const all = await this.store.read()
      all[session.sessionId] = session
      await this.store.write(all)
      return session
    })
  }

  async patch(
    sessionId: string,
    updater: (session: SessionDetail) => SessionDetail
  ): Promise<SessionDetail | undefined> {
    return this.serialize(async () => {
      const all = await this.store.read()
      const current = all[sessionId]
      if (!current) {
        return undefined
      }
      const next = updater(current)
      all[sessionId] = next
      await this.store.write(all)
      return next
    })
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export class AssistantConversationRuntimeService {
  private readonly activeRuns = new Map<string, ActiveRunHandle>()

  constructor(
    private readonly deviceId: string,
    private readonly agentCatalogService: AssistantAgentCatalogService,
    private readonly sessionStoreService: AssistantSessionStoreService,
    private readonly publish: RuntimePublisher
  ) {}

  async listAgents(): Promise<AgentSummary[]> {
    return this.agentCatalogService.list()
  }

  async listSessions(): Promise<SessionSummary[]> {
    const sessions = await this.sessionStoreService.list()
    return sessions.map(toSessionSummary)
  }

  async getSessionDetail(sessionId: string): Promise<SessionDetail | undefined> {
    return this.sessionStoreService.get(sessionId)
  }

  async createSession(agentId: string): Promise<SessionDetail> {
    const now = formatNow()
    const agent = (await this.agentCatalogService.get(agentId)) ?? DEFAULT_AGENT
    const session: SessionDetail = {
      sessionId: createId("session"),
      title: "新对话",
      createTime: now,
      updateTime: now,
      agent,
      messages: [],
    }

    await this.sessionStoreService.upsert(session)

    await this.publish({
      type: "SESSION_CREATED",
      deviceId: this.deviceId,
      session,
      sentAt: formatNow(),
    })
    await this.publishSessionSnapshot()
    return session
  }

  async sendUserMessage(sessionId: string, text: string): Promise<void> {
    const session = await this.sessionStoreService.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const now = formatNow()
    const userMessage: ChatMessage = {
      messageId: createId("msg"),
      sessionId,
      role: "user",
      content: text,
      status: "sent",
      createTime: now,
    }
    const runId = createId("run")
    const assistantMessageId = createId("msg")
    const reply = buildAssistantReply(text)

    const nextTitle = session.messages.length === 0 ? text.slice(0, 18) || "新对话" : session.title

    const nextSession: SessionDetail = {
      ...session,
      title: nextTitle,
      updateTime: now,
      messages: [...session.messages, userMessage],
      lastRun: createRunDetail(sessionId, runId, now),
    }

    await this.sessionStoreService.upsert(nextSession)
    await this.publishSessionSnapshot()
    await this.publish({
      type: "RUN_STARTED",
      sessionId,
      runId,
      status: "running",
      createTime: now,
      sentAt: formatNow(),
    })

    this.startRun(nextSession, runId, assistantMessageId, reply)
  }

  async cancelRun(sessionId: string, runId: string): Promise<void> {
    const activeRun = this.activeRuns.get(runId)
    if (!activeRun || activeRun.sessionId !== sessionId) {
      return
    }

    activeRun.cancel()
    this.activeRuns.delete(runId)

    await this.sessionStoreService.patch(sessionId, (session) => ({
      ...session,
      updateTime: formatNow(),
      lastRun: session.lastRun
        ? {
            ...session.lastRun,
            status: "cancelled",
            updateTime: formatNow(),
          }
        : undefined,
    }))

    await this.publish({
      type: "RUN_CANCELLED",
      sessionId,
      runId,
      sentAt: formatNow(),
    })
    await this.publishSessionSnapshot()
  }

  private startRun(
    session: SessionDetail,
    runId: string,
    assistantMessageId: string,
    reply: string
  ): void {
    let cancelled = false
    const timers = new Set<NodeJS.Timeout>()
    const stepId = createId("step")
    const chunks = this.chunkReply(reply)
    let accumulated = ""

    const schedule = (delay: number, task: () => Promise<void> | void) => {
      const timer = setTimeout(() => {
        timers.delete(timer)
        if (cancelled) {
          return
        }
        void Promise.resolve(task()).catch(async (error) => {
          await this.failRun(session.sessionId, runId, error)
        })
      }, delay)
      timer.unref?.()
      timers.add(timer)
    }

    this.activeRuns.set(runId, {
      sessionId: session.sessionId,
      runId,
      assistantMessageId,
      cancel: () => {
        cancelled = true
        for (const timer of timers) {
          clearTimeout(timer)
        }
        timers.clear()
      },
    })

    schedule(40, async () => {
      const startTime = formatNow()
      await this.sessionStoreService.patch(session.sessionId, (current) => {
        const nextStep: RunStepView = {
          stepId,
          runId,
          title: "分析当前用户请求",
          status: "running",
          startTime,
        }

        return {
          ...current,
          updateTime: startTime,
          lastRun: current.lastRun
            ? {
                ...current.lastRun,
                updateTime: startTime,
                steps: [...current.lastRun.steps, nextStep],
              }
            : undefined,
        }
      })

      await this.publish({
        type: "STEP_STARTED",
        sessionId: session.sessionId,
        runId,
        stepId,
        title: "分析当前用户请求",
        startTime,
        sentAt: startTime,
      })
    })

    chunks.forEach((chunk, index) => {
      schedule(100 + index * 90, async () => {
        accumulated += chunk
        await this.publish({
          type: "ASSISTANT_DELTA",
          sessionId: session.sessionId,
          runId,
          messageId: assistantMessageId,
          text: accumulated,
          sentAt: formatNow(),
        })
      })
    })

    schedule(100 + chunks.length * 90 + 20, async () => {
      const endTime = formatNow()
      await this.sessionStoreService.patch(session.sessionId, (current) => ({
        ...current,
        updateTime: endTime,
        lastRun: current.lastRun
          ? {
              ...current.lastRun,
              updateTime: endTime,
              steps: current.lastRun.steps.map((step) =>
                step.stepId === stepId
                  ? {
                      ...step,
                      status: "success",
                      endTime,
                    }
                  : step
              ),
            }
          : undefined,
      }))

      await this.publish({
        type: "STEP_FINISHED",
        sessionId: session.sessionId,
        runId,
        stepId,
        status: "success",
        endTime,
        sentAt: endTime,
      })
    })

    schedule(100 + chunks.length * 90 + 60, async () => {
      const endTime = formatNow()
      await this.sessionStoreService.patch(session.sessionId, (current) => {
        const assistantMessage: ChatMessage = {
          messageId: assistantMessageId,
          sessionId: current.sessionId,
          role: "assistant",
          content: reply,
          status: "done",
          createTime: endTime,
        }

        return {
          ...current,
          updateTime: endTime,
          messages: [...current.messages, assistantMessage],
          lastRun: current.lastRun
            ? {
                ...current.lastRun,
                status: "completed",
                updateTime: endTime,
                steps: current.lastRun.steps.map((step) =>
                  step.stepId === stepId
                    ? {
                        ...step,
                        status: "success",
                        endTime,
                      }
                    : step
                ),
              }
            : undefined,
        }
      })

      await this.publish({
        type: "ASSISTANT_DONE",
        sessionId: session.sessionId,
        runId,
        messageId: assistantMessageId,
        text: reply,
        sentAt: endTime,
      })
      await this.publishSessionSnapshot()
      this.activeRuns.delete(runId)
    })
  }

  private async failRun(sessionId: string, runId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : "会话执行失败"

    this.activeRuns.get(runId)?.cancel()
    this.activeRuns.delete(runId)

    await this.sessionStoreService.patch(sessionId, (session) => ({
      ...session,
      updateTime: formatNow(),
      lastRun: session.lastRun
        ? {
            ...session.lastRun,
            status: "failed",
            updateTime: formatNow(),
          }
        : undefined,
    }))

    await this.publish({
      type: "RUN_FAILED",
      sessionId,
      runId,
      error: message,
      sentAt: formatNow(),
    })
    await this.publishSessionSnapshot()
  }

  private chunkReply(reply: string): string[] {
    if (reply.length <= 24) {
      return [reply]
    }

    const chunks: string[] = []
    let index = 0
    while (index < reply.length) {
      chunks.push(reply.slice(index, index + 24))
      index += 24
    }
    return chunks
  }

  async publishSessionSnapshot(): Promise<void> {
    await this.publish({
      type: "SESSION_SNAPSHOT",
      deviceId: this.deviceId,
      sessions: await this.listSessions(),
      sentAt: formatNow(),
    })
  }

  async publishSessionDetail(sessionId: string): Promise<void> {
    const session = await this.getSessionDetail(sessionId)
    if (!session) {
      return
    }
    await this.publish({
      type: "SESSION_DETAIL",
      deviceId: this.deviceId,
      session,
      sentAt: formatNow(),
    })
  }
}
