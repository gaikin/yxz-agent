# 事件触发任务脚本制作规范

更新时间：2026-06-03

相关文档：

- 术语规范：[terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md)
- 脚本执行方案：[event-task-script-execution-design.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-execution-design.md)

## 1. 文档定位

本文面向事件触发任务脚本的配置人员，说明脚本结构、步骤写法、工具参数、变量引用、条件循环和发布前检查项。

脚本用于描述技能的结构化执行步骤。脚本不是可执行代码，不支持任意 JS 表达式。脚本发布前必须通过服务端或配置平台静态校验。

## 2. 基本结构

```json
{
  "skillId": "pensionMenuOpen",
  "skillName": "养老金任务",
  "menuCode": "3040",
  "skillVersion": "1.0.0",
  "steps": [
    {
      "stepId": "clickQuery",
      "executor": {
        "type": "mcp",
        "mcpName": "kaiyang",
        "toolName": "click"
      },
      "params": {
        "componentId": "pension.queryButton"
      }
    }
  ]
}
```

字段说明：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `skillId` | 是 | 技能唯一标识，建议使用小驼峰命名 |
| `skillName` | 是 | 技能名称，用于确认和任务展示 |
| `menuCode` | 是 | 开阳侧菜单编码或业务场景编码 |
| `skillVersion` | 是 | 技能版本，用于日志、排查和上报 |
| `steps` | 是 | 脚本步骤列表，不允许为空 |

## 3. 命名规则

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| `stepId` | 小驼峰，同一脚本内唯一 | `readResult` |
| `output` | 小驼峰，同一脚本内唯一 | `result` |
| `foreach.itemName` | 小驼峰 | `item` |

`output` 变量名不能以 `$` 或 `_` 开头，不能使用保留字，例如 `event`、`steps`、`item`、`index`。

## 4. 工具步骤

工具步骤用于调用 MCP 工具或内置工具。

```json
{
  "stepId": "inputName",
  "beforeDelayMs": 300,
  "executor": {
    "type": "mcp",
    "mcpName": "kaiyang",
    "toolName": "input"
  },
  "params": {
    "componentId": "pension.nameInput",
    "value": "{{$_EVENT.userName}}"
  }
}
```

字段说明：

| 字段 | 是否必填 | 说明 |
| --- | --- | --- |
| `stepId` | 是 | 任务步骤标识 |
| `beforeDelayMs` | 否 | 当前步骤执行前延迟，未配置按 `0` 处理 |
| `output` | 否 | 保存工具结果的顶层变量名 |
| `executor` | 是 | 执行器声明 |
| `params` | 是 | 工具参数 |
| `when` | 否 | 条件表达式，使用 JSON Logic 对象 |

执行器类型：

| `executor.type` | 说明 |
| --- | --- |
| `mcp` | 调用指定 MCP 下的指定工具 |
| `builtin` | 调用内置工具 |

## 5. 开阳 MCP 工具表

配置平台可以把开阳 MCP 支持的工具聚合成统一表格展示，帮助配置人员按用途选择工具。脚本下发内容仍必须保存具体的 `mcpName`、`toolName` 和 `params`。

| `toolName` | 用途 | 必填参数 | 可选参数 | 输出 |
| --- | --- | --- | --- | --- |
| `click` | 点击指定组件 | `componentId` | 无 | 通常无 |
| `input` | 向指定组件输入内容 | `componentId`、`value` | 无 | 通常无 |
| `read` | 读取指定组件数据 | `componentId` | 无 | 声明 `output` 后可保存为顶层变量 |
| `select` | 选择指定组件选项 | `componentId`、`value` | 无 | 通常无 |

参数说明：

| 参数 | 说明 |
| --- | --- |
| `componentId` | 开阳 MCP 识别的组件标识，不使用 CSS、XPath 或 DOM selector |
| `value` | 输入或选择的目标值，可使用模板变量 |

开阳 MCP 工具列表和参数以发布时的 MCP 工具 schema 为准；配置平台和服务端必须基于实际 schema 校验脚本。

## 6. 内置工具

内置工具用于补充非 MCP 能力。

`wait` 示例：

```json
{
  "stepId": "waitPageReady",
  "executor": {
    "type": "builtin",
    "toolName": "wait"
  },
  "params": {
    "durationMs": 1000
  }
}
```

`request` 示例：

```json
{
  "stepId": "syncResult",
  "executor": {
    "type": "builtin",
    "toolName": "request"
  },
  "params": {
    "method": "POST",
    "url": "https://example.com/api/pension/result",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "menuCode": "{{$_EVENT.menuCode}}",
      "result": "{{result}}"
    }
  }
}
```

`request` 规则：

- 只支持 `GET` 和 `POST`。
- `url` 使用完整地址。
- `body` 只支持 JSON。
- 不支持 `form-data`。
- 不支持 `x-www-form-urlencoded`。

## 7. 执行前延迟

`beforeDelayMs` 用于在当前步骤执行前固定等待。

规则：

- 可选，未配置按 `0` 处理。
- 必须是大于等于 `0` 的整数。
- 暂不设置最大值限制。
- 只影响当前步骤，不传给底层工具。
- 用户在等待期间中止任务时，当前步骤以 `USER_CANCELED` 失败，且不再调用执行器。

优先使用 `beforeDelayMs` 处理单个步骤前的最小等待；需要单独展示等待步骤时，可以使用内置 `wait` 工具。

## 8. 变量引用

脚本变量支持两种引用位置：

- `params` 中的字符串模板，使用 `{{...}}`。
- JSON Logic 表达式中的 `{ "var": "..." }`。

变量来源：

