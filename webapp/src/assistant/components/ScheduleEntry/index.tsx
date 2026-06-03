import styled from "styled-components"
import type { AssistantWindowViewModel } from "../../../pages/Assistant/runtime"
import { formatDisplayDateTime } from "../../../shared/utils/dateTime"

type ScheduleEntryProps = {
  viewModel: AssistantWindowViewModel
  onAuthorize: () => void
  onOpenPanel: () => void
  onClosePanel: () => void
  onEnable: () => void
  onDisable: () => void
  onTriggerNow: () => void
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

const MetaGrid = styled.div`
  display: grid;
  gap: 0.75rem;
`

const MetaRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  color: ${({ theme }) => theme.colors.textMuted};

  strong {
    color: ${({ theme }) => theme.colors.text};
  }
`

const ActionStack = styled.div`
  display: grid;
  gap: 0.65rem;
`

const Hint = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colors.textMuted};
  line-height: 1.6;
`

const ActionButton = styled.button<{ $tone?: "secondary" | "warning" }>`
  min-height: 44px;
  border: ${({ $tone }) =>
    $tone === "secondary"
      ? "1px solid rgba(255, 255, 255, 0.12)"
      : "0"};
  border-radius: 16px;
  cursor: pointer;
  color: ${({ $tone }) => ($tone === "secondary" ? "#f5f3eb" : "#101521")};
  background: ${({ $tone, theme }) =>
    $tone === "secondary"
      ? "rgba(255, 255, 255, 0.04)"
      : $tone === "warning"
        ? "rgba(255, 143, 143, 0.14)"
        : `linear-gradient(135deg, ${theme.colors.accent} 0%, ${theme.colors.accentSoft} 100%)`};
`

export function ScheduleEntry({
  viewModel,
  onAuthorize,
  onOpenPanel,
  onClosePanel,
  onEnable,
  onDisable,
  onTriggerNow,
}: ScheduleEntryProps) {
  return (
    <Panel>
      <div>
        <Eyebrow>Schedule</Eyebrow>
        <Title>定时任务入口</Title>
      </div>

      <MetaGrid>
        <MetaRow>
          <span>宿主连接</span>
          <strong>{viewModel.isHostConnected ? "已连接" : "未连接"}</strong>
        </MetaRow>
        <MetaRow>
          <span>自动执行授权</span>
          <strong>
            {viewModel.automationAuthorization.authorized ? "authorized" : "unauthorized"}
          </strong>
        </MetaRow>
        <MetaRow>
          <span>当前任务</span>
          <strong>{viewModel.schedule?.name ?? "未加载"}</strong>
        </MetaRow>
        <MetaRow>
          <span>下一次触发</span>
          <strong>{formatDisplayDateTime(viewModel.schedule?.nextTriggerAt)}</strong>
        </MetaRow>
      </MetaGrid>

      <ActionStack>
        {!viewModel.isHostConnected ? (
          <Hint>当前以独立网页端运行。人工对话主流程可直接使用，定时任务与确认弹窗需要连接宿主后才可用。</Hint>
        ) : null}

        {viewModel.shouldShowAutomationAuthorization ? (
          <ActionButton type="button" onClick={onAuthorize}>
            确认自动执行授权
          </ActionButton>
        ) : null}

        {viewModel.isHostConnected && !viewModel.panelVisible ? (
          <ActionButton type="button" $tone="secondary" onClick={onOpenPanel}>
            打开定时任务面板
          </ActionButton>
        ) : null}

        {viewModel.isHostConnected && viewModel.panelVisible ? (
          <>
            <ActionButton
              type="button"
              onClick={onEnable}
              disabled={!viewModel.canOperateSchedule || viewModel.schedule?.enabled === true}
            >
              启用调度
            </ActionButton>
            <ActionButton
              type="button"
              $tone="secondary"
              onClick={onDisable}
              disabled={!viewModel.canOperateSchedule || viewModel.schedule?.enabled !== true}
            >
              停用调度
            </ActionButton>
            <ActionButton type="button" $tone="secondary" onClick={onTriggerNow}>
              立即执行定时任务
            </ActionButton>
            <ActionButton type="button" $tone="warning" onClick={onClosePanel}>
              收起任务面板
            </ActionButton>
          </>
        ) : null}
      </ActionStack>
    </Panel>
  )
}
