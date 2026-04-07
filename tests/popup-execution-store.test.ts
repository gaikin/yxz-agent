import test from "node:test"
import assert from "node:assert/strict"
import { PopupExecutionStore } from "../frontend/popup/stores/popup-execution.store"
import type { PopupScheduleExecutionOverviewUpdatedEvent } from "../shared/protocol"

function overviewEvent(pendingCount: number): PopupScheduleExecutionOverviewUpdatedEvent {
  return {
    type: "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
    deviceId: "device-001",
    overview: {
      pendingCount,
      items:
        pendingCount === 0
          ? []
          : Array.from({ length: pendingCount }, (_, index) => ({
              executionId: `exec_${index + 1}`,
              scheduleId: "schedule_3040_daily",
              scheduleName: "3040每日查询",
              requestedAt: `2026-04-07T0${index}:00:00.000Z`,
              status: "pending",
            })),
      updatedAt: new Date().toISOString(),
    },
    sentAt: new Date().toISOString(),
  }
}

test("popup store enters pending mode when overview has items", () => {
  const store = new PopupExecutionStore()
  store.handleOverviewUpdated(overviewEvent(2))

  const state = store.getState()
  assert.equal(state.mode, "pending")
  assert.equal(state.overview?.pendingCount, 2)
  assert.equal(store.canConfirm(), true)
  assert.equal(store.canDismiss(), true)
})

test("popup store enters executing mode with current snapshot", () => {
  const store = new PopupExecutionStore()
  store.handleOverviewUpdated(overviewEvent(2))

  const items = store.beginExecutingCurrentSnapshot()
  assert.equal(items.length, 2)

  const state = store.getState()
  assert.equal(state.mode, "executing")
  assert.deepEqual(state.executingIds, ["exec_1", "exec_2"])
  assert.equal(store.canDismiss(), false)
})

test("popup store closes after executing state receives empty overview", () => {
  const store = new PopupExecutionStore()
  store.handleOverviewUpdated(overviewEvent(1))
  store.beginExecutingCurrentSnapshot()
  store.handleOverviewUpdated(overviewEvent(0))

  const state = store.getState()
  assert.equal(state.mode, "hidden")
  assert.equal(state.overview, undefined)
})

test("popup store reopens as pending after executing state receives new pending overview", () => {
  const store = new PopupExecutionStore()
  store.handleOverviewUpdated(overviewEvent(1))
  store.beginExecutingCurrentSnapshot()
  store.handleOverviewUpdated(overviewEvent(2))

  const state = store.getState()
  assert.equal(state.mode, "pending")
  assert.equal(state.overview?.pendingCount, 2)
  assert.deepEqual(state.executingIds, [])
})

