import type {
  AgentSummary,
  DcfToFrontendEvent,
  FrontendAgentSnapshotEvent,
  FrontendAssistantDeltaEvent,
  FrontendAssistantDoneEvent,
  FrontendRunCancelledEvent,
  FrontendRunFailedEvent,
  FrontendRunStartedEvent,
  FrontendSessionCreatedEvent,
  FrontendStepFinishedEvent,
  FrontendStepStartedEvent,
  SessionDetail,
} from "../../../../../share/protocol"
import { formatNow } from "../../../shared/utils/dateTime"
import { getWebappRuntimeConfig } from "../../../shared/runtime-config"
import { defaultAgents } from "../../dev-fixtures/agentWorkspace"
import { adaptMcpToolResultToChatCard } from "../mcp/mcp-adapter"
import type { AssistantMcpClient } from "../mcp/mcp-client"
import type { TaskRecordUploader } from "../records/task-record-uploader"
import type { ChatStoreApi } from "../../stores/chat.store"
import type { AssistantChatTransport } from "./chat-client"

type PublishEvent = (event: DcfToFrontendEvent) => void

type HostScheduleClient = {
  requestScheduleState(): Promise<boolean>
}

type StreamActionEvent = {
  type: "ACTION"
  callId?: string
  name?: string
  detail?: string
  executionLocation?: "LOCAL" | "CLOUD"
  actionInput?: {
    toolName?: string
    toolInput?: unknown
  }
  actionOutput?: unknown
}

type StreamTextEvent = {
  type: "STREAMING_TEXT"
  content?: string
}

type StreamCompleteEvent = {
  type: "COMPLETE"
}

type StreamEvent = StreamActionEvent | StreamTextEvent | StreamCompleteEvent

type ActiveRun = {
  sessionId: string
  runId: string
  startedAt: string
  abortController: AbortController
}

