import styled, { css, keyframes } from "styled-components"
import type { ChatCard, ChatMessage } from "../../types/chat"
import { ToolResultCard } from "../ToolResultCard"

type ChatWorkspaceProps = {
  title: string
  conversationId: string | null
  sessionStatus: string
  messages: ChatMessage[]
  draft: string
  quickPrompts: readonly string[]
  canAbortCurrentRequest: boolean
  composerHint: string
  onDraftChange: (draft: string) => void
  onSendMessage: (content: string) => void
  onAbortCurrentRequest: () => void
}

const pulse = keyframes`
  0%,
  80%,
  100% {
    opacity: 0.35;
    transform: translateY(0);
  }

  40% {
    opacity: 1;
    transform: translateY(-2px);
  }
`

const panelStyle = css`
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  backdrop-filter: blur(18px);
`

const ChatStage = styled.section`
  ${panelStyle};
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.35rem;
  border-radius: 28px;
`

const ChatHeader = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;

  h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  p {
    margin: 0.35rem 0 0;
    color: rgba(245, 243, 235, 0.66);
  }

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

const Status = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.7rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(245, 243, 235, 0.82);
`

const StatusDot = styled.span`
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.success};
  box-shadow: 0 0 0 6px rgba(107, 212, 161, 0.12);
`

const MessageList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  min-height: 420px;

  @media (max-width: 720px) {
    min-height: 320px;
  }
`

const EmptyState = styled.div`
  display: grid;
  place-items: center;
  min-height: 260px;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: 22px;
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
  padding: 1.5rem;
`

const bubbleVariantStyles = {
  user: css`
    align-self: flex-end;
    background:
      linear-gradient(135deg, rgba(255, 191, 134, 0.18), rgba(255, 255, 255, 0.04)),
      rgba(255, 255, 255, 0.04);
  `,
  assistant: css`
    align-self: flex-start;
    background:
      linear-gradient(135deg, rgba(126, 182, 255, 0.14), rgba(255, 255, 255, 0.04)),
      rgba(255, 255, 255, 0.04);
  `,
  system: css`
    align-self: center;
    max-width: 100%;
    background: rgba(255, 255, 255, 0.03);
  `,
}

const messageStateStyles = {
  action: css`
    border-color: rgba(255, 191, 134, 0.25);
  `,
  success: css`
    border-color: rgba(107, 212, 161, 0.28);
  `,
  error: css`
    border-color: rgba(255, 122, 122, 0.28);
  `,
}

const MessageBubble = styled.article<{
  $role: "user" | "assistant" | "system"
  $state?: "action" | "success" | "error"
}>`
  ${panelStyle};
  max-width: min(82%, 760px);
  padding: 1rem 1.1rem;
  border-radius: ${({ theme }) => theme.radius.bubble};
  ${({ $role }) => bubbleVariantStyles[$role]}
  ${({ $state }) => ($state ? messageStateStyles[$state] : "")}

  p {
    margin: 0;
    white-space: pre-wrap;
    color: rgba(245, 243, 235, 0.88);
  }

  @media (max-width: 1080px) {
    max-width: 100%;
  }
`

const MessageMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.65rem;
  color: rgba(245, 243, 235, 0.64);
  font-size: 0.9rem;
`

const TypingBubble = styled(MessageBubble).attrs({
  $role: "assistant",
})`
  min-width: 180px;
`

const TypingDots = styled.div`
  display: inline-flex;
  gap: 0.45rem;

  span {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 999px;
    background: ${({ theme }) => theme.colors.accent};
    animation: ${pulse} 900ms ease-in-out infinite;
  }
`

const PromptStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
`

const PromptChip = styled.button`
  min-height: 44px;
  padding: 0.7rem 1rem;
  border-radius: ${({ theme }) => theme.radius.chip};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(255, 255, 255, 0.04);
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
`

const Composer = styled.form`
  ${panelStyle};
  padding: 1rem;
  border-radius: 24px;
`

const SrOnly = styled.label`
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`

const ComposerInput = styled.textarea`
  width: 100%;
  min-height: 120px;
  resize: vertical;
  border: 0;
  border-radius: 18px;
  padding: 1rem;
  color: ${({ theme }) => theme.colors.text};
  background: rgba(8, 12, 20, 0.54);

  &::placeholder {
    color: rgba(245, 243, 235, 0.45);
  }
`

const ComposerFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1rem;

  p {
    margin: 0;
    max-width: 36rem;
    color: rgba(245, 243, 235, 0.68);
  }

  @media (max-width: 720px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

const ComposerActions = styled.div`
  display: flex;
  gap: 0.75rem;
  flex: 0 0 auto;

  @media (max-width: 720px) {
    width: 100%;
    flex-direction: column;
  }
`

const ComposerButton = styled.button`
  min-width: 156px;
  min-height: 48px;
  padding: 0.85rem 1.2rem;
  border: 0;
  border-radius: 16px;
  cursor: pointer;
  color: #101521;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.accent} 0%,
    ${({ theme }) => theme.colors.accentSoft} 100%
  );
`

const CancelButton = styled.button`
  min-width: 132px;
  min-height: 48px;
  padding: 0.85rem 1.1rem;
  border: 1px solid rgba(255, 122, 122, 0.28);
  border-radius: 16px;
  cursor: pointer;
  color: #ffd8d8;
  background: rgba(255, 122, 122, 0.1);
`

function bubbleRole(message: ChatMessage) {
  if (message.role === "user") {
    return "user" as const
  }
  if (message.role === "system") {
    return "system" as const
  }
  return "assistant" as const
}

function bubbleState(message: ChatMessage) {
  if (
    message.variant === "action" ||
    message.variant === "success" ||
    message.variant === "error"
  ) {
    return message.variant
  }
  return undefined
}

function renderMessageCard(card: ChatCard) {
  if (card.kind !== "menu") {
    return null
  }
  return <ToolResultCard data={card.data} />
}

export function ChatWorkspace({
  title,
  conversationId,
  sessionStatus,
  messages,
  draft,
  quickPrompts,
  canAbortCurrentRequest,
  composerHint,
  onDraftChange,
  onSendMessage,
  onAbortCurrentRequest,
}: ChatWorkspaceProps) {
  const hasStreamingAssistantText = messages.some(
    (message) =>
      message.role === "assistant" &&
      message.status === "streaming" &&
      message.text.trim().length > 0
  )

  return (
    <ChatStage>
      <ChatHeader>
        <div>
          <h2>{title}</h2>
          <p>{conversationId ? `会话 ID：${conversationId}` : "首条正式会话创建后显示 ID"}</p>
        </div>
        <Status>
          <StatusDot />
          {sessionStatus}
        </Status>
      </ChatHeader>

      <MessageList aria-live="polite">
        {!messages.length ? (
          <EmptyState>这里会展示当前业务会话的消息流和工具结果。</EmptyState>
        ) : null}

        {messages.map((message) =>
          message.role === "assistant" &&
          message.status === "streaming" &&
          !message.text ? null : (
            <MessageBubble
              key={message.id}
              $role={bubbleRole(message)}
              $state={bubbleState(message)}
            >
              <MessageMeta>
                <strong>{message.author}</strong>
                <span>{message.time}</span>
              </MessageMeta>
              <p>{message.text}</p>
              {message.card ? renderMessageCard(message.card) : null}
            </MessageBubble>
          )
        )}

        {messages.length > 0 && !hasStreamingAssistantText && sessionStatus === "执行中" ? (
          <TypingBubble>
            <MessageMeta>
              <strong>营小助</strong>
              <span>{sessionStatus}</span>
            </MessageMeta>
            <TypingDots aria-label="正在生成回复">
              <span />
              <span />
              <span />
            </TypingDots>
          </TypingBubble>
        ) : null}
      </MessageList>

      <PromptStrip aria-label="快捷问题">
        {quickPrompts.map((prompt) => (
          <PromptChip key={prompt} type="button" onClick={() => onSendMessage(prompt)}>
            {prompt}
          </PromptChip>
        ))}
      </PromptStrip>

      <Composer
        onSubmit={(event) => {
          event.preventDefault()
          onSendMessage(draft)
        }}
      >
        <SrOnly htmlFor="agent-message">输入要发送给营小助的消息</SrOnly>
        <ComposerInput
          id="agent-message"
          value={draft}
          placeholder="输入消息，开始一轮新对话或继续当前会话"
          rows={4}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault()
              onSendMessage(draft)
            }
          }}
          onChange={(event) => onDraftChange(event.target.value)}
        />
        <ComposerFooter>
          <p>{composerHint}</p>
          <ComposerActions>
            {canAbortCurrentRequest ? (
              <CancelButton type="button" onClick={onAbortCurrentRequest}>
                终止任务
              </CancelButton>
            ) : null}
            <ComposerButton type="submit" disabled={!draft.trim()}>
              发送
            </ComposerButton>
          </ComposerActions>
        </ComposerFooter>
      </Composer>
    </ChatStage>
  )
}
