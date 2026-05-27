import test from "node:test"
import assert from "node:assert/strict"
import {
  DirectMcpSkillEngine,
  query3040TodaySkill,
} from "../subprocess/service/SkillService"

test("direct mcp skill engine iterates steps without tool registry", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const engine = new DirectMcpSkillEngine({
    async call(name, args) {
      calls.push({ name, args })
      if (name === "openMenu") {
        return { tabId: "tab_001" }
      }
      return { ok: true }
    },
  })

  const result = await engine.run(query3040TodaySkill)

  assert.deepEqual(calls, [
    {
      name: "openMenu",
      args: {
        menuShortCode: "3040",
      },
    },
    {
      name: "executePageCommands",
      args: {
        tabId: "tab_001",
        commands: [
          {
            componentId: "btn_query_1",
            command: "click",
          },
        ],
      },
    },
  ])
  assert.deepEqual(result, {
    status: "completed",
    data: { ok: true },
    steps: [
      {
        stepId: "open_menu",
        action: "openMenu",
        params: {
          menuShortCode: "3040",
        },
        status: "completed",
        result: { tabId: "tab_001" },
      },
      {
        stepId: "execute_query",
        action: "executePageCommands",
        params: {
          tabId: "tab_001",
          commands: [
            {
              componentId: "btn_query_1",
              command: "click",
            },
          ],
        },
        status: "completed",
        result: { ok: true },
      },
    ],
  })
})

test("direct mcp skill engine maps call failures to failed result", async () => {
  const engine = new DirectMcpSkillEngine({
    async call() {
      throw new Error("network down")
    },
  })

  const result = await engine.run(query3040TodaySkill)

  assert.deepEqual(result, {
    status: "failed",
    error: {
      code: "RUNTIME_EXCEPTION",
      message: "执行过程中发生未预期异常",
    },
    steps: [
      {
        stepId: "open_menu",
        action: "openMenu",
        params: {
          menuShortCode: "3040",
        },
        status: "failed",
        errorMessage: "执行过程中发生未预期异常",
      },
    ],
  })
})



