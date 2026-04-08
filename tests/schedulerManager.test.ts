import test from "node:test"
import assert from "node:assert/strict"
import { SchedulerManager } from "../dcf/scheduler/schedulerManager"
import type { ScheduleDefinition } from "../dcf/scheduler/types"

const fastSchedule: ScheduleDefinition = {
  scheduleId: "schedule_fast",
  name: "Fast schedule",
  cronExpression: "*/1 * * * * *",
  timezone: "Asia/Shanghai",
  skillId: "query_3040_today",
}

test("scheduler manager reschedules the next occurrence after a due run", async () => {
  const dueTimes: string[] = []
  const registeredTimes: string[] = []
  const manager = new SchedulerManager(
    async (_schedule, requestedAt) => {
      dueTimes.push(requestedAt.toISOString())
    },
    async (_schedule, nextTriggerAt) => {
      registeredTimes.push(nextTriggerAt)
    }
  )

  const firstTriggerAt = await manager.register(fastSchedule, new Date())
  await new Promise((resolve) => setTimeout(resolve, 1200))

  const secondTriggerAt = manager.getNextTriggerAt(fastSchedule.scheduleId)

  assert.equal(dueTimes.length >= 1, true)
  assert.equal(registeredTimes.length >= 2, true)
  assert.ok(secondTriggerAt)
  assert.notEqual(secondTriggerAt, firstTriggerAt)

  await manager.stop()
})

