type PageInitPayload = {
  dcfWindowId?: string
}

const DEFAULT_CANDIDATE_KEYS = ["dcf", "DCF", "dcf-subprocess", "dcf_subprocess"]

function safeParseJson<T>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export class KaiyangBaseCommunicationService {
  constructor(private readonly candidateKeys: string[] = DEFAULT_CANDIDATE_KEYS) {}

  listenJson<T>(channel: string, listener: (event: T) => void): void {
    const bridge = this.tryGetBridge()
    if (!bridge) {
      return
    }
    bridge.listen(channel, (message) => {
      const raw = message?.data?.[0]
      if (!raw) {
        return
      }

      const parsed = safeParseJson<T>(raw)
      if (parsed) {
        listener(parsed)
      }
    })
  }

  async sendJson(
    channel: string,
    event: unknown,
    options: {
      dcfWindowId?: string
    } = {}
  ): Promise<void> {
    const bridge = this.getBridge()
    const dcfWindowId = await this.resolveDcfWindowId(options.dcfWindowId)
    await Promise.resolve(bridge.sendToWindow(dcfWindowId, channel, JSON.stringify(event)))
  }

  async getPageInitData<T = unknown>(): Promise<T | undefined> {
    const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
    if (typeof bridge?.getPageInitData !== "function") {
      return undefined
    }

    return bridge.getPageInitData<T>()
  }

  async resolveDcfWindowId(preferredWindowId?: string): Promise<string> {
    if (preferredWindowId) {
      return preferredWindowId
    }

    const pageInitData = await this.getPageInitData<PageInitPayload>()
    if (pageInitData?.dcfWindowId) {
      return pageInitData.dcfWindowId
    }

    if (typeof globalThis.getWinidsMap !== "function") {
      throw new Error("global getWinidsMap is not available")
    }

    const map = await globalThis.getWinidsMap()
    for (const key of this.candidateKeys) {
      const matched = Object.entries(map).find(
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

    const fallback = Object.values(map)[0]
    if (!fallback) {
      throw new Error("DCF windowId not found")
    }
    return fallback
  }

  private getBridge(): BridgeApi {
    const bridge = this.tryGetBridge()
    if (!bridge) {
      throw new Error("global BridgeJs/BridgeJS is not available")
    }
    return bridge
  }

  private tryGetBridge(): BridgeApi | undefined {
    const bridge = globalThis.BridgeJs ?? globalThis.BridgeJS
    return bridge
  }
}
