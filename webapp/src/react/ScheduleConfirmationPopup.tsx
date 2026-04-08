import React from "react"
import type { CSSProperties, ReactNode } from "react"
import { useEffect, useState } from "react"
import type { SchedulePendingExecutionItem } from "../../../types/frontendProtocol"
import type { PopupExecutionState } from "../popup/popupExecutionStore"
import { getPopupRuntimeFromHost } from "./popupHostRuntime"

const overlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.24)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "flex-end",
  padding: 24,
  zIndex: 2147483647,
  pointerEvents: "none",
}

const panelStyle: CSSProperties = {
  width: 360,
  maxWidth: "calc(100vw - 24px)",
  borderRadius: 20,
  padding: 18,
  color: "#0f172a",
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.98) 100%)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.18)",
  border: "1px solid rgba(148, 163, 184, 0.22)",
  backdropFilter: "blur(10px)",
  pointerEvents: "auto",
}

const badgeStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  color: "#155e75",
  background: "#cffafe",
}

const titleStyle: CSSProperties = {
  margin: "14px 0 8px",
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 800,
}

const descriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#475569",
}

const listStyle: CSSProperties = {
  listStyle: "none",
  margin: "16px 0",
  padding: 0,
  display: "grid",
  gap: 10,
}

const itemStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
}

const itemTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "#0f172a",
}

const itemMetaStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 12,
  color: "#64748b",
}

const actionsStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
}

const buttonBaseStyle: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
  transition: "transform 120ms ease, opacity 120ms ease",
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  color: "#334155",
  background: "#e2e8f0",
}

const primaryButtonStyle: CSSProperties = {
  ...buttonBaseStyle,
  color: "#fff",
  background: "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)",
}

function defaultItemRenderer(
  item: SchedulePendingExecutionItem,
  formatter: Intl.DateTimeFormat
): ReactNode {
  return (
    <>
      <div style={itemTitleStyle}>{item.scheduleName}</div>
      <div style={itemMetaStyle}>触发时间：{formatter.format(new Date(item.requestedAt))}</div>
    </>
  )
}

const title = "3040 定时任务待确认"
const description = "系统已到达预定执行时间。确认后会立即执行 3040 当日查询 skill。"
const confirmText = "确认执行"
const dismissText = "稍后处理"
const locale = "zh-CN"

export const ScheduleConfirmationPopup: React.FC = () => {
  const [runtime, setRuntime] = useState<Awaited<ReturnType<typeof getPopupRuntimeFromHost>>>()
  const [viewModel, setViewModel] = useState<PopupExecutionState>({
    mode: "hidden",
    executingIds: [],
  })

  useEffect(() => {
    let active = true

    void getPopupRuntimeFromHost().then((nextRuntime) => {
      if (active) {
        setRuntime(nextRuntime)
        setViewModel(nextRuntime.getViewModel())
      }
    })

    return () => {
      active = false
    }
  }, [])

  if (!runtime) {
    return null
  }
  const formatter = new Intl.DateTimeFormat(locale, {
    hour12: false,
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })

  if (viewModel.mode === "hidden") {
    return null
  }

  const pendingItems = viewModel.overview?.items ?? []
  const isExecuting = viewModel.mode === "executing"

  return (
    <div style={overlayStyle} aria-live="polite">
      <section role="dialog" aria-modal="false" aria-label={title} style={panelStyle}>
        <div style={badgeStyle}>
          <span>待确认</span>
          <span>{pendingItems.length}</span>
        </div>
        <h2 style={titleStyle}>{title}</h2>
        <p style={descriptionStyle}>{description}</p>

        <ul style={listStyle}>
          {pendingItems.map((item) => (
            <li key={item.executionId} style={itemStyle}>
              {defaultItemRenderer(item, formatter)}
            </li>
          ))}
        </ul>

        <div style={actionsStyle}>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, opacity: isExecuting ? 0.6 : 1 }}
            onClick={() => {
              void runtime.dismissAll().then((nextViewModel) => {
                setViewModel(nextViewModel)
              })
            }}
            disabled={isExecuting}
          >
            {dismissText}
          </button>
          <button
            type="button"
            style={{ ...primaryButtonStyle, opacity: isExecuting ? 0.75 : 1 }}
            onClick={() => {
              void runtime.confirmAll().then((nextViewModel) => {
                setViewModel(nextViewModel)
              })
            }}
            disabled={isExecuting}
          >
            {isExecuting ? "执行中..." : confirmText}
          </button>
        </div>
      </section>
    </div>
  )
}



