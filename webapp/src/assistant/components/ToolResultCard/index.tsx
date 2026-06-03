import styled from "styled-components"
import type { MenuCardData } from "../../types/chat"

type ToolResultCardProps = {
  data: MenuCardData
}

const Card = styled.div`
  margin-top: 0.9rem;
  padding: 1rem;
  border-radius: 18px;
  border: 1px solid ${({ theme }) => theme.colors.border};
  background:
    linear-gradient(135deg, rgba(126, 182, 255, 0.08), rgba(255, 191, 134, 0.08)),
    rgba(8, 12, 20, 0.42);
`

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  margin-bottom: 0.7rem;

  h4 {
    margin: 0;
    font-size: 1.05rem;
  }
`

const Tag = styled.span`
  display: inline-flex;
  margin-bottom: 0.35rem;
  font-size: 0.76rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
`

const Price = styled.div`
  flex: 0 0 auto;
  padding: 0.55rem 0.75rem;
  border-radius: 14px;
  background: rgba(255, 191, 134, 0.14);
  color: ${({ theme }) => theme.colors.accentSoft};
  font-weight: 700;
`

const Meta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
  margin-bottom: 0.75rem;

  span {
    display: inline-flex;
    padding: 0.32rem 0.58rem;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(245, 243, 235, 0.72);
    font-size: 0.82rem;
  }
`

const Description = styled.p`
  margin: 0;
  color: rgba(245, 243, 235, 0.8);
  white-space: pre-wrap;
`

export function ToolResultCard({ data }: ToolResultCardProps) {
  return (
    <Card>
      <Header>
        <div>
          <Tag>Menu</Tag>
          <h4>{data.menuName}</h4>
        </div>
        {data.price !== undefined ? <Price>¥{data.price}</Price> : null}
      </Header>

      <Meta>
        {data.menuCode ? <span>编号 {data.menuCode}</span> : null}
        {data.tabId ? <span>标签 {data.tabId}</span> : null}
        {data.source ? <span>来源 {data.source}</span> : null}
        {data.pageUrl ? <span>已打开菜单页</span> : null}
      </Meta>

      {data.description ? <Description>{data.description}</Description> : null}
    </Card>
  )
}
