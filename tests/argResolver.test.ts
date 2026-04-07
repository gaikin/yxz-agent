import test from "node:test"
import assert from "node:assert/strict"
import { resolveArgs } from "../dcf-subprocess/skills/argResolver"

test("resolveArgs keeps literals and resolves xxxFrom paths recursively", () => {
  const values = {
    tabInfo: {
      tabId: "tab_001",
    },
    queryButton: {
      componentId: "btn_query_1",
    },
  }

  const resolved = resolveArgs(
    {
      tabIdFrom: "tabInfo.tabId",
      commands: [
        {
          componentIdFrom: "queryButton.componentId",
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

test("resolveArgs throws when path cannot be resolved", () => {
  assert.throws(() =>
    resolveArgs(
      {
        tabIdFrom: "missing.tabId",
      },
      {}
    )
  )
})

