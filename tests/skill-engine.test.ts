import test from "node:test"
import assert from "node:assert/strict"
import { SkillEngine } from "../dcf-subprocess/skills/skill-engine"
import { DefaultToolExecutor } from "../dcf-subprocess/execution/tool-executor"
import { ToolHandlerRegistry } from "../dcf-subprocess/execution/tool-handler-registry"
import { query3040TodaySkill } from "../dcf-subprocess/skills/query_3040_today"
import { ToolExecutionError } from "../dcf-subprocess/execution/tool-execution-error"

test("skill engine returns the last tool result on success", async () => {
  const registry = new ToolHandlerRegistry()
  registry.register({
    tool: "openMenu",
    async execute() {
      return { tabId: "tab_001" }
    },
  })
  registry.register({
    tool: "executePageCommands",
    async execute(args) {
      assert.equal(args.tabId, "tab_001")
      return {
        result: {
          content: [{ type: "text", text: "{\"rows\":[]}" }],
        },
      }
    },
  })

  const engine = new SkillEngine(new DefaultToolExecutor(registry))
  const result = await engine.run(query3040TodaySkill)

  assert.deepEqual(result, {
    status: "completed",
    data: {
      result: {
        content: [{ type: "text", text: "{\"rows\":[]}" }],
      },
    },
  })
})

test("skill engine maps tool failures to failed result", async () => {
  const registry = new ToolHandlerRegistry()
  registry.register({
    tool: "openMenu",
    async execute() {
      throw new ToolExecutionError("MENU_OPEN_FAILED", "打开菜单失败")
    },
  })

  const engine = new SkillEngine(new DefaultToolExecutor(registry))
  const result = await engine.run(query3040TodaySkill)

  assert.deepEqual(result, {
    status: "failed",
    error: {
      code: "MENU_OPEN_FAILED",
      message: "打开菜单失败",
    },
  })
})

