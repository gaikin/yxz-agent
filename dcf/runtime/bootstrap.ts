import {
  AutomationAuthorizationStore,
  ScheduleLoader,
  SchedulePendingExecutionStore,
  ScheduleRunRecordStore,
  ScheduleRuntimeStore,
} from "../scheduler/stores"
import { createMemoryRumJsCache, type RumJsCacheApi } from "../common/rumJsJsonStore"
import { ScheduleSkillRegistry } from "../scheduler/scheduleSkillRegistry"
import { ScheduleSkillRunner } from "../scheduler/scheduleSkillRunner"
import { ScheduleExecutionCoordinator } from "../scheduler/scheduleExecutionCoordinator"
import { SchedulerManager } from "../scheduler/schedulerManager"
import { RuntimeState } from "./runtimeState"
import { loadConfig } from "./configLoader"
import { FrontendEventPublisher, type FrontendEventSink } from "../channel/frontendEventPublisher"
import { PopupEventPublisher, type PopupEventSink } from "../channel/popupEventPublisher"
import { FrontendEventHandlerRegistry, PopupEventHandlerRegistry } from "../channel/handlerFramework"
import {
  CompositePendingExecutionNotifier,
  HostPendingExecutionNotifier,
  type HostPendingExecutionCallback,
} from "../channel/pendingExecutionNotifier"
import { FrontendChannelServer } from "../channel/frontendChannelServer"
import { PopupChannelServer } from "../channel/popupChannelServer"
import { FrontendEventController } from "../channel/frontendEventController"
import { PopupEventController } from "../channel/popupEventController"
import {
  SseSessionJsonRpcToolTransport,
  type JsonRpcToolTransportFactory,
  type JsonRpcToolTransport,
} from "../execution/mcpToolClient"
import { query3040TodaySkill } from "../skills/query3040Today"

export interface DcfBootstrapDependencies {
  workspaceRoot: string
  deviceId?: string
  frontendSink: FrontendEventSink
  popupSink: PopupEventSink
  toolTransport?: JsonRpcToolTransport
  toolTransportFactory?: JsonRpcToolTransportFactory
  rumJsCache?: RumJsCacheApi
  hostPendingExecutionCallback?: HostPendingExecutionCallback
}

export interface DcfRuntime {
  automationAuthorizationStore: AutomationAuthorizationStore
  scheduleLoader: ScheduleLoader
  scheduleRuntimeStore: ScheduleRuntimeStore
  scheduleRunRecordStore: ScheduleRunRecordStore
  schedulePendingExecutionStore: SchedulePendingExecutionStore
  scheduleExecutionCoordinator: ScheduleExecutionCoordinator
  schedulerManager: SchedulerManager
  frontendEventPublisher: FrontendEventPublisher
  popupEventPublisher: PopupEventPublisher
  runtimeState: RuntimeState
  frontendChannelServer: FrontendChannelServer
  popupChannelServer: PopupChannelServer
}

export async function bootstrapDcf(deps: DcfBootstrapDependencies): Promise<DcfRuntime> {
  const config = loadConfig(deps.workspaceRoot)
  const deviceId = deps.deviceId ?? "device-001"
  const rumJsCache = deps.rumJsCache ?? createMemoryRumJsCache()

  const automationAuthorizationStore = new AutomationAuthorizationStore(
    rumJsCache,
    "automation-authorization.json"
  )
  const scheduleLoader = new ScheduleLoader(config.schedules)
  const scheduleRuntimeStore = new ScheduleRuntimeStore(rumJsCache, "schedule-runtime.json")
  const scheduleRunRecordStore = new ScheduleRunRecordStore(
    rumJsCache,
    "schedule-run-records.json"
  )
  const schedulePendingExecutionStore = new SchedulePendingExecutionStore(
    rumJsCache,
    "schedule-pending-executions.json"
  )
  const runtimeState = new RuntimeState()

  const frontendEventPublisher = new FrontendEventPublisher(
    deps.frontendSink,
    deviceId,
    automationAuthorizationStore,
    runtimeState,
    scheduleRuntimeStore,
    scheduleLoader
  )
  const popupEventPublisher = new PopupEventPublisher(
    deps.popupSink,
    deviceId,
    schedulePendingExecutionStore
  )
  const pendingExecutionNotifier = deps.hostPendingExecutionCallback
    ? new CompositePendingExecutionNotifier([
        popupEventPublisher,
        new HostPendingExecutionNotifier(deps.hostPendingExecutionCallback),
      ])
    : popupEventPublisher

  const toolTransportFactory =
    deps.toolTransportFactory ??
    (deps.toolTransport
      ? {
          create() {
            return deps.toolTransport as JsonRpcToolTransport
          },
        }
      : {
          create() {
            return new SseSessionJsonRpcToolTransport(config.mcpBaseUrl)
          },
        })
  const skillRegistry = new ScheduleSkillRegistry()
  skillRegistry.register(query3040TodaySkill)
  const skillRunner = new ScheduleSkillRunner(skillRegistry, toolTransportFactory)

  const scheduleExecutionCoordinator = new ScheduleExecutionCoordinator(
    schedulePendingExecutionStore,
    scheduleRunRecordStore,
    scheduleRuntimeStore,
    pendingExecutionNotifier,
    frontendEventPublisher,
    skillRunner
  )

  const schedulerManager = new SchedulerManager(
    (schedule, requestedAt) => scheduleExecutionCoordinator.onScheduleDue(schedule, requestedAt),
    async (schedule, nextTriggerAt) => {
      await scheduleRuntimeStore.upsert(schedule.scheduleId, {
        enabled: true,
        nextTriggerAt,
      })
    }
  )

  const frontendRegistry = new FrontendEventHandlerRegistry()
  frontendRegistry.registerController(
    new FrontendEventController(
      automationAuthorizationStore,
      scheduleLoader,
      schedulerManager,
      scheduleExecutionCoordinator,
      scheduleRuntimeStore,
      frontendEventPublisher
    )
  )

  const popupRegistry = new PopupEventHandlerRegistry()
  popupRegistry.registerController(
    new PopupEventController(scheduleExecutionCoordinator, scheduleLoader)
  )

  const frontendChannelServer = new FrontendChannelServer(frontendRegistry)
  const popupChannelServer = new PopupChannelServer(popupRegistry)

  runtimeState.set({
    dcfStatus: "online",
    scheduleSubsystemReady: true,
  })

  const authorization = await automationAuthorizationStore.get()
  if (authorization.authorized) {
    const runtimeById = new Map(
      (await scheduleRuntimeStore.list()).map((item) => [item.scheduleId, item])
    )

    for (const schedule of await scheduleLoader.list()) {
      if (runtimeById.get(schedule.scheduleId)?.enabled) {
        await schedulerManager.register(schedule)
      }
    }
  }

  await frontendEventPublisher.publishBootstrapState()

  return {
    automationAuthorizationStore,
    scheduleLoader,
    scheduleRuntimeStore,
    scheduleRunRecordStore,
    schedulePendingExecutionStore,
    scheduleExecutionCoordinator,
    schedulerManager,
    frontendEventPublisher,
    popupEventPublisher,
    runtimeState,
    frontendChannelServer,
    popupChannelServer,
  }
}
