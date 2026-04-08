import test from "node:test"
import assert from "node:assert/strict"
import { ScheduleSkillRunner } from "../dcf/scheduler/scheduleSkillRunner"
import { ScheduleSkillRegistry } from "../dcf/scheduler/scheduleSkillRegistry"
import { query3040TodaySkill } from "../dcf/skills/query3040Today"
import type {
  JsonRpcToolCallRequest,
  JsonRpcToolTransport,
  JsonRpcToolTransportFactory,
} from "../dcf/execution/mcpToolClient"

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
}

test("schedule skill runner creates a fresh transport for each run", async () => {
  const registry = new ScheduleSkillRegistry()
  registry.register(query3040TodaySkill)

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

  const runner = new ScheduleSkillRunner(registry, transportFactory)

  await runner.run("query_3040_today", new Date("2026-04-08T10:00:00+08:00"))
  await runner.run("query_3040_today", new Date("2026-04-08T10:05:00+08:00"))

  assert.equal(transportCreateCount, 2)
  assert.deepEqual(sendCountsByTransport, [1, 1])
})

