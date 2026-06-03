import type {
  RuntimeEvent,
  RuntimeEventFilter,
  RuntimeEventHandler,
} from "./runtime-events"

type Subscriber = {
  filter: RuntimeEventFilter
  handler: RuntimeEventHandler
}

const MAX_DEDUP_EVENT_IDS = 1000

export type Unsubscribe = () => void

export class RuntimeEventDispatcher {
  private readonly subscribers = new Map<string, Subscriber>()
  private readonly consumedEventIds = new Set<string>()
  private readonly consumedEventIdQueue: string[] = []

  subscribe(filter: RuntimeEventFilter, handler: RuntimeEventHandler): Unsubscribe {
    const subscriberId = crypto.randomUUID()
    this.subscribers.set(subscriberId, { filter, handler })

    return () => {
      this.subscribers.delete(subscriberId)
    }
  }

  publish(event: RuntimeEvent): void {
    if (this.consumedEventIds.has(event.EventId)) {
      return
    }

    this.rememberEventId(event.EventId)

    for (const subscriber of this.subscribers.values()) {
      if (!this.matches(subscriber.filter, event)) {
        continue
      }

      void Promise.resolve(subscriber.handler(event)).catch((error) => {
        console.error("[RuntimeEventDispatcher] subscriber failed", error)
      })
    }
  }

  clear(): void {
    this.subscribers.clear()
    this.consumedEventIds.clear()
    this.consumedEventIdQueue.length = 0
  }

  private rememberEventId(eventId: string): void {
    this.consumedEventIds.add(eventId)
    this.consumedEventIdQueue.push(eventId)

    if (this.consumedEventIdQueue.length <= MAX_DEDUP_EVENT_IDS) {
      return
    }

    const expiredEventId = this.consumedEventIdQueue.shift()
    if (!expiredEventId) {
      return
    }
    this.consumedEventIds.delete(expiredEventId)
  }

  private matches(filter: RuntimeEventFilter, event: RuntimeEvent): boolean {
    if (filter.EventType && filter.EventType !== event.EventType) {
      return false
    }
    if (filter.ConversationId && filter.ConversationId !== event.ConversationId) {
      return false
    }
    if (filter.SessionLocalId && filter.SessionLocalId !== event.SessionLocalId) {
      return false
    }
    if (filter.RunId && filter.RunId !== event.RunId) {
      return false
    }
    if (filter.ToolName && filter.ToolName !== event.ToolName) {
      return false
    }

    return true
  }
}
