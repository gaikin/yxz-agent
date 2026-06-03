import type { ReactNode } from "react"
import styled from "styled-components"
import type { DcfBootstrapRuntimeState } from "../../../../../share/protocol"

type AppShellProps = {
  leftSidebar: ReactNode
  rightSidebar: ReactNode
  children: ReactNode
  bootstrapState?: DcfBootstrapRuntimeState
  activeRunCount: number
}

const Shell = styled.div`
  min-height: 100vh;
  padding: 1.6rem;

  @media (max-width: 720px) {
    padding: 1rem;
  }
`

const StatusRail = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
  padding: 0.8rem 1rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 18px;
  background:
    radial-gradient(circle at top right, rgba(255, 191, 134, 0.12), transparent 32%),
    ${({ theme }) => theme.colors.surfaceStrong};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  backdrop-filter: blur(18px);

  @media (max-width: 900px) {
    flex-direction: column;
    align-items: flex-start;
  }
`

const StatusGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
`

const StatusPill = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.8rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.04);
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: 0.85rem;

  strong {
    color: ${({ theme }) => theme.colors.text};
    font-weight: 700;
  }
`

const WorkspaceGrid = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr) 320px;
  gap: 1rem;
  min-height: calc(100vh - 8rem);

  @media (max-width: 1180px) {
    grid-template-columns: 300px minmax(0, 1fr);
  }

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`

const SidebarColumn = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`

const MainColumn = styled.main`
  min-width: 0;
`

const RightColumn = styled.aside`
  display: flex;
  flex-direction: column;
  gap: 1rem;

  @media (max-width: 1180px) {
    grid-column: 1 / -1;
  }
`

export function AppShell({
  leftSidebar,
  rightSidebar,
  children,
  bootstrapState,
  activeRunCount,
}: AppShellProps) {
  return (
    <Shell>
      <StatusRail>
        <StatusGroup>
          <StatusPill>
            DCF
            <strong>{bootstrapState?.dcfStatus ?? "starting"}</strong>
          </StatusPill>
          <StatusPill>
            调度
            <strong>{bootstrapState?.scheduleSubsystemReady ? "ready" : "not-ready"}</strong>
          </StatusPill>
          <StatusPill>
            开阳
            <strong>{bootstrapState?.kaiyangStatus ?? "pending"}</strong>
          </StatusPill>
        </StatusGroup>

        <StatusPill>
          当前执行任务
          <strong>{activeRunCount}</strong>
        </StatusPill>
      </StatusRail>

      <WorkspaceGrid>
        <SidebarColumn>{leftSidebar}</SidebarColumn>
        <MainColumn>{children}</MainColumn>
        <RightColumn>{rightSidebar}</RightColumn>
      </WorkspaceGrid>
    </Shell>
  )
}
