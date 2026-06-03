import type { AgentSummary } from "../../../../share/protocol"
import type { ChatMessage } from "../types/chat"

export const welcomeMessages: ChatMessage[] = [
  {
    id: "system-welcome",
    role: "system",
    author: "系统提示",
    time: "09:00",
    text: "你好，这里是营小助。主窗体工作台已经迁入当前项目。",
    status: "done",
  },
  {
    id: "assistant-welcome",
    role: "assistant",
    author: "营小助",
    time: "09:01",
    text: "当前版本已接入正式工作台骨架、调度入口和运行状态区，人工对话执行层将在下一阶段接入。",
    status: "done",
  },
]

export const quickPrompts = [
  "帮我整理今天的 3040 查询关注点",
  "解释一下当前调度授权状态",
  "我想把任务步骤区接到正式运行事件",
  "给我一个适合销售团队的会话结构",
] as const

export const defaultAgents: AgentSummary[] = [
  {
    agentId: "yxz-assistant",
    agentName: "营小助",
    agentType: "assistant",
    description: "默认业务会话智能体",
    enabled: true,
  },
]
