import type { DcfConfig } from "../scheduler/types"

export function loadConfig(_workspaceRoot: string): DcfConfig {
  return {
    schedules: [
      {
        scheduleId: "schedule_3040_daily",
        name: "3040每日查询",
        cronExpression: "0 0 9 * * *",
        timezone: "Asia/Shanghai",
        skillId: "query_3040_today",
      },
    ],
  }
}
