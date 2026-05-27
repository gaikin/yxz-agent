import {
  AutomationAuthorizationService,
  ScheduleDefinitionService,
  SchedulePendingExecutionService,
  ScheduleRunRecordService,
  ScheduleRuntimeService,
} from "./scheduler/ScheduleStateService"
import { type RumJsCacheApi } from "./common/rumJsJsonStore"
import { createDemoRumJsCache } from "./common/demoRuntimeData"
import {
  ScheduleSkillCatalogService,
  ScheduleSkillExecutionService,
  ScheduleExecutionService,
  ScheduleTimerService,
} from "./scheduler/SchedulerService"
import {
  FrontendChannelService,
  PopupChannelService,
  type FrontendEventPublisher,
  type PopupEventPublisher,
} from "./ChannelService"
import {
  SseSessionJsonRpcToolTransport,
  type JsonRpcToolTransportFactory,
  type JsonRpcToolTransport,
} from "./execution/mcpToolClient"
import { loadSkillsFromDirectory } from "./LocalSkillLoader"
import { query3040TodaySkill } from "./SkillService"
import type {
  DcfBootstrapRuntimeState,
  ScheduleExecutionOverview,
} from "../../share/protocol"

export interface DcfBootstrapDependencies {
  workspaceRoot: string
  deviceId?: string
  publishFrontendEvent: FrontendEventPublisher
  publishPopupEvent: PopupEventPublisher
  toolTransport?: JsonRpcToolTransport
  toolTransportFactory?: JsonRpcToolTransportFactory
  rumJsCache?: RumJsCacheApi
  onPendingExecutionsUpdated?: (
    overview: ScheduleExecutionOverview
  ) => Promise<void> | void
}

export interface DcfRuntime {
  automationAuthorizationService: AutomationAuthorizationService
  scheduleDefinitionService: ScheduleDefinitionService
  scheduleRuntimeService: ScheduleRuntimeService
  scheduleRunRecordService: ScheduleRunRecordService
  schedulePendingExecutionService: SchedulePendingExecutionService
  scheduleExecutionService: ScheduleExecutionService
  scheduleTimerService: ScheduleTimerService
  frontendChannelService: FrontendChannelService
  popupChannelService: PopupChannelService
  runtimeState: RuntimeState
  receiveFrontendEvent(event: import("../../share/protocol").FrontendToDcfEvent | string): Promise<void>
  receivePopupEvent(event: import("../../share/protocol").PopupToDcfEvent | string): Promise<void>
}

export async function bootstrapDcf(deps: DcfBootstrapDependencies): Promise<DcfRuntime> {
  const config = loadConfig(deps.workspaceRoot)
  const deviceId = deps.deviceId ?? "device-001"
  const rumJsCache = deps.rumJsCache ?? createDemoRumJsCache()

  const {
    automationAuthorizationService,
    scheduleDefinitionService,
    scheduleRuntimeService,
    scheduleRunRecordService,
    schedulePendingExecutionService,
  } = createStores(rumJsCache, config.schedules)
  const runtimeState = new RuntimeState()

  const frontendChannelService = new FrontendChannelService(
    deps.publishFrontendEvent,
    deviceId,
    automationAuthorizationService,
    runtimeState,
    scheduleRuntimeService,
    scheduleDefinitionService
  )
  const popupChannelService = new PopupChannelService(
    deps.publishPopupEvent,
    deviceId,
    schedulePendingExecutionService
  )
  const notifyPendingExecution = deps.onPendingExecutionsUpdated
    ? async (overview: ScheduleExecutionOverview) => {
        await popupChannelService.notify(overview)
        await Promise.resolve(deps.onPendingExecutionsUpdated?.(overview))
      }
    : popupChannelService.notify.bind(popupChannelService)

  const toolTransportFactory = createToolTransportFactory(deps, config.mcpBaseUrl)
  const scheduleSkillCatalogService = new ScheduleSkillCatalogService()
  scheduleSkillCatalogService.register(query3040TodaySkill)
  for (const skill of await loadSkillsFromDirectory(deps.workspaceRoot)) {
    scheduleSkillCatalogService.register(skill)
  }
  const scheduleSkillExecutionService = new ScheduleSkillExecutionService(
    scheduleSkillCatalogService,
    toolTransportFactory
  )

  const scheduleExecutionService = new ScheduleExecutionService(
    schedulePendingExecutionService,
    scheduleRunRecordService,
    scheduleRuntimeService,
    notifyPendingExecution,
    frontendChannelService.publishScheduleEnabled.bind(frontendChannelService),
    frontendChannelService.publishScheduleDisabled.bind(frontendChannelService),
    scheduleSkillExecutionService
  )

  const scheduleTimerService = new ScheduleTimerService(
    (schedule, requestedAt) => scheduleExecutionService.onScheduleDue(schedule, requestedAt),
    async (schedule, nextTriggerAt) => {
      await scheduleRuntimeService.upsert(schedule.scheduleId, {
        enabled: true,
        nextTriggerAt,
      })
    }
  )
  frontendChannelService.bindRuntime(scheduleTimerService, scheduleExecutionService)
  popupChannelService.bindRuntime(scheduleExecutionService, scheduleDefinitionService)

  runtimeState.set({
    dcfStatus: "online",
    scheduleSubsystemReady: true,
  })

  await restoreEnabledSchedules(
    automationAuthorizationService,
    scheduleRuntimeService,
    scheduleDefinitionService,
    scheduleTimerService
  )

  await frontendChannelService.publishBootstrapState()

  return {
    automationAuthorizationService,
    scheduleDefinitionService,
    scheduleRuntimeService,
    scheduleRunRecordService,
    schedulePendingExecutionService,
    scheduleExecutionService,
    scheduleTimerService,
    frontendChannelService,
    popupChannelService,
    runtimeState,
    receiveFrontendEvent(event) {
      return frontendChannelService.receive(event)
    },
    receivePopupEvent(event) {
      return popupChannelService.receive(event)
    },
  }
}

