import { JsonFileStore } from "../common/json-file-store"
import type { ScheduleExecutionOverview, SchedulePendingExecutionItem, SchedulePendingExecutionStatus } from "../../shared/protocol"

export class SchedulePendingExecutionStore {
  private readonly store: JsonFileStore<SchedulePendingExecutionItem[]>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath, [])
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