function buildUrl(template: string, conversationId: string) {
  return template.replace(":conversationId", encodeURIComponent(conversationId))
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function buildAgentSnapshot(deviceId: string, agents: AgentSummary[]): FrontendAgentSnapshotEvent {
  return {
    type: "AGENT_SNAPSHOT",
    deviceId,
    agents,
    sentAt: formatNow(),
  }
}

function buildSessionDetail(sessionId: string, agent: AgentSummary): SessionDetail {
  const now = formatNow()
  return {
    sessionId,
    title: "新对话",
    createTime: now,
    updateTime: now,
    agent,
    messages: [],
  }
}

function extractConversationId(payload: Record<string, unknown>): string | undefined {
  return typeof payload.conversationId === "string"
    ? payload.conversationId
    : typeof payload.id === "string"
      ? payload.id
      : undefined
}

function toToolInput(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, unknown>
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  return (await response.json()) as T
}

async function parseStreamResponse(
  response: Response,
  onEvent: (event: StreamEvent) => Promise<void>
): Promise<void> {
  if (!response.body) {
    throw new Error("流式响应没有返回可读取的数据流")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  const flushChunk = async (chunk: string) => {
    buffer += chunk

    while (true) {
      const separatorIndex = buffer.indexOf("\n\n")
      if (separatorIndex < 0) {
        break
      }

      const rawEvent = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)
      const payload = rawEvent
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n")

      if (!payload) {
        continue
      }

      await onEvent(JSON.parse(payload) as StreamEvent)
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    await flushChunk(decoder.decode(value, { stream: true }))
  }

  const tail = decoder.decode()
  if (tail) {
    await flushChunk(tail)
  }
}

export class AssistantWebRuntimeTransport implements AssistantChatTransport {
  private readonly activeRuns = new Map<string, ActiveRun>()
  private readonly agents: AgentSummary[]

  constructor(
    private readonly deviceId: string,
    private readonly publishEvent: PublishEvent,
    private readonly chatStore: ChatStoreApi,
    private readonly mcpClient: AssistantMcpClient,
    private readonly taskRecordUploader: TaskRecordUploader,
    private readonly hostScheduleClient?: HostScheduleClient
  ) {
    this.agents = defaultAgents
  }

  async requestScheduleState(): Promise<void> {
    await this.hostScheduleClient?.requestScheduleState()
  }

  async listAgents(): Promise<void> {
    this.publishEvent(buildAgentSnapshot(this.deviceId, this.agents))
  }

  async listSessions(): Promise<void> {
    // Standalone web mode keeps session state in the browser runtime instead of
    // requesting snapshots from the subprocess.
  }

  async getSessionDetail(_sessionId: string): Promise<void> {
    // Session detail is already held in local browser state for standalone mode.
  }

  async createSession(agentId: string): Promise<string> {
    const response = await fetch(getWebappRuntimeConfig().assistantCreateUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })

    if (!response.ok) {
      throw new Error(`创建对话失败: ${response.status}`)
    }

    const payload = await readJsonResponse<Record<string, unknown>>(response)
    const sessionId = extractConversationId(payload)
    if (!sessionId) {
      throw new Error("创建对话成功，但响应里没有 conversationId")
    }

    const agent =
      this.agents.find((item) => item.agentId === agentId) ?? this.agents[0] ?? defaultAgents[0]
    const event: FrontendSessionCreatedEvent = {
      type: "SESSION_CREATED",
      deviceId: this.deviceId,
      session: buildSessionDetail(sessionId, agent),
      sentAt: formatNow(),
    }
    this.publishEvent(event)
    return sessionId
  }

  async sendUserMessage(sessionId: string, text: string): Promise<void> {
    const startedAt = formatNow()
    const runId = createId("run")
    const assistantMessageId = createId("assistant")
    const abortController = new AbortController()
    this.activeRuns.set(runId, {
      sessionId,
      runId,
      startedAt,
      abortController,
    })

    const runStartedEvent: FrontendRunStartedEvent = {
      type: "RUN_STARTED",
      sessionId,
      runId,
      status: "running",
      createTime: startedAt,
      sentAt: startedAt,
    }
    this.publishEvent(runStartedEvent)

    const assistantParts: string[] = []

    try {
      const { assistantStreamUrl } = getWebappRuntimeConfig()
      const response = await fetch(buildUrl(assistantStreamUrl, sessionId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: sessionId,
          message: text,
        }),
        signal: abortController.signal,
      })

      if (!response.ok) {
        throw new Error(`建立流式通道失败: ${response.status}`)
      }

      await parseStreamResponse(response, async (event) => {
        if (abortController.signal.aborted) {
          return
        }

        if (event.type === "STREAMING_TEXT") {
          const chunk = event.content?.trim()
          if (!chunk) {
            return
          }

          assistantParts.push(chunk)
          const deltaEvent: FrontendAssistantDeltaEvent = {
            type: "ASSISTANT_DELTA",
            sessionId,
            runId,
            messageId: assistantMessageId,
            text: assistantParts.join("\n"),
            sentAt: formatNow(),
          }
          this.publishEvent(deltaEvent)
          return
        }

        if (event.type === "ACTION") {
          await this.handleActionEvent(sessionId, runId, event)
        }
      })

      if (abortController.signal.aborted) {
        return
      }

      const finalText = assistantParts.join("\n").trim() || "本轮任务已完成。"
      const doneEvent: FrontendAssistantDoneEvent = {
        type: "ASSISTANT_DONE",
        sessionId,
        runId,
        messageId: assistantMessageId,
        text: finalText,
        sentAt: formatNow(),
      }
      this.publishEvent(doneEvent)

      await this.taskRecordUploader.upload({
        runId,
        sessionId,
        title: this.resolveSessionTitle(sessionId),
        status: "completed",
        startedAt,
        finishedAt: formatNow(),
        summary: finalText,
      })
    } catch (error) {
      if (abortController.signal.aborted) {
        return
      }

      const failedEvent: FrontendRunFailedEvent = {
        type: "RUN_FAILED",
        sessionId,
        runId,
        error: error instanceof Error ? error.message : "网页端会话执行失败",
        sentAt: formatNow(),
      }
      this.publishEvent(failedEvent)

      await this.taskRecordUploader.upload({
        runId,
        sessionId,
        title: this.resolveSessionTitle(sessionId),
        status: "failed",
        startedAt,
        finishedAt: formatNow(),
        summary: failedEvent.error,
      })
    } finally {
      this.activeRuns.delete(runId)
    }
  }

  async cancelRun(sessionId: string, runId: string): Promise<void> {
    const activeRun = this.activeRuns.get(runId)
    if (!activeRun || activeRun.sessionId !== sessionId) {
      return
    }

    activeRun.abortController.abort()
    this.activeRuns.delete(runId)

    const event: FrontendRunCancelledEvent = {
      type: "RUN_CANCELLED",
      sessionId,
      runId,
      sentAt: formatNow(),
    }
    this.publishEvent(event)

    await this.taskRecordUploader.upload({
      runId,
      sessionId,
      title: this.resolveSessionTitle(sessionId),
      status: "cancelled",
      startedAt: activeRun.startedAt,
      finishedAt: formatNow(),
      summary: "用户取消了当前执行。",
    })
  }

  private async handleActionEvent(
    sessionId: string,
    runId: string,
    event: StreamActionEvent
  ): Promise<void> {
    const stepId = event.callId ?? createId("step")
    const toolName = event.actionInput?.toolName ?? event.name ?? "tool"
    const title = event.detail ?? `执行 ${toolName}`
    const stepStartedAt = formatNow()

    const stepStartedEvent: FrontendStepStartedEvent = {
      type: "STEP_STARTED",
      sessionId,
      runId,
      stepId,
      title,
      toolName,
      input: toToolInput(event.actionInput?.toolInput),
      startTime: stepStartedAt,
      sentAt: stepStartedAt,
    }
    this.publishEvent(stepStartedEvent)

    if (event.executionLocation === "LOCAL") {
      const result = await this.mcpClient.executeTool({
        toolName,
        input: toToolInput(event.actionInput?.toolInput),
        context: {
          ConversationId: sessionId,
          SessionLocalId: sessionId,
          RunId: runId,
          ToolName: toolName,
        },
      })

      const card = adaptMcpToolResultToChatCard(toolName, result)
      const isError = result.isError === true

      this.chatStore.getState().appendLocalSystemMessage(
        sessionId,
        isError ? `${toolName} 执行失败。` : `${toolName} 已完成。`,
        isError ? "error" : "success",
        card ?? undefined
      )

      await this.reportToolExecution(sessionId, event.callId ?? stepId, toolName, result)

      const stepFinishedEvent: FrontendStepFinishedEvent = {
        type: "STEP_FINISHED",
        sessionId,
        runId,
        stepId,
        status: isError ? "failed" : "success",
        errorMessage: isError ? this.extractToolError(result) : undefined,
        endTime: formatNow(),
        sentAt: formatNow(),
      }
      this.publishEvent(stepFinishedEvent)
      return
    }

    const card = adaptMcpToolResultToChatCard(toolName, {
      structuredContent: event.actionOutput,
      isError: false,
    })
    if (card) {
      this.chatStore
        .getState()
        .appendLocalSystemMessage(sessionId, `${toolName} 已完成。`, "success", card)
    }

    const stepFinishedEvent: FrontendStepFinishedEvent = {
      type: "STEP_FINISHED",
      sessionId,
      runId,
      stepId,
      status: "success",
      endTime: formatNow(),
      sentAt: formatNow(),
    }
    this.publishEvent(stepFinishedEvent)
  }

  private async reportToolExecution(
    sessionId: string,
    callId: string,
    toolName: string,
    result: unknown
  ): Promise<void> {
    try {
      const { assistantReportUrl } = getWebappRuntimeConfig()
      await fetch(buildUrl(assistantReportUrl, sessionId), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          conversationId: sessionId,
          toolExecuteResults: [
            {
              callId,
              toolName,
              result,
            },
          ],
        }),
      })
    } catch {
      // Tool result reporting should not block the main conversation flow.
    }
  }

  private extractToolError(result: {
    content?: Array<{ type: string; text?: string }>
  }): string {
    const textPart = result.content?.find((item) => item.type === "text" && item.text)
    return textPart?.text ?? "工具执行失败"
  }

  private resolveSessionTitle(sessionId: string): string {
    return (
      this.chatStore.getState().sessions.find((session) => session.sessionId === sessionId)?.title ??
      "营小助对话"
    )
  }
}
