import test from "node:test"
import assert from "node:assert/strict"
import {
  createAssistantWindowViewModel,
  ScheduleStore,
} from "../webapp/src/pages/Assistant/runtime"

test("view model shows automation authorization only when runtime is ready and not authorized", () => {
  const store = new ScheduleStore()
  store.handleBootstrapState({
    type: "BOOTSTRAP_STATE",
    deviceId: "device-001",
    automationAuthorization: { authorized: false },
    dcfRuntime: {
      dcfStatus: "online",
      scheduleSubsystemReady: true,
    },
    sentAt: new Date().toISOString(),
  })

  assert.equal(
    createAssistantWindowViewModel(store.getState()).shouldShowAutomationAuthorization,
    true
  )
})

test("opening and closing schedule panel updates store state", () => {
  const store = new ScheduleStore()
  store.openPanel()

  assert.equal(store.getState().panelVisible, true)
  store.closePanel()
  assert.equal(store.getState().panelVisible, false)
})

test("view model can operate schedule only after authorization", () => {
  const store = new ScheduleStore()
  store.handleBootstrapState({
    type: "BOOTSTRAP_STATE",
    deviceId: "device-001",
    automationAuthorization: { authorized: false },
    dcfRuntime: {
      dcfStatus: "online",
      scheduleSubsystemReady: true,
    },
    sentAt: new Date().toISOString(),
  })
  store.handleScheduleStateSnapshot({
    type: "SCHEDULE_STATE_SNAPSHOT",
    deviceId: "device-001",
    schedules: [
      {
        scheduleId: "schedule_3040_daily",
        name: "3040每日查询",
        enabled: false,
      },
    ],
    sentAt: new Date().toISOString(),
  })

  assert.equal(createAssistantWindowViewModel(store.getState()).canOperateSchedule, false)

  store.handleAutomationAuthorized({
    type: "AUTOMATION_AUTHORIZED",
    deviceId: "device-001",
    authorizedAt: new Date().toISOString(),
    sentAt: new Date().toISOString(),
  })

  assert.equal(createAssistantWindowViewModel(store.getState()).canOperateSchedule, true)
})

