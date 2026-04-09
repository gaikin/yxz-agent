import React from "react"
import type { CSSProperties } from "react"
import { useEffect, useState } from "react"
import { formatNow } from "../../../../share/dateTime"
import {
  bootstrapAssistantWindow,
  createAssistantWindowViewModel,
  type AssistantWindowViewModel,
} from "./runtime"

export interface AssistantWindowPageProps {
  deviceId?: string
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  padding: 24,
  color: "#0f172a",
  background:
    "radial-gradient(circle at top left, rgba(207,250,254,0.9), rgba(248,250,252,1) 45%)",
}

const shellStyle: CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: 24,
  borderRadius: 24,
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(148,163,184,0.18)",
  boxShadow: "0 24px 64px rgba(15, 23, 42, 0.08)",
}

const headerStyle: CSSProperties = {
  margin: 0,
  fontSize: 28,
  lineHeight: 1.2,
  fontWeight: 800,
}

const textStyle: CSSProperties = {
  margin: "10px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "#475569",
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 20,
}

const cardStyle: CSSProperties = {
  padding: 16,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
}

const labelStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 6,
}

const valueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
}

const actionRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 12,
  marginTop: 24,
}

const buttonStyle: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "12px 16px",
  fontSize: 14,
  fontWeight: 700,
  cursor: "pointer",
}

const primaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  color: "#fff",
  background: "linear-gradient(135deg, #0f766e 0%, #0f172a 100%)",
}

const secondaryButtonStyle: CSSProperties = {
  ...buttonStyle,
  color: "#334155",
  background: "#e2e8f0",
}

const panelStyle: CSSProperties = {
  marginTop: 24,
  padding: 20,
  borderRadius: 18,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
}

function formatTime(value?: string): string {
  return value ?? "-"
}

export class AssistantWindowService {
  private readonly runtime: ReturnType<typeof bootstrapAssistantWindow>
  private readonly deviceId: string

  constructor(deviceId = "device-001") {
    this.deviceId = deviceId
    this.runtime = bootstrapAssistantWindow(deviceId)
  }

  getViewModel(): AssistantWindowViewModel {
    return createAssistantWindowViewModel(this.runtime.scheduleStore.getState())
  }

  subscribe(listener: () => void): () => void {
    return this.runtime.scheduleStore.subscribe(listener)
  }

  async syncState(): Promise<void> {
    await this.runtime.channelClient.requestScheduleState()
  }

  async confirmAutomationAuthorization(): Promise<void> {
    await this.runtime.channelClient.authorizeAutomation()
  }

  async openSchedulePanel(): Promise<void> {
    this.runtime.scheduleStore.openPanel()
    await this.runtime.channelClient.requestScheduleState()
  }

  closeSchedulePanel(): void {
    this.runtime.scheduleStore.closePanel()
  }

  async enableSchedule(): Promise<void> {
    const schedule = this.runtime.scheduleStore.getState().schedule
    if (!schedule) {
      return
    }
    await this.runtime.channelClient.enableSchedule(schedule.scheduleId)
  }

  async disableSchedule(): Promise<void> {
    const schedule = this.runtime.scheduleStore.getState().schedule
    if (!schedule) {
      return
    }
    await this.runtime.channelClient.disableSchedule(schedule.scheduleId)
  }

  async triggerCurrentScheduleNow(): Promise<boolean> {
    const scheduleId =
      this.runtime.scheduleStore.getState().schedule?.scheduleId ?? "schedule_3040_daily"
    await this.runtime.channelClient.triggerSchedule(scheduleId, formatNow())
    return true
  }
}

export const AssistantWindowPage: React.FC<AssistantWindowPageProps> = ({
  deviceId = "device-001",
}) => {
  const [service] = useState(() => new AssistantWindowService(deviceId))
  const [viewModel, setViewModel] = useState(() => service.getViewModel())

  useEffect(() => {
    const unsubscribe = service.subscribe(() => {
      setViewModel(service.getViewModel())
    })
    void service.syncState().catch(() => {})

    return unsubscribe
  }, [service])

  return (
    <main style={pageStyle}>
      <section style={shellStyle}>
        <h1 style={headerStyle}>营小助助手页</h1>
        <p style={textStyle}>
          当前页面承载授权、调度状态查看，以及定时任务面板的启停操作。
        </p>

        <div style={gridStyle}>
          <div style={cardStyle}>
            <div style={labelStyle}>DCF 状态</div>
            <div style={valueStyle}>{viewModel.bootstrapState?.dcfStatus ?? "unknown"}</div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>调度系统</div>
            <div style={valueStyle}>
              {viewModel.bootstrapState?.scheduleSubsystemReady ? "ready" : "not-ready"}
            </div>
          </div>
          <div style={cardStyle}>
            <div style={labelStyle}>自动执行授权</div>
            <div style={valueStyle}>
              {viewModel.automationAuthorization.authorized ? "authorized" : "unauthorized"}
            </div>
          </div>
        </div>

        <div style={actionRowStyle}>
          {viewModel.shouldShowAutomationAuthorization ? (
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => {
                void service.confirmAutomationAuthorization()
              }}
            >
              确认自动执行授权
            </button>
          ) : null}

          <button
            type="button"
            style={secondaryButtonStyle}
            onClick={() => {
              void service.openSchedulePanel()
            }}
          >
            打开定时任务面板
          </button>
        </div>

        {viewModel.panelVisible ? (
          <section style={panelStyle}>
            <div style={labelStyle}>任务名称</div>
            <div style={valueStyle}>{viewModel.schedule?.name ?? "未加载"}</div>

            <div style={{ ...labelStyle, marginTop: 16 }}>下一次触发时间</div>
            <div style={valueStyle}>{formatTime(viewModel.schedule?.nextTriggerAt)}</div>

            <div style={{ ...actionRowStyle, marginTop: 20 }}>
              <button
                type="button"
                style={primaryButtonStyle}
                disabled={!viewModel.canOperateSchedule || viewModel.schedule?.enabled === true}
                onClick={() => {
                  void service.enableSchedule()
                }}
              >
                启用调度
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                disabled={!viewModel.canOperateSchedule || viewModel.schedule?.enabled !== true}
                onClick={() => {
                  void service.disableSchedule()
                }}
              >
                停用调度
              </button>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  void service.triggerCurrentScheduleNow()
                }}
              >
                立即执行定时任务
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => {
                  service.closeSchedulePanel()
                }}
              >
                关闭面板
              </button>
            </div>
          </section>
        ) : null}
      </section>
    </main>
  )
}


