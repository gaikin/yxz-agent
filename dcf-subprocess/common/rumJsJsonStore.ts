export interface RumJsCacheApi {
  readCacheFileAsync(args: { fileName: string }): Promise<string | undefined | null>
  writeCacheFileAsync(args: { fileName: string; content: string }): Promise<void>
}

export class RumJsJsonStore<T> {
  constructor(
    private readonly rumJsCacheApi: RumJsCacheApi,
    private readonly fileName: string,
    private readonly defaultValue: T
  ) {}

  async read(): Promise<T> {
    try {
      const content = await this.rumJsCacheApi.readCacheFileAsync({ fileName: this.fileName })
      if (!content) {
        return this.defaultValue
      }
      return JSON.parse(content) as T
    } catch {
      return this.defaultValue
    }
  }

  async write(value: T): Promise<void> {
    await this.rumJsCacheApi.writeCacheFileAsync({
      fileName: this.fileName,
      content: JSON.stringify(value, null, 2),
    })
  }
}
