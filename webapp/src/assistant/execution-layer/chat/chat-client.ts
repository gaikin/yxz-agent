import type { AgentSummary, DcfToFrontendEvent } from "../../../../../share/protocol"
import {
  type AssistantRuntimeStreamEvent,
  type AssistantStreamSnapshot,
  isAssistantRuntimeStreamEvent,
  reduceAssistantStreamSnapshot,
} from "./stream-parser"

export interface AssistantChatTransport {
  requestScheduleState(): Promise<void>
  listAgents(): Promise<void>
  listSessions(): Promise<void>
  getSessionDetail(sessionId: string): Promise<void>
  createSession(agentId: string): Promise<string>
  sendUserMessage(sessionId: string, text: string): Promise<void>
  cancelRun(sessionId: string, runId: string): Promise<void>
}

export class AssistantChatClient {
  private readonly streamSnapshots = new Map<string, AssistantStreamSnapshot>()

  constructor(private readonly transport: AssistantChatTransport) {}

  async syncWorkspace(): Promise<void> {
    await Promise.allSettled([
      this.transport.requestScheduleState(),
      this.transport.listAgents(),
      this.transport.listSessions(),
    ])
  }

  async loadSessionDetail(sessionId: string): Promise<void> {
    await this.transport.getSessionDetail(sessionId)
  }

  async createSession(agentId: string): Promise<string> {
    return this.transport.createSession(agentId)
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    await this.transport.sendUserMessage(sessionId, text)
  }

  async abortRun(sessionId: string, runId: string): Promise<void> {
    await this.transport.cancelRun(sessionId, runId)
  }

  handleFrontendEvent(event: DcfToFrontendEvent): AssistantRuntimeStreamEvent | null {
    if (!isAssistantRuntimeStreamEvent(event)) {
      return null
    }

    const sessionId = event.type === "SESSION_CREATED" ? event.session.sessionId : event.sessionId
    const previous = this.streamSnapshots.get(sessionId)
    this.streamSnapshots.set(sessionId, reduceAssistantStreamSnapshot(previous, event))
    return event
  }

  getStreamSnapshot(sessionId: string): AssistantStreamSnapshot | undefined {
    return this.streamSnapshots.get(sessionId)
  }
}

export function resolveSessionAgentId(
  agents: AgentSummary[],
  activeAgentId?: string
): string | undefined {
  if (activeAgentId && agents.some((item) => item.agentId === activeAgentId)) {
    return activeAgentId
  }

  return agents[0]?.agentId
}
