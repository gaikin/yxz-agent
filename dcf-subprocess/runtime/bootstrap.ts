import path from "node:path"
import { AutomationAuthorizationStore } from "../scheduler/automation-authorization-store"
import { ScheduleLoader } from "../scheduler/schedule-loader"
import { SchedulePendingExecutionStore } from "../scheduler/schedule-pending-execution-store"
import { ScheduleRunRecordStore } from "../scheduler/schedule-run-record-store"
import { ScheduleRuntimeStore } from "../scheduler/schedule-runtime-store"
import { ScheduleSkillRegistry } from "../scheduler/schedule-skill-registry"
import { ScheduleSkillRunner } from "../scheduler/schedule-skill-runner"
import { ScheduleExecutionCoordinator } from "../scheduler/schedule-execution-coordinator"
import { SchedulerManager } from "../scheduler/scheduler-manager"
import { RuntimeState } from "./runtime-state"
import { loadConfig } from "./config-loader"
import { FrontendEventPublisher, type FrontendEventSink } from "../channel/frontend-event-publisher"
import { PopupEventPublisher, type PopupEventSink } from "../channel/popup-event-publisher"
import { FrontendEventHandlerRegistry } from "../channel/frontend-event-handler-registry"
import { PopupEventHandlerRegistry } from "../channel/popup-event-handler-registry"
import { FrontendChannelServer } from "../channel/frontend-channel-server"
import { PopupChannelServer } from "../channel/popup-channel-server"
import { FrontendEventController } from "../channel/frontend-event-controller"
import { PopupEventController } from "../channel/popup-event-controller"
import { ToolHandlerRegistry } from "../execution/tool-handler-registry"
import { DefaultToolExecutor } from "../execution/tool-executor"
import { JsonRpcMcpToolClient, type JsonRpcToolTransport } from "../execution/mcp-tool-client"
import { OpenMenuHandler } from "../execution/handlers/open-menu-handler"
import { ExecutePageCommandsHandler } from "../execution/handlers/execute-page-commands-handler"
import { ReadSchemaHandler } from "../execution/handlers/read-schema-handler"
import { SkillEngine } from "../skills/skill-engine"
import { query3040TodaySkill } from "../skills/query_3040_today"

export interface DcfBootstrapDependencies {
  workspaceRoot: string
  deviceId?: string
  frontendSink: FrontendEventSink
  popupSink: PopupEventSink
  toolTransport: JsonRpcToolTransport
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
  const dataDir = config.dataDir
  const deviceId = deps.deviceId ?? "device-001"

  const automationAuthorizationStore = new AutomationAuthorizationStore(
    path.join(dataDir, "automation-authorization.json")
  )
  const scheduleLoader = new ScheduleLoader(config.schedules)
  const scheduleRuntimeStore = new ScheduleRuntimeStore(path.join(dataDir, "schedule-runtime.json"))
  const scheduleRunRecordStore = new ScheduleRunRecordStore(path.join(dataDir, "schedule-run-records.json"))
  const schedulePendingExecutionStore = new SchedulePendingExecutionStore(
    path.join(dataDir, "schedule-pending-executions.json")
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

  const mcpToolClient = new JsonRpcMcpToolClient(deps.toolTransport)
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
    popupEventPublisher,
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
