import test from "node:test"
import assert from "node:assert/strict"
import { bootstrapDcf } from "../subprocess/service/bootstrap"
import type { DcfToFrontendEvent } from "../share/protocol"
import { formatNow } from "../share/dateTime"
import {
  AssistantChatClient,
  resolveSessionAgentId,
} from "../webapp/src/assistant/execution-layer/chat/chat-client"
import { adaptMcpNotificationToRuntimeEvent, adaptMcpToolResultToChatCard } from "../webapp/src/assistant/execution-layer/mcp/mcp-adapter"
import { TaskRecordUploader } from "../webapp/src/assistant/execution-layer/records/task-record-uploader"
import type { RumJsCacheApi } from "../subprocess/service/common/rumJsJsonStore"

class MemoryRumJsCache implements RumJsCacheApi {
  private readonly map = new Map<string, string>()

  async readCacheFileAsync(args: { fileName: string }): Promise<string | undefined> {
    return this.map.get(args.fileName)
  }

  async writeCacheFileAsync(args: { fileName: string; content: string }): Promise<void> {
    this.map.set(args.fileName, args.content)
  }
}

test("assistant chat client syncs workspace and tracks stream snapshots", async () => {
  const calls: string[] = []
  const client = new AssistantChatClient({
    async requestScheduleState() {
      calls.push("requestScheduleState")
    },
    async listAgents() {
      calls.push("listAgents")
    },
    async listSessions() {
      calls.push("listSessions")
    },
    async getSessionDetail(sessionId: string) {
      calls.push(`getSessionDetail:${sessionId}`)
    },
    async createSession(agentId: string) {
      calls.push(`createSession:${agentId}`)
    },
    async sendUserMessage(sessionId: string, text: string) {
      calls.push(`sendUserMessage:${sessionId}:${text}`)
    },
    async cancelRun(sessionId: string, runId: string) {
      calls.push(`cancelRun:${sessionId}:${runId}`)
    },
  })

  await client.syncWorkspace()
  await client.loadSessionDetail("session-1")
  await client.createSession("agent-1")
  await client.sendMessage("session-1", "hello")
  await client.abortRun("session-1", "run-1")

  client.handleFrontendEvent({
    type: "RUN_STARTED",
    sessionId: "session-1",
    runId: "run-1",
    status: "running",
    createTime: formatNow(),
    sentAt: formatNow(),
  })
  client.handleFrontendEvent({
    type: "STEP_STARTED",
    sessionId: "session-1",
    runId: "run-1",
    stepId: "step-1",
    title: "分析用户请求",
    startTime: formatNow(),
    sentAt: formatNow(),
  })
  client.handleFrontendEvent({
    type: "ASSISTANT_DELTA",
    sessionId: "session-1",
    runId: "run-1",
    messageId: "msg-1",
    text: "主窗体执行",
    sentAt: formatNow(),
  })
  client.handleFrontendEvent({
    type: "ASSISTANT_DONE",
    sessionId: "session-1",
    runId: "run-1",
    messageId: "msg-1",
    text: "主窗体执行层已接入",
    sentAt: formatNow(),
  })

  assert.deepEqual(calls.slice(0, 3).sort(), [
    "listAgents",
    "listSessions",
    "requestScheduleState",
  ])
  assert.equal(calls.includes("getSessionDetail:session-1"), true)
  assert.equal(calls.includes("createSession:agent-1"), true)
  assert.equal(calls.includes("sendUserMessage:session-1:hello"), true)
  assert.equal(calls.includes("cancelRun:session-1:run-1"), true)

  const snapshot = client.getStreamSnapshot("session-1")
  assert.ok(snapshot)
  assert.equal(snapshot?.status, "completed")
  assert.equal(snapshot?.stepCount, 1)
  assert.equal(snapshot?.assistantText, "主窗体执行层已接入")

  assert.equal(
    resolveSessionAgentId(
      [
        { agentId: "agent-1", agentName: "A", agentType: "assistant", enabled: true },
        { agentId: "agent-2", agentName: "B", agentType: "assistant", enabled: true },
      ],
      "agent-2"
    ),
    "agent-2"
  )
})

