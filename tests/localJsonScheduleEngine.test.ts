import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  LocalJsonScheduleEngine,
  loadLocalScheduleFile,
} from "../subprocess/service/scheduler/LocalJsonScheduleEngine"

test("loadLocalScheduleFile reads local json schedules", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schedule-loader-"))
  const configDir = path.join(workspaceRoot, "config")
  await fs.mkdir(configDir, { recursive: true })
  const configFilePath = path.join(configDir, "schedules.json")

  await fs.writeFile(
    configFilePath,
    JSON.stringify(
      {
        schedules: [
          {
            scheduleId: "schedule_demo",
            name: "演示任务",
            cronExpression: "0 0 10 * * *",
            timezone: "Asia/Shanghai",
            skillFile: "skills/demo.json",
            enabled: true,
          },
        ],
      },
      null,
      2
    )
  )

  const schedules = await loadLocalScheduleFile(configFilePath)
  assert.equal(schedules.length, 1)
  assert.equal(schedules[0].scheduleId, "schedule_demo")
})

test("local json schedule engine schedules enabled jobs from file", async () => {
  const workspaceRoot = await fs.mkdtemp(path.join(os.tmpdir(), "schedule-engine-"))
  const configDir = path.join(workspaceRoot, "config")
  await fs.mkdir(configDir, { recursive: true })
  await fs.writeFile(
    path.join(configDir, "schedules.json"),
    JSON.stringify(
      {
        schedules: [
          {
            scheduleId: "schedule_demo",
            name: "演示任务",
            cronExpression: "0 * * * * *",
            timezone: "Asia/Shanghai",
            skillFile: "skills/demo.json",
            enabled: true,
          },
        ],
      },
      null,
      2
    )
  )

  const triggers: string[] = []
  const engine = new LocalJsonScheduleEngine({
    workspaceRoot,
    onTrigger: async ({ schedule }) => {
      triggers.push(schedule.scheduleId)
    },
    now: () => new Date("2026-04-09T10:00:00+08:00"),
  })

  await engine.start()
  const state = engine.getState("schedule_demo")

  assert.equal(state?.enabled, true)
  assert.equal(typeof state?.nextTriggerAt, "string")
  assert.deepEqual(triggers, [])

  await engine.stop()
})
