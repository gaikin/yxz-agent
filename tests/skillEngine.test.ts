import test from "node:test"
import assert from "node:assert/strict"
import {
  SkillScriptEngine,
  SkillScriptEngineError,
  query3040TodaySkill,
  type SkillScriptDefinition,
} from "../subprocess/service/execution/skillScriptEngine"

test("skill script engine executes latest DSL and resolves output templates", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const engine = new SkillScriptEngine({
    mcpToolClient: {
      async call(name, args) {
        calls.push({ name, args })
        if (name === "openMenu") {
          return { tabId: "tab_001" }
        }
        return { ok: true }
      },
    },
    now: createTickingClock(),
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

  assert.equal(result.status, "completed")
  if (result.status !== "completed") {
    return
  }

  assert.deepEqual(result.data, { ok: true })
  assert.deepEqual(
    result.steps.map((step) => ({
      stepId: step.stepId,
      stepPath: step.stepPath,
      status: step.status,
      outputName: step.outputName,
    })),
    [
      {
        stepId: "openMenu",
        stepPath: "openMenu",
        status: "completed",
        outputName: "tabInfo",
      },
      {
        stepId: "clickQuery",
        stepPath: "clickQuery",
        status: "completed",
        outputName: "queryResult",
      },
    ]
  )
})

test("skill script engine supports group, foreach and evaluate builtins", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const skill: SkillScriptDefinition = {
    skillId: "demoLoopSkill",
    skillName: "循环测试",
    menuCode: "3040",
    skillVersion: "1.0.0",
    steps: [
      {
        stepId: "calcItems",
        output: "items",
        executor: {
          type: "builtin",
          toolName: "evaluate",
        },
        params: {
          expression: {
            var: "$_EVENT.items",
          },
        },
      },
      {
        stepId: "submitGroup",
        type: "group",
        when: {
          "==": [{ var: "$_EVENT.enabled" }, true],
        },
        steps: [
          {
            stepId: "processItems",
            type: "foreach",
            foreach: {
              items: {
                var: "items",
              },
              itemName: "item",
              maxIterations: 10,
            },
            steps: [
              {
                stepId: "clickItem",
                executor: {
                  type: "mcp",
                  mcpName: "kaiyang",
                  toolName: "executePageCommands",
                },
                params: {
                  tabId: "{{$_EVENT.tabId}}",
                  commands: [
                    {
                      componentId: "{{item.componentId}}",
                      command: "click",
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  }

  const engine = new SkillScriptEngine({
    mcpToolClient: {
      async call(name, args) {
        calls.push({ name, args })
        return { ok: true }
      },
    },
    now: createTickingClock(),
  })

  const result = await engine.run(skill, {
    event: {
      enabled: true,
      tabId: "tab_002",
      items: [
        { componentId: "btn_1" },
        { componentId: "btn_2" },
      ],
    },
  })

  assert.equal(result.status, "completed")
  assert.deepEqual(calls, [
    {
      name: "executePageCommands",
      args: {
        tabId: "tab_002",
        commands: [
          {
            componentId: "btn_1",
            command: "click",
          },
        ],
      },
    },
    {
      name: "executePageCommands",
      args: {
        tabId: "tab_002",
        commands: [
          {
            componentId: "btn_2",
            command: "click",
          },
        ],
      },
    },
  ])

  if (result.status !== "completed") {
    return
  }

  assert.deepEqual(
    result.steps.map((step) => step.stepPath),
    [
      "calcItems",
      "submitGroup.processItems[0].clickItem",
      "submitGroup.processItems[1].clickItem",
      "submitGroup.processItems",
      "submitGroup",
    ]
  )
})

test("skill script engine resolves nested object params before mcp tool call", async () => {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const engine = new SkillScriptEngine({
    mcpToolClient: {
      async call(name, args) {
        calls.push({ name, args })
        return { ok: true }
      },
    },
    now: createTickingClock(),
  })

  const result = await engine.run(
    {
      skillId: "nestedToolParamsSkill",
      skillName: "嵌套参数解析测试",
      menuCode: "3040",
      skillVersion: "1.0.0",
      steps: [
        {
          stepId: "callTool",
          executor: {
            type: "mcp",
            mcpName: "kaiyang",
            toolName: "executeComplexAction",
          },
          params: {
            tabId: "{{$_EVENT.tabId}}",
            payload: {
              filters: {
                owner: "{{$_EVENT.user.name}}",
                tags: ["{{$_EVENT.tags.0}}", "{{$_EVENT.tags.1}}"],
              },
              commands: [
                {
                  componentId: "{{$_EVENT.components.submit}}",
                  meta: {
                    reason: "owner={{$_EVENT.user.name}}",
                  },
                },
              ],
            },
          },
        },
      ],
    },
    {
      event: {
        tabId: "tab_nested_001",
        user: {
          name: "alice",
        },
        tags: ["finance", "today"],
        components: {
          submit: "btn_submit",
        },
      },
    }
  )

  assert.equal(result.status, "completed")
  assert.deepEqual(calls, [
    {
      name: "executeComplexAction",
      args: {
        tabId: "tab_nested_001",
        payload: {
          filters: {
            owner: "alice",
            tags: ["finance", "today"],
          },
          commands: [
            {
              componentId: "btn_submit",
              meta: {
                reason: "owner=alice",
              },
            },
          ],
        },
      },
    },
  ])
})

test("skill script engine supports script builtin body mode with injected bindings", async () => {
  const engine = new SkillScriptEngine({
    now: createTickingClock(),
  })

  const result = await engine.run(
    {
      skillId: "scriptBuiltinSkill",
      skillName: "脚本内置工具测试",
      menuCode: "3040",
      skillVersion: "1.0.0",
      steps: [
        {
          stepId: "transformValue",
          output: "transformed",
          executor: {
            type: "builtin",
            toolName: "script",
          },
          params: {
            script:
              "return { summary: `${name}-${event.menuCode}`, doubled: count * 2, rendered: resolveTemplateValue('menu={{$_EVENT.menuCode}}') }",
            name: "{{$_EVENT.userName}}",
            count: 3,
          },
        },
      ],
    },
    {
      event: {
        menuCode: "3040",
        userName: "alice",
      },
    }
  )

  assert.equal(result.status, "completed")
  if (result.status !== "completed") {
    return
  }

  assert.deepEqual(result.data, {
    summary: "alice-3040",
    doubled: 6,
    rendered: "menu=3040",
  })
})

test("skill script engine injects previous output variables into script builtin scope", async () => {
  const engine = new SkillScriptEngine({
    now: createTickingClock(),
  })

  const result = await engine.run(
    {
      skillId: "scriptBuiltinOutputScopeSkill",
      skillName: "脚本输出作用域测试",
      menuCode: "3040",
      skillVersion: "1.0.0",
      steps: [
        {
          stepId: "prepareResult",
          output: "queryResult",
          executor: {
            type: "builtin",
            toolName: "script",
          },
          params: {
            script:
              "return { amount: 12, owner: event.userName, tags: ['a', 'b'] }",
          },
        },
        {
          stepId: "serializeResult",
          output: "serialized",
          executor: {
            type: "builtin",
            toolName: "script",
          },
          params: {
            script:
              "return `${queryResult.owner}:${queryResult.amount}:${queryResult.tags.join(',')}`",
          },
        },
      ],
    },
    {
      event: {
        menuCode: "3040",
        userName: "alice",
      },
    }
  )

  assert.equal(result.status, "completed")
  if (result.status !== "completed") {
    return
  }

  assert.equal(result.data, "alice:12:a,b")
})

test("skill script engine fails fast when output step returns undefined", async () => {
  const engine = new SkillScriptEngine({
    mcpToolClient: {
      async call() {
        return undefined
      },
    },
    now: createTickingClock(),
  })

  const result = await engine.run({
    skillId: "undefinedOutputSkill",
    skillName: "未定义输出测试",
    menuCode: "3040",
    skillVersion: "1.0.0",
    steps: [
      {
        stepId: "readSomething",
        output: "queryResult",
        executor: {
          type: "mcp",
          mcpName: "kaiyang",
          toolName: "readSomething",
        },
        params: {
          tabId: "tab_001",
        },
      },
    ],
  })

  assert.deepEqual(result, {
    status: "failed",
    error: {
      code: "STEP_OUTPUT_UNDEFINED",
      message:
        "步骤 readSomething 声明了 output=queryResult，但执行结果为 undefined",
    },
    steps: [
      {
        stepId: "readSomething",
        stepPath: "readSomething",
        status: "failed",
        executor: {
          type: "mcp",
          mcpName: "kaiyang",
          toolName: "readSomething",
        },
        beforeDelayMs: 0,
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        durationMs: 1000,
        outputName: "queryResult",
        result: undefined,
        error: {
          code: "STEP_OUTPUT_UNDEFINED",
          message:
            "步骤 readSomething 声明了 output=queryResult，但执行结果为 undefined",
        },
        reason: undefined,
      },
    ],
  })
})

test("skill script engine maps missing variables to VARIABLE_RESOLVE_FAILED", async () => {
  const engine = new SkillScriptEngine({
    mcpToolClient: {
      async call() {
        return { ok: true }
      },
    },
    now: createTickingClock(),
  })

  const result = await engine.run({
    skillId: "missingVarSkill",
    skillName: "缺失变量测试",
    menuCode: "3040",
    skillVersion: "1.0.0",
    steps: [
      {
        stepId: "clickQuery",
        executor: {
          type: "mcp",
          mcpName: "kaiyang",
          toolName: "executePageCommands",
        },
        params: {
          tabId: "{{missing.tabId}}",
        },
      },
    ],
  })

  assert.deepEqual(result, {
    status: "failed",
    error: {
      code: "VARIABLE_RESOLVE_FAILED",
      message: "变量不存在: missing.tabId",
    },
    steps: [
      {
        stepId: "clickQuery",
        stepPath: "clickQuery",
        status: "failed",
        executor: {
          type: "mcp",
          mcpName: "kaiyang",
          toolName: "executePageCommands",
        },
        beforeDelayMs: 0,
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: "2026-01-01T00:00:01.000Z",
        durationMs: 1000,
        outputName: undefined,
        result: undefined,
        error: {
          code: "VARIABLE_RESOLVE_FAILED",
          message: "变量不存在: missing.tabId",
        },
        reason: undefined,
      },
    ],
  })
})

test("skill script engine validates definitions before execution", async () => {
  const engine = new SkillScriptEngine({
    now: createTickingClock(),
  })

  await assert.rejects(
    async () =>
      engine.run({
        skillId: "brokenSkill",
        skillName: "坏脚本",
        menuCode: "3040",
        skillVersion: "1.0.0",
        steps: [
          {
            stepId: "bad_step",
            executor: {
              type: "builtin",
              toolName: "wait",
            },
            params: {
              durationMs: 1,
            },
          },
        ],
      }),
    (error: unknown) =>
      error instanceof Error && error.message.includes("Invalid stepId")
  )
})

test("skill script engine exposes abort as USER_CANCELED", async () => {
  const controller = new AbortController()
  const engine = new SkillScriptEngine({
    now: createTickingClock(),
  })

  controller.abort()

  const result = await engine.run(
    {
      skillId: "cancelSkill",
      skillName: "中止测试",
      menuCode: "3040",
      skillVersion: "1.0.0",
      steps: [
        {
          stepId: "waitStep",
          beforeDelayMs: 10,
          executor: {
            type: "builtin",
            toolName: "wait",
          },
          params: {
            durationMs: 1,
          },
        },
      ],
    },
    {
      signal: controller.signal,
    }
  )

  assert.equal(result.status, "failed")
  if (result.status !== "failed") {
    return
  }

  assert.equal(result.error.code, "USER_CANCELED")
})

function createTickingClock(): () => Date {
  let tick = 0
  return () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++))
}

test("skill script engine normalizes non-engine errors", () => {
  const error = new SkillScriptEngineError("RUNTIME_EXCEPTION", "boom")
  assert.equal(error.code, "RUNTIME_EXCEPTION")
  assert.equal(error.message, "boom")
})