test("mcp adapter converts menu tool results and takeover notifications", () => {
  const card = adaptMcpToolResultToChatCard("open_menu", {
    structuredContent: {
      menuCode: "MENU-001",
      menuName: "早餐套餐",
      price: "18",
      description: "已为当前用户打开菜单页",
      tabId: "tab-1",
    },
  })

  assert.deepEqual(card, {
    kind: "menu",
    data: {
      menuCode: "MENU-001",
      menuName: "早餐套餐",
      price: 18,
      description: "已为当前用户打开菜单页",
      pageUrl: undefined,
      tabId: "tab-1",
      source: undefined,
    },
  })

  const runtimeEvent = adaptMcpNotificationToRuntimeEvent(
    {
      method: "notifications/event/human_takeover",
      params: {
        conversationId: "conversation-1",
        type: "manual_review",
        message: "需要人工确认价格",
      },
    },
    {
      SessionLocalId: "session-local-1",
      RunId: "run-1",
      ToolName: "open_menu",
    }
  )

  assert.ok(runtimeEvent)
  assert.equal(runtimeEvent?.EventType, "HumanTakeoverReceived")
  assert.equal(runtimeEvent?.ConversationId, "conversation-1")
  assert.equal(runtimeEvent?.Payload.Message, "需要人工确认价格")
})

test("task record uploader records failed attempts before endpoint is wired", async () => {
  const uploader = new TaskRecordUploader()

  const result = await uploader.upload({
    runId: "run-1",
    sessionId: "session-1",
    title: "测试任务",
    status: "completed",
    startedAt: formatNow(),
    finishedAt: formatNow(),
    summary: "最小迁移闭环",
  })

  assert.equal(result.ok, false)
  assert.match(result.error ?? "", /not connected/i)
  assert.equal(uploader.getAttempts().length, 1)
  assert.equal(uploader.getAttempts()[0]?.payload.runId, "run-1")
})

test("dcf runtime emits assistant deltas as growing prefixes instead of duplicated text", async () => {
  const frontendEvents: DcfToFrontendEvent[] = []

  const runtime = await bootstrapDcf({
    workspaceRoot: process.cwd(),
    publishFrontendEvent: async (event) => {
      frontendEvents.push(event as DcfToFrontendEvent)
    },
    publishPopupEvent: async () => {},
    toolTransport: {
      async send() {
        return {
          result: {
            content: [{ type: "text", text: "{}" }],
          },
        }
      },
      close() {},
    },
    rumJsCache: new MemoryRumJsCache(),
  })

  await runtime.receiveFrontendEvent({
    type: "CREATE_SESSION",
    deviceId: "device-001",
    agentId: "yxz-assistant",
    sentAt: formatNow(),
  })

  const createdSessionEvent = frontendEvents.find(
    (event): event is Extract<DcfToFrontendEvent, { type: "SESSION_CREATED" }> =>
      event.type === "SESSION_CREATED"
  )
  assert.ok(createdSessionEvent)

  await runtime.receiveFrontendEvent({
    type: "USER_MESSAGE",
    deviceId: "device-001",
    sessionId: createdSessionEvent.session.sessionId,
    text: "帮我看一下 3040",
    sentAt: formatNow(),
  })

  await new Promise((resolve) => setTimeout(resolve, 700))

  const deltas = frontendEvents.filter(
    (event): event is Extract<DcfToFrontendEvent, { type: "ASSISTANT_DELTA" }> =>
      event.type === "ASSISTANT_DELTA"
  )
  const doneEvent = frontendEvents.find(
    (event): event is Extract<DcfToFrontendEvent, { type: "ASSISTANT_DONE" }> =>
      event.type === "ASSISTANT_DONE"
  )

  assert.ok(deltas.length > 1)
  assert.ok(doneEvent)

  let previousLength = 0
  for (const delta of deltas) {
    assert.equal(doneEvent?.text.startsWith(delta.text), true)
    assert.ok(delta.text.length > previousLength)
    previousLength = delta.text.length
  }

  await runtime.scheduleTimerService.stop()
})
