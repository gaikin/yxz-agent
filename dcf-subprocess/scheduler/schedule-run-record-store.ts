import { JsonFileStore } from "../common/json-file-store"
import type { ScheduleRunRecord } from "./types"

export class ScheduleRunRecordStore {
  private readonly store: JsonFileStore<ScheduleRunRecord[]>
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