| 来源 | 写法 | 说明 |
| --- | --- | --- |
| 事件上下文 | `{{$_EVENT.menuCode}}` | 当前唯一支持的系统变量 |
| 前置输出 | `{{result.amount}}` | 前置步骤显式声明 `output` 后可引用 |
| 循环当前项 | `{{item.name}}` | 循环内部使用 |

输出保存示例：

```json
{
  "stepId": "readResult",
  "output": "result",
  "executor": {
    "type": "mcp",
    "mcpName": "kaiyang",
    "toolName": "read"
  },
  "params": {
    "componentId": "pension.resultPanel"
  }
}
```

输出规则：

- 工具结果默认不进入变量上下文。
- 只有声明 `output` 后，工具结果才保存为顶层变量。
- 未声明 `output` 的步骤不能被后续引用。
- `output` 保存值可以是 `null`。
- 缺失变量会导致当前步骤失败，错误码为 `VARIABLE_RESOLVE_FAILED`。
- 当字符串只包含一个变量时，保留变量原始类型。
- 字符串拼接场景按字符串渲染。

## 9. 条件

`when` 使用 JSON Logic 对象，求值结果必须是 boolean。

```json
{
  "stepId": "submitFlow",
  "type": "group",
  "when": {
    "and": [
      { ">": [{ "var": "result.amount" }, 0] },
      { "==": [{ "var": "$_EVENT.menuCode" }, "3040"] }
    ]
  },
  "steps": []
}
```

规则：

- `when=false` 时当前步骤或分组记录为 `skipped`，不算失败。
- `when` 求值异常时当前步骤失败。
- 不支持 JS 表达式。
- 不支持字符串表达式。
- 不支持异步计算、接口调用或副作用。
- 不支持 `else`，需要分支时使用两个互斥分组。

## 10. 循环

`foreach` 用于遍历数组并串行执行内部步骤。

```json
{
  "stepId": "processItems",
  "type": "foreach",
  "foreach": {
    "items": { "var": "list.items" },
    "itemName": "item",
    "maxIterations": 50
  },
  "steps": [
    {
      "stepId": "inputName",
      "executor": {
        "type": "mcp",
        "mcpName": "kaiyang",
        "toolName": "input"
      },
      "params": {
        "componentId": "pension.nameInput",
        "value": "{{item.name}}"
      }
    }
  ]
}
```

规则：

- `foreach.items` 使用 JSON Logic 对象。
- `foreach.items` 求值结果必须是数组。
- `foreach.maxIterations` 必填。
- 内部步骤按数组顺序逐项串行执行。
- 任一内部步骤失败，默认停止当前循环和后续外部步骤。
- 循环内通过 `itemName` 暴露当前项，默认建议使用 `item`。

默认规模限制：

| 项 | 默认限制 |
| --- | --- |
| `foreach.maxIterations` 最大值 | `50` |
| 控制流嵌套层级最大值 | `3` |
| 展开后最大步骤数 | `200` |

## 11. 完整示例

```json
{
  "skillId": "pensionMenuOpen",
  "skillName": "养老金任务",
  "menuCode": "3040",
  "skillVersion": "1.0.0",
  "steps": [
    {
      "stepId": "clickQuery",
      "beforeDelayMs": 300,
      "executor": {
        "type": "mcp",
        "mcpName": "kaiyang",
        "toolName": "click"
      },
      "params": {
        "componentId": "pension.queryButton"
      }
    },
    {
      "stepId": "readResult",
      "output": "result",
      "executor": {
        "type": "mcp",
        "mcpName": "kaiyang",
        "toolName": "read"
      },
      "params": {
        "componentId": "pension.resultPanel"
      }
    },
    {
      "stepId": "submitFlow",
      "type": "group",
      "when": {
        "and": [
          { ">": [{ "var": "result.amount" }, 0] },
          { "==": [{ "var": "$_EVENT.menuCode" }, "3040"] }
        ]
      },
      "steps": [
        {
          "stepId": "clickSubmit",
          "executor": {
            "type": "mcp",
            "mcpName": "kaiyang",
            "toolName": "click"
          },
          "params": {
            "componentId": "pension.submitButton"
          }
        }
      ]
    },
    {
      "stepId": "syncResult",
      "executor": {
        "type": "builtin",
        "toolName": "request"
      },
      "params": {
        "method": "POST",
        "url": "https://example.com/api/pension/result",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "menuCode": "{{$_EVENT.menuCode}}",
          "result": "{{result}}"
        }
      }
    }
  ]
}
```

## 12. 发布前检查

- `skillId`、`skillName`、`menuCode`、`skillVersion` 是否完整。
- `steps` 是否非空。
- 每个 `stepId` 是否唯一且使用小驼峰命名。
- 每个工具步骤是否声明了 `executor` 和 `params`。
- MCP 步骤是否选择了正确的 `mcpName` 和 `toolName`。
- `params` 是否满足工具 schema。
- `beforeDelayMs` 是否为大于等于 `0` 的整数。
- 需要后续引用的步骤是否声明了 `output`。
- `output` 变量名是否唯一且符合命名规则。
- 变量引用是否只指向 `$_EVENT`、前置输出变量或循环当前项。
- `when` 是否是 JSON Logic 对象且结果为 boolean。
- `foreach.items` 是否是 JSON Logic 对象且结果为数组。
- `foreach.maxIterations` 是否配置且未超过上限。
- 控制流嵌套层级和展开后步骤数是否未超过上限。

## 13. 不建议写法

不要在脚本中表达复杂业务逻辑或任意代码：

```text
result.amount > 0 && $_EVENT.menuCode == "3040"
如果按钮存在则点击，否则跳过
失败后重试 3 次
同时执行多个步骤
调用接口后再动态生成脚本
```

复杂业务规则应放到服务端或专门工具中，脚本只根据返回结果做受控编排。
