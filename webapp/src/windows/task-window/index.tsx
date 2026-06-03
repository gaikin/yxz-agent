import styled from "styled-components"

const Shell = styled.main`
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
`

const Card = styled.section`
  width: min(720px, 100%);
  padding: 2rem;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.radius.panel};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.shadow.panel};
  text-align: center;

  h1 {
    margin: 0 0 0.75rem;
  }

  p {
    margin: 0;
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.7;
  }
`

export function TaskWindowPage() {
  return (
    <Shell>
      <Card>
        <h1>任务子窗体</h1>
        <p>
          任务子窗体路由和视觉骨架已经建立，后续会复用主窗体的执行层、运行事件分发和任务记录上传能力。
        </p>
      </Card>
    </Shell>
  )
}
