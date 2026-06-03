import React from "react"
import type { CSSProperties, ReactNode } from "react"
import { useEffect, useState } from "react"
import type {
  DcfToPopupEvent,
  PopupConfirmAllScheduleExecutionsEvent,
  PopupDismissAllScheduleExecutionsEvent,
  PopupScheduleExecutionOverviewUpdatedEvent,
  ScheduleExecutionOverview,
  SchedulePendingExecutionItem,
} from "../../../../share/protocol"
import type { PopupPageInitData } from "../../../../share/hostTypes"
import { formatNow } from "../../shared/utils/dateTime"
import { KaiyangBaseCommunicationService } from "../../services/kaiyang-base-communication"

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
  item: SchedulePendingExecutionItem
): ReactNode {
  return (
    <>
      <div style={itemTitleStyle}>{item.scheduleName}</div>
      <div style={itemMetaStyle}>触发时间：{item.requestedAt}</div>
    </>
  )
}

const title = "3040 定时任务待确认"
const description = "系统已到达预定执行时间。确认后会立即执行 3040 当日查询 skill。"
const confirmText = "确认执行"
const dismissText = "稍后处理"

export type PopupExecutionMode = "hidden" | "pending" | "executing"

export interface PopupExecutionState {
  mode: PopupExecutionMode
  overview?: ScheduleExecutionOverview
  executingIds: string[]
}

export class PopupExecutionStore {
  private state: PopupExecutionState = {
    mode: "hidden",
    executingIds: [],
  }

  getState(): PopupExecutionState {
    return this.state
  }

  hydrateOverview(overview: ScheduleExecutionOverview): void {
    this.applyOverview(overview)
  }

  handleOverviewUpdated(event: PopupScheduleExecutionOverviewUpdatedEvent): void {
    this.applyOverview(event.overview)
  }

  beginExecutingCurrentSnapshot(): SchedulePendingExecutionItem[] {
    const items = this.state.overview?.items ?? []
    this.state = {
      mode: "executing",
      overview: this.state.overview,
      executingIds: items.map((item) => item.executionId),
    }
    return items
  }

  closeAsDismissed(): SchedulePendingExecutionItem[] {
    const items = this.state.overview?.items ?? []
    this.state = {
      mode: "hidden",
      executingIds: [],
    }
    return items
  }

  canConfirm(): boolean {
    return this.state.mode === "pending" && (this.state.overview?.pendingCount ?? 0) > 0
  }

  canDismiss(): boolean {
    return this.state.mode === "pending" && (this.state.overview?.pendingCount ?? 0) > 0
  }

  private applyOverview(overview: ScheduleExecutionOverview): void {
    if (this.state.mode === "executing") {
      if (overview.pendingCount === 0) {
        this.state = {
          mode: "hidden",
          executingIds: [],
        }
        return
      }

      this.state = {
        mode: "pending",
        overview,
        executingIds: [],
      }
      return
    }

    if (overview.pendingCount === 0) {
      this.state = {
        mode: "hidden",
        executingIds: [],
      }
      return
    }

    this.state = {
      mode: "pending",
      overview,
      executingIds: [],
    }
  }
}

export class PopupChannelClient {
  private readonly communication = new KaiyangBaseCommunicationService()

  constructor(
    private readonly deviceId: string,
    private readonly channel = "schedule_popup"
  ) {}

  bindEvents(listener: (event: DcfToPopupEvent) => void): void {
    this.communication.listenJson(this.channel, listener)
  }

