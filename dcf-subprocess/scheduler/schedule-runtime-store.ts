import { JsonFileStore } from "../common/json-file-store"
import type { ScheduleRuntimeState } from "./types"

type RuntimeMap = Record<string, ScheduleRuntimeState>

export class ScheduleRuntimeStore {
  private readonly store: JsonFileStore<RuntimeMap>
  private queue: Promise<unknown> = Promise.resolve()

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath, {})
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
