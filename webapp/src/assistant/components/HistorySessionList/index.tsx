import styled, { css } from "styled-components"
import type { AssistantSessionItem } from "../../stores/chat.store"

type HistorySessionListProps = {
  sessions: AssistantSessionItem[]
  activeSessionId: string
  onCreateSession: () => void
  onSelectSession: (session: AssistantSessionItem) => void
}

const Panel = styled.section`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.panel};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  backdrop-filter: blur(18px);
`

const Eyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 0.78rem;
`

const Title = styled.h1`
  margin: 0.35rem 0 0;
  font-size: 1.8rem;
`

const NewChatButton = styled.button`
  min-height: 48px;
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

const HistoryList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: auto;
`

const HistoryItem = styled.button<{ $active: boolean }>`
  width: 100%;
  padding: 1rem;
  text-align: left;
  border-radius: 18px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: ${({ theme }) => theme.colors.text};
  background: ${({ $active }) =>
    $active ? "rgba(255, 191, 134, 0.08)" : "rgba(255, 255, 255, 0.03)"};
  cursor: pointer;
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    background 160ms ease;

  ${({ $active }) =>
    $active
      ? css`
          border-color: rgba(255, 191, 134, 0.35);
          transform: translateY(-2px);
        `
      : ""}
`

const HistoryItemTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;

  strong {
    font-size: 0.98rem;
  }
`

const HistoryPreview = styled.p`
  margin: 0;
  color: rgba(245, 243, 235, 0.7);
`

const TagRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
`

const RunningTag = styled.span<{ $tone?: "running" | "draft" | "fixture" }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  background: ${({ $tone }) =>
    $tone === "draft"
      ? "rgba(255, 214, 107, 0.14)"
      : $tone === "fixture"
        ? "rgba(126, 182, 255, 0.14)"
        : "rgba(107, 212, 161, 0.14)"};
  color: ${({ $tone, theme }) =>
    $tone === "draft"
      ? theme.colors.warning
      : $tone === "fixture"
        ? "#9dc4ff"
        : theme.colors.success};
  font-size: 0.78rem;
  font-weight: 600;
`

const TimeText = styled.span`
  color: rgba(245, 243, 235, 0.56);
  font-size: 0.82rem;
`

export function HistorySessionList({
  sessions,
  activeSessionId,
  onCreateSession,
  onSelectSession,
}: HistorySessionListProps) {
  return (
    <Panel>
      <div>
        <Eyebrow>Conversation</Eyebrow>
        <Title>营小助</Title>
      </div>

      <NewChatButton type="button" onClick={onCreateSession}>
        新建对话
      </NewChatButton>

      <HistoryList aria-label="历史对话">
        {sessions.map((session) => (
          <HistoryItem
            key={session.sessionId}
            type="button"
            $active={session.sessionId === activeSessionId}
            onClick={() => onSelectSession(session)}
          >
            <HistoryItemTop>
              <strong>{session.title}</strong>
              <TagRow>
                {session.runtimeStatus === "执行中" ? <RunningTag>运行中</RunningTag> : null}
                {session.source === "draft" ? <RunningTag $tone="draft">草稿</RunningTag> : null}
                {session.source === "fixture" ? (
                  <RunningTag $tone="fixture">已迁移</RunningTag>
                ) : null}
                <TimeText>{session.updatedAt}</TimeText>
              </TagRow>
            </HistoryItemTop>
            <HistoryPreview>{session.preview}</HistoryPreview>
          </HistoryItem>
        ))}
      </HistoryList>
    </Panel>
  )
}