  async confirmAll(executionIds: string[]): Promise<void> {
    const event: PopupConfirmAllScheduleExecutionsEvent = {
      type: "CONFIRM_ALL_SCHEDULE_EXECUTIONS",
      deviceId: this.deviceId,
      executionIds,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  async dismissAll(executionIds: string[]): Promise<void> {
    const event: PopupDismissAllScheduleExecutionsEvent = {
      type: "DISMISS_ALL_SCHEDULE_EXECUTIONS",
      deviceId: this.deviceId,
      executionIds,
      sentAt: formatNow(),
    }
    await this.send(event)
  }

  private async send(event: unknown): Promise<void> {
    const pageInitData = await this.getPageInitData()
    await this.communication.sendJson(this.channel, event, {
      dcfWindowId: pageInitData?.dcfWindowId,
    })
  }

  private async getPageInitData(): Promise<PopupPageInitData | undefined> {
    return this.communication.getPageInitData<PopupPageInitData>()
  }
}

export interface PopupBootstrapResult {
  popupExecutionStore: PopupExecutionStore
  popupChannelClient: PopupChannelClient
}

export function bootstrapPopup(deviceId = "device-001"): PopupBootstrapResult {
  const popupExecutionStore = new PopupExecutionStore()
  const popupChannelClient = new PopupChannelClient(deviceId)

  popupChannelClient.bindEvents((event) => {
    if (event.type === "SCHEDULE_EXECUTION_OVERVIEW_UPDATED") {
      popupExecutionStore.handleOverviewUpdated(event)
    }
  })

  return {
    popupExecutionStore,
    popupChannelClient,
  }
}

export class PopupPageService {
  private readonly runtime: ReturnType<typeof bootstrapPopup>
  private readonly deviceId: string

  constructor(options: { deviceId?: string; initialOverview?: ScheduleExecutionOverview } = {}) {
    this.deviceId = options.deviceId ?? "device-001"
    this.runtime = bootstrapPopup(this.deviceId)
    if (options.initialOverview) {
      this.runtime.popupExecutionStore.hydrateOverview(options.initialOverview)
    }
  }

  getViewModel(): PopupExecutionState {
    return this.runtime.popupExecutionStore.getState()
  }

  async confirmAll(): Promise<PopupExecutionState> {
    const items = this.runtime.popupExecutionStore.beginExecutingCurrentSnapshot()
    await this.runtime.popupChannelClient.confirmAll(items.map((item) => item.executionId))
    return this.runtime.popupExecutionStore.getState()
  }

  async dismissAll(): Promise<PopupExecutionState> {
    const items = this.runtime.popupExecutionStore.closeAsDismissed()
    await this.runtime.popupChannelClient.dismissAll(items.map((item) => item.executionId))
    return this.runtime.popupExecutionStore.getState()
  }
}

let popupPageServicePromise: Promise<PopupPageService> | undefined

export async function getPopupPageServiceFromHost(): Promise<PopupPageService> {
  if (!popupPageServicePromise) {
    popupPageServicePromise = createPopupPageServiceFromHost()
  }
  return popupPageServicePromise
}

async function createPopupPageServiceFromHost(): Promise<PopupPageService> {
  const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
  const rawPageInitData =
    typeof bridge?.getPageInitData === "function" ? await bridge.getPageInitData<unknown>() : {}
  const pageInitData = normalizePopupPageInitData(rawPageInitData)

  return new PopupPageService({
    deviceId: pageInitData.deviceId ?? "device-001",
    initialOverview: pageInitData.overview,
  })
}

function normalizePopupPageInitData(rawPageInitData: unknown): PopupPageInitData {
  if (!rawPageInitData) {
    return {}
  }

  if (typeof rawPageInitData === "string") {
    try {
      return JSON.parse(rawPageInitData) as PopupPageInitData
    } catch {
      return {}
    }
  }

  return rawPageInitData as PopupPageInitData
}

export const ScheduleConfirmationPopup: React.FC = () => {
  const [service, setService] = useState<Awaited<ReturnType<typeof getPopupPageServiceFromHost>>>()
  const [viewModel, setViewModel] = useState<PopupExecutionState>({
    mode: "hidden",
    executingIds: [],
  })

  useEffect(() => {
    let active = true

    void getPopupPageServiceFromHost().then((nextService) => {
      if (active) {
        setService(nextService)
        setViewModel(nextService.getViewModel())
      }
    })

    return () => {
      active = false
    }
  }, [])

  if (!service) {
    return null
  }

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
              {defaultItemRenderer(item)}
            </li>
          ))}
        </ul>

        <div style={actionsStyle}>
          <button
            type="button"
            style={{ ...secondaryButtonStyle, opacity: isExecuting ? 0.6 : 1 }}
            onClick={() => {
              void service.dismissAll().then((nextViewModel) => {
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
              void service.confirmAll().then((nextViewModel) => {
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


