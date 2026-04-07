import { JsonFileStore } from "../common/json-file-store"
import type { AutomationAuthorizationState } from "../../shared/protocol"

export class AutomationAuthorizationStore {
  private readonly store: JsonFileStore<AutomationAuthorizationState>

  constructor(filePath: string) {
    this.store = new JsonFileStore(filePath, { authorized: false })
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

