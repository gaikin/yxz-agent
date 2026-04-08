import {
  AutomationAuthorizationStore,
  ScheduleLoader,
  SchedulePendingExecutionStore,
  ScheduleRunRecordStore,
  ScheduleRuntimeStore,
} from "../scheduler/stores"
import type { RumJsCacheApi } from "../common/rumJsJsonStore"
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
import { ToolHandlerRegistry } from "../execution/toolHandlerRegistry"
import { DefaultToolExecutor } from "../execution/toolExecutor"
import {
  HttpJsonRpcToolTransport,
  JsonRpcMcpToolClient,
  type JsonRpcToolTransport,
} from "../execution/mcpToolClient"
import { ExecutePageCommandsHandler, OpenMenuHandler, ReadSchemaHandler } from "../execution/toolHandlers"
import { SkillEngine } from "../skills/skillEngine"
import { query3040TodaySkill } from "../skills/query3040Today"

export interface DcfBootstrapDependencies {
  workspaceRoot: string
  deviceId?: string
  frontendSink: FrontendEventSink
  popupSink: PopupEventSink
  toolTransport?: JsonRpcToolTransport
  rumJsCache: RumJsCacheApi
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

  const automationAuthorizationStore = new AutomationAuthorizationStore(
    deps.rumJsCache,
    "automation-authorization.json"
  )
  const scheduleLoader = new ScheduleLoader(config.schedules)
  const scheduleRuntimeStore = new ScheduleRuntimeStore(deps.rumJsCache, "schedule-runtime.json")
  const scheduleRunRecordStore = new ScheduleRunRecordStore(
    deps.rumJsCache,
    "schedule-run-records.json"
  )
  const schedulePendingExecutionStore = new SchedulePendingExecutionStore(
    deps.rumJsCache,
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

  const toolTransport = deps.toolTransport ?? new HttpJsonRpcToolTransport(config.mcpEndpoint)
  const mcpToolClient = new JsonRpcMcpToolClient(toolTransport)
  const toolHandlerRegistry = new ToolHandlerRegistry()
  toolHandlerRegistry.register(new OpenMenuHandler(mcpToolClient))
  toolHandlerRegistry.register(new ExecutePageCommandsHandler(mcpToolClient))
  toolHandlerRegistry.register(new ReadSchemaHandler(mcpToolClient))

  const toolExecutor = new DefaultToolExecutor(toolHandlerRegistry)
  const skillEngine = new SkillEngine(toolExecutor)
  const skillRegistry = new ScheduleSkillRegistry()
  skillRegistry.register(query3040TodaySkill)
  const skillRunner = new ScheduleSkillRunner(skillRegistry, skillEngine)

  const scheduleExecutionCoordinator = new ScheduleExecutionCoordinator(
    schedulePendingExecutionStore,
    scheduleRunRecordStore,
    scheduleRuntimeStore,
    pendingExecutionNotifier,
    frontendEventPublisher,
    skillRunner
  )

  const schedulerManager = new SchedulerManager((schedule, requestedAt) =>
    scheduleExecutionCoordinator.onScheduleDue(schedule, requestedAt)
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
