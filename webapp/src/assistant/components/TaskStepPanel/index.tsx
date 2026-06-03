import styled from "styled-components"
import type { SessionRunView } from "../../stores/run.store"
import { formatDisplayDateTime } from "../../../shared/utils/dateTime"

type TaskStepPanelProps = {
  run?: SessionRunView
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
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 0.78rem;
`

const Title = styled.h3`
  margin: 0.3rem 0 0;
  font-size: 1.2rem;
`

const EmptyState = styled.div`
  min-height: 240px;
  display: grid;
  place-items: center;
  text-align: center;
  border: 1px dashed ${({ theme }) => theme.colors.border};
  border-radius: 20px;
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 1rem;
`

const StepList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
`

const StepCard = styled.article`
  padding: 0.9rem;
  border-radius: 18px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: rgba(255, 255, 255, 0.03);
`

const StepHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
`

const StatusTag = styled.span<{ $status: string }>`
  display: inline-flex;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.78rem;
  background: ${({ $status }) =>
    $status === "failed"
      ? "rgba(255, 143, 143, 0.14)"
      : $status === "running"
        ? "rgba(255, 214, 107, 0.14)"
        : "rgba(107, 212, 161, 0.14)"};
  color: ${({ $status, theme }) =>
    $status === "failed"
      ? theme.colors.danger
      : $status === "running"
        ? theme.colors.warning
        : theme.colors.success};
`

const Meta = styled.div`
  margin-top: 0.45rem;
  color: ${({ theme }) => theme.colors.textSoft};
  font-size: 0.84rem;
`

const Detail = styled.pre`
  margin: 0.7rem 0 0;
  padding: 0.7rem;
  border-radius: 14px;
  background: rgba(8, 12, 20, 0.48);
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: pre-wrap;
  word-break: break-word;
`

export function TaskStepPanel({ run }: TaskStepPanelProps) {
  return (
    <Panel>
      <div>
        <Eyebrow>Run Steps</Eyebrow>
        <Title>任务步骤区</Title>
      </div>

      {!run ? (
        <EmptyState>运行事件接入后，这里会展示当前业务会话的一次任务步骤流。</EmptyState>
      ) : (
        <StepList>
          {run.steps.map((step) => (
            <StepCard key={step.stepId}>
              <StepHeader>
                <strong>{step.title}</strong>
                <StatusTag $status={step.status}>{step.status}</StatusTag>
              </StepHeader>

              <Meta>
                {step.toolName ? `工具：${step.toolName}` : "会话步骤"}
                {step.startTime ? ` · 开始：${formatDisplayDateTime(step.startTime)}` : ""}
              </Meta>

              {step.input ? <Detail>{JSON.stringify(step.input, null, 2)}</Detail> : null}
              {step.errorMessage ? <Detail>{step.errorMessage}</Detail> : null}
            </StepCard>
          ))}
        </StepList>
      )}
    </Panel>
  )
}