function createStores(
  rumJsCache: RumJsCacheApi,
  schedules: import("./scheduler/ScheduleStateService").ScheduleDefinition[]
) {
  return {
    automationAuthorizationService: new AutomationAuthorizationService(
      rumJsCache,
      "automation-authorization.json"
    ),
    scheduleDefinitionService: new ScheduleDefinitionService(schedules),
    scheduleRuntimeService: new ScheduleRuntimeService(rumJsCache, "schedule-runtime.json"),
    scheduleRunRecordService: new ScheduleRunRecordService(
      rumJsCache,
      "schedule-run-records.json"
    ),
    schedulePendingExecutionService: new SchedulePendingExecutionService(
      rumJsCache,
      "schedule-pending-executions.json"
    ),
  }
}

function createToolTransportFactory(
  deps: DcfBootstrapDependencies,
  mcpBaseUrl: string
): JsonRpcToolTransportFactory {
  if (deps.toolTransportFactory) {
    return deps.toolTransportFactory
  }

  if (deps.toolTransport) {
    return {
      create() {
        return deps.toolTransport as JsonRpcToolTransport
      },
    }
  }

  return {
    create() {
      return new SseSessionJsonRpcToolTransport(mcpBaseUrl)
    },
  }
}

async function restoreEnabledSchedules(
  automationAuthorizationService: AutomationAuthorizationService,
  scheduleRuntimeService: ScheduleRuntimeService,
  scheduleDefinitionService: ScheduleDefinitionService,
  scheduleTimerService: ScheduleTimerService
): Promise<void> {
  const authorization = await automationAuthorizationService.get()
  if (!authorization.authorized) {
    return
  }

  const runtimeById = new Map(
    (await scheduleRuntimeService.list()).map((item) => [item.scheduleId, item])
  )

  for (const schedule of await scheduleDefinitionService.list()) {
    if (runtimeById.get(schedule.scheduleId)?.enabled) {
      await scheduleTimerService.register(schedule)
    }
  }
}

class RuntimeState {
  private state: DcfBootstrapRuntimeState = {
    dcfStatus: "starting",
    scheduleSubsystemReady: false,
  }

  set(next: Partial<DcfBootstrapRuntimeState>): void {
    this.state = { ...this.state, ...next }
  }

  snapshot(): DcfBootstrapRuntimeState {
    return { ...this.state }
  }
}

function loadConfig(_workspaceRoot: string): import("./scheduler/ScheduleStateService").DcfConfig {
  return {
    mcpBaseUrl: "http://127.0.0.1:26666",
    schedules: [
      {
        scheduleId: "schedule_3040_daily",
        name: "3040每日查询",
        cronExpression: "0 0 10 * * *",
        timezone: "Asia/Shanghai",
        skillId: "query_3040_today",
      },
    ],
  }
}



