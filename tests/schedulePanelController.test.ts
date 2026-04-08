import test from "node:test"
import assert from "node:assert/strict"
import { ScheduleStore } from "../webapp/src/assistant/scheduleStore"
import { SchedulePanelController } from "../webapp/src/assistant/schedulePanelController"
import type { AssistantWindowChannelClient } from "../webapp/src/assistant/assistantWindowChannelClient"

class MemoryAssistantWindowChannelClient {
  authorizeCalls = 0
  requestScheduleStateCalls = 0
  enabledScheduleIds: string[] = []
  disabledScheduleIds: string[] = []

  async authorizeAutomation(): Promise<void> {
    this.authorizeCalls += 1
  }

  async requestScheduleState(): Promise<void> {
    this.requestScheduleStateCalls += 1
  }

  async enableSchedule(scheduleId: string): Promise<void> {
    this.enabledScheduleIds.push(scheduleId)
  }

  async disableSchedule(scheduleId: string): Promise<void> {
    this.disabledScheduleIds.push(scheduleId)
  }
}

test("controller shows automation authorization only when runtime is ready and not authorized", () => {
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

  const controller = new SchedulePanelController(
    store,
    new MemoryAssistantWindowChannelClient() as unknown as AssistantWindowChannelClient
  )

  assert.equal(controller.shouldShowAutomationAuthorization(), true)
})

test("opening schedule panel requests schedule state", async () => {
  const store = new ScheduleStore()
  const channelClient = new MemoryAssistantWindowChannelClient()
  const controller = new SchedulePanelController(
    store,
    channelClient as unknown as AssistantWindowChannelClient
  )

  await controller.openSchedulePanel()

  assert.equal(store.getState().panelVisible, true)
  assert.equal(channelClient.requestScheduleStateCalls, 1)
})

test("enable and disable use current schedule from store", async () => {
  const store = new ScheduleStore()
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

  const channelClient = new MemoryAssistantWindowChannelClient()
  const controller = new SchedulePanelController(
    store,
    channelClient as unknown as AssistantWindowChannelClient
  )

  await controller.enableCurrentSchedule()
  await controller.disableCurrentSchedule()

  assert.deepEqual(channelClient.enabledScheduleIds, ["schedule_3040_daily"])
  assert.deepEqual(channelClient.disabledScheduleIds, ["schedule_3040_daily"])
})

