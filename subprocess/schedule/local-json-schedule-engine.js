"use strict"

const path = require("node:path")
const { CronExpressionParser } = require("cron-parser")
const { formatDateTime, readJsonFile, writeJsonFile } = require("./utils")

class LocalJsonScheduleEngine {
  constructor(options) {
    this.options = options
    this.now = options.now || (() => new Date())
    this.schedulesFile = path.resolve(
      options.workspaceRoot,
      options.schedulesFile || "subprocess/schedule/examples/schedules.json"
    )
    this.historyFile = path.resolve(
      options.workspaceRoot,
      options.historyFile || "subprocess/schedule/runtime/schedule-history.json"
    )
    this.jobs = new Map()
    this.stateById = new Map()
  }

  async start() {
    await this.reload()
  }

  async reload() {
    await this.stop()

    const schedules = await loadScheduleDefinitions(this.schedulesFile)
    const history = await this.loadHistory()

    for (const schedule of schedules) {
      const executedRecord = history.find((item) => item.scheduleId === schedule.scheduleId)
      const initialState = {
        scheduleId: schedule.scheduleId,
        enabled: schedule.enabled,
        nextTriggerAt: undefined,
        lastTriggeredAt: executedRecord?.triggeredAt,
        lastCompletedAt: executedRecord?.completedAt,
        lastStatus: executedRecord
          ? "stopped"
          : schedule.enabled
            ? "idle"
            : "disabled",
        lastError: executedRecord?.errorMessage,
      }

      this.stateById.set(schedule.scheduleId, initialState)

      if (!schedule.enabled) {
        continue
      }

      if (executedRecord) {
        continue
      }

      await this.register(schedule)
    }
  }

  async stop() {
    for (const job of this.jobs.values()) {
      if (job.timer) {
        clearTimeout(job.timer)
      }
    }
    this.jobs.clear()
  }

  getState(scheduleId) {
    return this.stateById.get(scheduleId)
  }

  getSnapshot() {
    return Array.from(this.stateById.values())
  }

  async register(schedule, currentDate = this.now()) {
    const nextTriggerDate = getNextTriggerDate(
      schedule.cronExpression,
      schedule.timezone,
      currentDate
    )
    const delay = Math.max(nextTriggerDate.getTime() - currentDate.getTime(), 0)
    const nextTriggerAt = formatDateTime(nextTriggerDate)

    const existing = this.jobs.get(schedule.scheduleId)
    if (existing?.timer) {
      clearTimeout(existing.timer)
    }

    const timer = setTimeout(async () => {
      await this.runSchedule(schedule, nextTriggerDate)
    }, delay)

    this.jobs.set(schedule.scheduleId, {
      schedule,
      timer,
    })

    this.stateById.set(schedule.scheduleId, {
      ...(this.stateById.get(schedule.scheduleId) || { scheduleId: schedule.scheduleId }),
      enabled: true,
      nextTriggerAt,
      lastStatus: "scheduled",
      lastError: undefined,
    })
  }

  async runSchedule(schedule, dueAt) {
    const triggeredAt = formatDateTime(dueAt)
    this.stateById.set(schedule.scheduleId, {
      ...(this.stateById.get(schedule.scheduleId) || { scheduleId: schedule.scheduleId }),
      enabled: true,
      lastTriggeredAt: triggeredAt,
      lastStatus: "running",
      lastError: undefined,
    })

    let record
    try {
      const result = await Promise.resolve(
        this.options.onTrigger({
          schedule,
          dueAt,
          skillFilePath: path.resolve(this.options.workspaceRoot, schedule.skillFile),
        })
      )

      record = {
        scheduleId: schedule.scheduleId,
        scheduleName: schedule.name,
        triggeredAt,
        completedAt: formatDateTime(this.now()),
        status: "completed",
        result,
      }

      this.stateById.set(schedule.scheduleId, {
        ...(this.stateById.get(schedule.scheduleId) || { scheduleId: schedule.scheduleId }),
        enabled: false,
        nextTriggerAt: undefined,
        lastTriggeredAt: record.triggeredAt,
        lastCompletedAt: record.completedAt,
        lastStatus: "stopped",
        lastError: undefined,
      })
    } catch (error) {
      record = {
        scheduleId: schedule.scheduleId,
        scheduleName: schedule.name,
        triggeredAt,
        completedAt: formatDateTime(this.now()),
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      }

      this.stateById.set(schedule.scheduleId, {
        ...(this.stateById.get(schedule.scheduleId) || { scheduleId: schedule.scheduleId }),
        enabled: false,
        nextTriggerAt: undefined,
        lastTriggeredAt: record.triggeredAt,
        lastCompletedAt: record.completedAt,
        lastStatus: "stopped",
        lastError: record.errorMessage,
      })
    }

    this.jobs.delete(schedule.scheduleId)
    await this.appendHistory(record)
  }

  async loadHistory() {
    return readJsonFile(this.historyFile, [])
  }

  async appendHistory(record) {
    const history = await this.loadHistory()
    history.push(record)
    await writeJsonFile(this.historyFile, history)
  }
}

async function loadScheduleDefinitions(filePath) {
  const parsed = await readJsonFile(filePath)
  const schedules = Array.isArray(parsed) ? parsed : parsed?.schedules

  if (!Array.isArray(schedules)) {
    throw new Error(`Invalid schedule config: ${filePath}`)
  }

  return schedules.map((schedule, index) => {
    assertScheduleDefinition(schedule, `${filePath}#${index}`)
    return schedule
  })
}

function getNextTriggerDate(cronExpression, timezone, currentDate) {
  const interval = CronExpressionParser.parse(cronExpression, {
    currentDate,
    tz: timezone,
  })
  return interval.next().toDate()
}

function assertScheduleDefinition(schedule, source) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
    throw new Error(`Invalid schedule definition: ${source}`)
  }

  const requiredStrings = ["scheduleId", "name", "cronExpression", "timezone", "skillFile"]
  for (const field of requiredStrings) {
    if (typeof schedule[field] !== "string" || schedule[field].length === 0) {
      throw new Error(`Invalid ${field} in ${source}`)
    }
  }

  if (typeof schedule.enabled !== "boolean") {
    throw new Error(`Invalid enabled in ${source}`)
  }
}

module.exports = {
  LocalJsonScheduleEngine,
  loadScheduleDefinitions,
  getNextTriggerDate,
}
