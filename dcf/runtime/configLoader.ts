import type { DcfConfig } from "../scheduler/types"

export function loadConfig(_workspaceRoot: string): DcfConfig {
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
