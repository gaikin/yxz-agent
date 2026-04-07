import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T
  ) {}

  async read(): Promise<T> {
    try {
      const content = await readFile(this.filePath, "utf8")
      return JSON.parse(content) as T
    } catch {
      return this.defaultValue
    }
  }

  async write(value: T): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(value, null, 2), "utf8")
  }
}

