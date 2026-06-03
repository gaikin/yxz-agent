import type {
  AutomationAuthorizationState,
  SchedulePendingExecutionItem,
} from "../../../share/protocol"
import type {
  ScheduleRunRecord,
  ScheduleRuntimeState,
} from "../scheduler/ScheduleStateService"
import { createMemoryRumJsCache, type RumJsCacheApi } from "./rumJsJsonStore"

export interface DemoRuntimeData {
  automationAuthorization: AutomationAuthorizationState
  scheduleRuntime: Record<string, ScheduleRuntimeState>
  scheduleRunRecords: ScheduleRunRecord[]
  schedulePendingExecutions: SchedulePendingExecutionItem[]
}

export const DEFAULT_DEMO_RUNTIME_DATA: DemoRuntimeData = {
  automationAuthorization: {
    authorized: true,
    authorizedAt: "2026-04-08 09:00:00",
  },
  scheduleRuntime: {
    schedule_3040_daily: {
      scheduleId: "schedule_3040_daily",
      enabled: true,
      nextTriggerAt: "2026-04-09 10:00:00",
      lastTriggeredAt: "2026-04-08 10:00:00",
      lastCompletedAt: "2026-04-08 10:00:03",
      lastStatus: "completed",
      lastRunId: "run_demo_3040_001",
    },
  },
  scheduleRunRecords: [
    {
      executionId: "exec_demo_3040_001",
      scheduleId: "schedule_3040_daily",
      scheduleName: "3040每日查询",
      requestedAt: "2026-04-08 10:00:00",
      runId: "run_demo_3040_001",
      startedAt: "2026-04-08 10:00:00",
      completedAt: "2026-04-08 10:00:03",
      status: "completed",
      result: {
        status: "completed",
        data: {
          ok: true,
          results: [
            {
              componentId: "btn_query_1",
              command: "click",
              status: "success",
            },
          ],
        },
        steps: [
          {
            stepId: "openMenu",
            stepPath: "openMenu",
            status: "completed",
            executor: {
              type: "mcp",
              mcpName: "kaiyang",
              toolName: "openMenu",
            },
            beforeDelayMs: 0,
            startedAt: "2026-04-08T02:00:00.000Z",
            finishedAt: "2026-04-08T02:00:01.000Z",
            durationMs: 1000,
            outputName: "tabInfo",
            result: {
              tabId: "tab_demo_3040_001",
            },
          },
          {
            stepId: "clickQuery",
            stepPath: "clickQuery",
            status: "completed",
            executor: {
              type: "mcp",
              mcpName: "kaiyang",
              toolName: "executePageCommands",
            },
            beforeDelayMs: 0,
            startedAt: "2026-04-08T02:00:01.000Z",
            finishedAt: "2026-04-08T02:00:03.000Z",
            durationMs: 2000,
            outputName: "queryResult",
            result: {
              ok: true,
              results: [
                {
                  componentId: "btn_query_1",
                  command: "click",
                  status: "success",
                },
              ],
            },
          },
        ],
      },
    },
  ],
  schedulePendingExecutions: [],
}

export function createDemoRuntimeData(
  overrides: Partial<DemoRuntimeData> = {}
): DemoRuntimeData {
  return {
    automationAuthorization: {
      ...DEFAULT_DEMO_RUNTIME_DATA.automationAuthorization,
      ...overrides.automationAuthorization,
    },
    scheduleRuntime: {
      ...DEFAULT_DEMO_RUNTIME_DATA.scheduleRuntime,
      ...overrides.scheduleRuntime,
    },
    scheduleRunRecords:
      overrides.scheduleRunRecords ?? DEFAULT_DEMO_RUNTIME_DATA.scheduleRunRecords,
    schedulePendingExecutions:
      overrides.schedulePendingExecutions ?? DEFAULT_DEMO_RUNTIME_DATA.schedulePendingExecutions,
  }
}

export function createDemoRumJsCache(
  overrides: Partial<DemoRuntimeData> = {}
): RumJsCacheApi {
  const data = createDemoRuntimeData(overrides)
  return createMemoryRumJsCache({
    "automation-authorization.json": JSON.stringify(data.automationAuthorization, null, 2),
    "schedule-runtime.json": JSON.stringify(data.scheduleRuntime, null, 2),
    "schedule-run-records.json": JSON.stringify(data.scheduleRunRecords, null, 2),
    "schedule-pending-executions.json": JSON.stringify(data.schedulePendingExecutions, null, 2),
  })
}
