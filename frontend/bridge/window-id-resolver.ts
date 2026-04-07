type WindowIdMap = Record<string, string>

interface HostWindowWithIds {
  getWinidsMap?: () => WindowIdMap | Promise<WindowIdMap>
}

export interface WindowIdResolver {
  getDcfWindowId(): Promise<string>
}

export class BrowserWindowIdResolver implements WindowIdResolver {
  constructor(
    private readonly hostWindow: HostWindowWithIds = globalThis as unknown as HostWindowWithIds,
    private readonly candidateKeys: string[] = ["dcf", "DCF", "dcf-subprocess", "dcf_subprocess"]
  ) {}

  async getDcfWindowId(): Promise<string> {
    if (typeof this.hostWindow.getWinidsMap !== "function") {
      throw new Error("window.getWinidsMap is not available")
    }

    const winidsMap = await this.hostWindow.getWinidsMap()

    for (const key of this.candidateKeys) {
      const matched = Object.entries(winidsMap).find(
        ([mapKey, mapValue]) =>
          mapKey === key ||
          mapKey.includes(key) ||
          mapValue === key ||
          mapValue.includes(key)
      )

      if (matched) {
        return matched[1]
      }
    }

    const fallback = Object.values(winidsMap)[0]
    if (!fallback) {
      throw new Error("DCF windowId not found")
    }

    return fallback
  }
}

