import test from "node:test"
import assert from "node:assert/strict"
import {
  ScheduleSkillCatalogService,
  ScheduleSkillExecutionService,
} from "../subprocess/service/scheduler/SchedulerService"
import { query3040TodaySkill } from "../subprocess/service/execution/skillScriptEngine"
import type {
  JsonRpcToolCallRequest,
  JsonRpcToolTransport,
  JsonRpcToolTransportFactory,
} from "../subprocess/service/execution/mcpToolClient"

class CountingTransport implements JsonRpcToolTransport {
  constructor(private readonly onSend: () => void) {}

  async send(_request: JsonRpcToolCallRequest): Promise<unknown> {
    this.onSend()
    return {
      result: {
        content: [{ type: "text", text: "{}" }],
      },
    }
  }

  close(): void {}
}

test("schedule skill runner creates a fresh transport for each run", async () => {
  const skillCatalogService = new ScheduleSkillCatalogService()
  skillCatalogService.register(query3040TodaySkill)

  let transportCreateCount = 0
  const sendCountsByTransport: number[] = []
  const transportFactory: JsonRpcToolTransportFactory = {
    create() {
      transportCreateCount += 1
      sendCountsByTransport.push(0)
      const transportIndex = sendCountsByTransport.length - 1
      return new CountingTransport(() => {
        sendCountsByTransport[transportIndex] += 1
      })
    },
  }

  const executionService = new ScheduleSkillExecutionService(
    skillCatalogService,
    transportFactory
  )

  await executionService.run("query_3040_today", new Date("2026-04-08T10:00:00+08:00"))
  await executionService.run("query_3040_today", new Date("2026-04-08T10:05:00+08:00"))

  assert.equal(transportCreateCount, 2)
  assert.deepEqual(sendCountsByTransport, [1, 1])
})


