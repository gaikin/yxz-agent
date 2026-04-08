import { RumJsJsonStore, type RumJsCacheApi } from "../common/rumJsJsonStore"
import type {
  AutomationAuthorizationState,
  ScheduleExecutionOverview,
  SchedulePendingExecutionItem,
  SchedulePendingExecutionStatus,
} from "../../types/appProtocol"
import type { ScheduleDefinition, ScheduleRunRecord, ScheduleRuntimeState } from "./types"

type RuntimeMap = Record<string, ScheduleRuntimeState>

export class AutomationAuthorizationStore {
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

export class ScheduleLoader {
  constructor(private readonly schedules: ScheduleDefinition[]) {}

  async list(): Promise<ScheduleDefinition[]> {
    return [...this.schedules]
  }

  async get(scheduleId: string): Promise<ScheduleDefinition | undefined> {
    return this.schedules.find((item) => item.scheduleId === scheduleId)
  }
}

export class ScheduleRuntimeStore {
  private readonly store: RumJsJsonStore<RuntimeMap>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, {})
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
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

  async upsert(scheduleId: string, patch: Partial<ScheduleRuntimeState>): Promise<ScheduleRuntimeState> {
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
}

export class ScheduleRunRecordStore {
  private readonly store: RumJsJsonStore<ScheduleRunRecord[]>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, [])
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
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
}

export class SchedulePendingExecutionStore {
  private readonly store: RumJsJsonStore<SchedulePendingExecutionItem[]>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(rumJsCacheApi: RumJsCacheApi, fileName: string) {
    this.store = new RumJsJsonStore(rumJsCacheApi, fileName, [])
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation, operation)
    this.queue = result.then(
      () => undefined,
      () => undefined
    )
    return result
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

  async updateStatus(executionIds: string[], status: SchedulePendingExecutionStatus): Promise<SchedulePendingExecutionItem[]> {
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
        updatedAt: now.toISOString(),
      }
    })
  }
}
