import type {
  AutomationAuthorizationState,
  ScheduleExecutionOverview,
  ScheduleExecutionStatus,
  SchedulePendingExecutionItem,
  SchedulePendingExecutionStatus,
} from "../../../share/protocol"
import { formatDateTime } from "../../../share/dateTime"
import { RumJsJsonStore, type RumJsCacheApi } from "../common/rumJsJsonStore"
import type { SkillExecutionResult } from "../SkillService"

export interface ScheduleDefinition {
  scheduleId: string
  name: string
  cronExpression: string
  timezone: string
  skillId: string
}

export interface ScheduleRuntimeState {
  scheduleId: string
  enabled: boolean
  nextTriggerAt?: string
  lastTriggeredAt?: string
  lastCompletedAt?: string
  lastStatus?: ScheduleExecutionStatus
  lastRunId?: string
  lastError?: {
    code: string
    message: string
  }
}

export interface ScheduleRunRecord {
  executionId: string
  scheduleId: string
  scheduleName: string
  requestedAt: string
  runId?: string
  startedAt?: string
  completedAt?: string
  status: SchedulePendingExecutionItem["status"]
  result?: SkillExecutionResult
}

export interface DcfConfig {
  mcpBaseUrl: string
  schedules: ScheduleDefinition[]
}

export interface BootstrapSnapshot {
  automationAuthorization: AutomationAuthorizationState
  runtime: {
    dcfStatus: "starting" | "online" | "error"
    kaiyangStatus?: "disconnected" | "connecting" | "connected" | "reconnecting" | "degraded"
    kaiyangAuthorizationStatus?: "authorizing" | "authorized" | "failed"
    kaiyangEventHookStatus?: "subscribing" | "subscribed" | "failed"
    scheduleSubsystemReady: boolean
  }
}

type RuntimeMap = Record<string, ScheduleRuntimeState>

export class AutomationAuthorizationService {
  private readonly store: RumJsJsonStore<AutomationAuthorizationState>

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, { authorized: false })
  }

  async get(): Promise<AutomationAuthorizationState> {
    return this.store.read()
  }

  async authorize(authorizedAt: string): Promise<AutomationAuthorizationState> {
    const next: AutomationAuthorizationState = { authorized: true, authorizedAt }
    await this.store.write(next)
    return next
  }
}

export class ScheduleDefinitionService {
  constructor(private readonly schedules: ScheduleDefinition[]) {}

  async list(): Promise<ScheduleDefinition[]> {
    return [...this.schedules]
  }

  async get(scheduleId: string): Promise<ScheduleDefinition | undefined> {
    return this.schedules.find((item) => item.scheduleId === scheduleId)
  }
}

export class ScheduleRuntimeService {
  private readonly store: RumJsJsonStore<RuntimeMap>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, {})
  }

  async list(): Promise<ScheduleRuntimeState[]> {
    return this.serialize(async () => Object.values(await this.store.read()))
  }

  async get(scheduleId: string): Promise<ScheduleRuntimeState | undefined> {
    return this.serialize(async () => {
      const all = await this.store.read()
      return all[scheduleId]
    })
  }

  async upsert(
    scheduleId: string,
    patch: Partial<ScheduleRuntimeState>
  ): Promise<ScheduleRuntimeState> {
    return this.serialize(async () => {
      const all = await this.store.read()
      const current: ScheduleRuntimeState = all[scheduleId] ?? {
        scheduleId,
        enabled: false,
        lastStatus: "idle",
      }

      const next: ScheduleRuntimeState = {
        ...current,
        ...patch,
        scheduleId,
      }

      all[scheduleId] = next
      await this.store.write(all)
      return next
    })
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export class ScheduleRunRecordService {
  private readonly store: RumJsJsonStore<ScheduleRunRecord[]>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, [])
  }

  async list(): Promise<ScheduleRunRecord[]> {
    return this.serialize(() => this.store.read())
  }

  async append(record: ScheduleRunRecord): Promise<void> {
    await this.serialize(async () => {
      const current = await this.store.read()
      current.push(record)
      await this.store.write(current)
    })
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}

export class SchedulePendingExecutionService {
  private readonly store: RumJsJsonStore<SchedulePendingExecutionItem[]>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, [])
  }

  async list(): Promise<SchedulePendingExecutionItem[]> {
    return this.serialize(() => this.store.read())
  }

  async add(item: SchedulePendingExecutionItem): Promise<void> {
    await this.serialize(async () => {
      const current = await this.store.read()
      current.push(item)
      await this.store.write(current)
    })
  }

  async getByIds(executionIds: string[]): Promise<SchedulePendingExecutionItem[]> {
    return this.serialize(async () => {
      const current = await this.store.read()
      const wanted = new Set(executionIds)
      return current.filter((item) => wanted.has(item.executionId))
    })
  }

  async updateStatus(
    executionIds: string[],
    status: SchedulePendingExecutionStatus
  ): Promise<SchedulePendingExecutionItem[]> {
    return this.serialize(async () => {
      const current = await this.store.read()
      const wanted = new Set(executionIds)
      const updated: SchedulePendingExecutionItem[] = []

      for (const item of current) {
        if (wanted.has(item.executionId)) {
          item.status = status
          updated.push({ ...item })
        }
      }

      await this.store.write(current)
      return updated
    })
  }

  async getPendingOverview(now = new Date()): Promise<ScheduleExecutionOverview> {
    return this.serialize(async () => {
      const current = await this.store.read()
      const items = current.filter((item) => item.status === "pending")
      return {
        pendingCount: items.length,
        items,
        updatedAt: formatDateTime(now),
      }
    })
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
  }
}
