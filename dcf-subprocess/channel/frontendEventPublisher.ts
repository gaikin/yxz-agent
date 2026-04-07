import type {
  DcfToFrontendEvent,
  FrontendAutomationAuthorizedEvent,
  FrontendBootstrapStateEvent,
  FrontendScheduleStateSnapshotEvent,
  FrontendScheduleDisabledEvent,
  FrontendScheduleEnabledEvent,
} from "../../shared/protocol"
import type { RuntimeState } from "../runtime/runtimeState"
import type { FrontendEventPublisher as FrontendEventPublisherContract } from "../scheduler/types"
import { ScheduleLoader, ScheduleRuntimeStore, type AutomationAuthorizationStore } from "../scheduler/stores"

export interface FrontendEventSink {
  publish(event: DcfToFrontendEvent): Promise<void>
}

export class FrontendEventPublisher implements FrontendEventPublisherContract {
  constructor(
    private readonly sink: FrontendEventSink,
    private readonly deviceId: string,
    private readonly authorizationStore: AutomationAuthorizationStore,
    private readonly runtimeState: RuntimeState,
    private readonly scheduleRuntimeStore: ScheduleRuntimeStore,
    private readonly scheduleLoader: ScheduleLoader
  ) {}

  async publishBootstrapState(): Promise<void> {
    const event: FrontendBootstrapStateEvent = {
      type: "BOOTSTRAP_STATE",
      deviceId: this.deviceId,
      automationAuthorization: await this.authorizationStore.get(),
      dcfRuntime: this.runtimeState.snapshot(),
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }

  async publishAutomationAuthorized(authorizedAt: string): Promise<void> {
    const event: FrontendAutomationAuthorizedEvent = {
      type: "AUTOMATION_AUTHORIZED",
      deviceId: this.deviceId,
      authorizedAt,
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }

  async publishScheduleStateSnapshot(): Promise<void> {
    const definitions = await this.scheduleLoader.list()
    const runtimeById = new Map(
      (await this.scheduleRuntimeStore.list()).map((item) => [item.scheduleId, item])
    )
    const schedules = definitions.map((definition) => {
      const runtime = runtimeById.get(definition.scheduleId)
      return {
        scheduleId: definition.scheduleId,
        name: definition.name,
        enabled: runtime?.enabled ?? false,
        cronExpression: definition.cronExpression,
        timezone: definition.timezone,
        nextTriggerAt: runtime?.nextTriggerAt,
        lastTriggeredAt: runtime?.lastTriggeredAt,
        lastCompletedAt: runtime?.lastCompletedAt,
        lastStatus: runtime?.lastStatus ?? "idle",
      }
    })
    const event: FrontendScheduleStateSnapshotEvent = {
      type: "SCHEDULE_STATE_SNAPSHOT",
      deviceId: this.deviceId,
      schedules,
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }

  async publishScheduleEnabled(scheduleId: string, nextTriggerAt?: string): Promise<void> {
    const event: FrontendScheduleEnabledEvent = {
      type: "SCHEDULE_ENABLED",
      deviceId: this.deviceId,
      scheduleId,
      nextTriggerAt,
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }

  async publishScheduleDisabled(scheduleId: string): Promise<void> {
    const event: FrontendScheduleDisabledEvent = {
      type: "SCHEDULE_DISABLED",
      deviceId: this.deviceId,
      scheduleId,
      sentAt: new Date().toISOString(),
    }
    await this.sink.publish(event)
  }
}
