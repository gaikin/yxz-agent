import test from "node:test"
import assert from "node:assert/strict"
import {
  resolveTemplateString,
  resolveTemplateValue,
} from "../subprocess/service/execution/skillScriptEngine"

test("resolveTemplateValue keeps literals and resolves templates recursively", () => {
  const values = {
    tabInfo: {
      tabId: "tab_001",
    },
    queryButton: {
      componentId: "btn_query_1",
    },
  }

  const resolved = resolveTemplateValue(
    {
      tabId: "{{tabInfo.tabId}}",
      commands: [
        {
          componentId: "{{queryButton.componentId}}",
          command: "click",
        },
      ],
    },
    values
  )

  assert.deepEqual(resolved, {
    tabId: "tab_001",
    commands: [
      {
        componentId: "btn_query_1",
        command: "click",
      },
    ],
  })
})

test("resolveTemplateString keeps raw type when string only contains one variable", () => {
  const resolved = resolveTemplateString("{{result}}", {
    result: {
      ok: true,
    },
  })

  assert.deepEqual(resolved, {
    ok: true,
  })
})

test("resolveTemplateValue throws when path cannot be resolved", () => {
  assert.throws(() =>
    resolveTemplateValue(
      {
        tabId: "{{missing.tabId}}",
      },
      {}
    ),
    /变量不存在/
  )
})



