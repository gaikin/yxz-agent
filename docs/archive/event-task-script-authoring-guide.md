# 事件触发任务 Skill 制作教程

## 1. 文档定位

本文档面向事件触发任务 Skill 的配置人员，说明 Skill 结构、字段规范、工具写法、变量用法和发布前检查项。

Skill 用于描述一次任务的自动化执行步骤。它不是可执行代码，而是一份结构化步骤配置。

子进程收到事件后，会向服务端实时解析 Skill；服务端返回 Skill 后，子进程在任务执行窗口中按顺序执行每个步骤。

Skill 描述一次任务的工具调用步骤。开发态需要明确选择执行器、MCP 和具体工具；运行态按照 Skill 中指定的工具直接执行，不再做业务 action 到底层 tool 的映射。

## 2. 基本规范

Skill 必须由服务端配置校验通过后才能发布。子进程运行时不再做完整 schema 校验。

必填字段：

```json
{
  "skillId": "pension-menu-open",
  "skillName": "养老金任务",
  "menuCode": "开阳侧标准菜单编码",
  "skillVersion": "1.0.0",
  "steps": []
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `skillId` | Skill 唯一标识 |
| `skillName` | 任务执行窗口展示名称，必填 |
| `menuCode` | 菜单编码，当前养老金场景使用开阳标准编码 |
| `skillVersion` | Skill 版本，用于日志和上报 |
| `steps` | 执行步骤，不允许为空 |

## 3. 执行规则

Skill 按 `steps` 顺序串行执行。

规则如下：

- 每个 step 可配置 `beforeDelayMs`，用于在执行该 step 前固定等待。
- 每个 step 执行完成后都会实时上报 `step.finished`。
- 任一步失败，立即停止后续步骤。
- 不支持重试。
- 不支持条件分支。
- 不支持并发步骤。
- 用户可以在任务执行窗口中止当前任务。
- 中止会按失败上报，错误码为 `USER_CANCELED`。

## 4. 执行器模型

每个 step 必须声明 `executor` 和 `params`。

```json
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
}
```

执行器类型：

| executor.type | 说明 |
|---|---|
| `mcp` | 调用指定 MCP 下的指定工具 |
| `builtin` | 调用子进程内置工具 |

开发态规范：

- 配置平台应提供 MCP 列表和工具列表。
- 用户选择 `mcpName` 和 `toolName` 后，配置平台根据工具 schema 展示参数表单。
- 服务端发布前校验工具是否存在、参数是否满足工具 schema。
- 运行态只根据 `executor.type` 分发到 MCP 执行通道或内置工具执行通道。

## 5. MCP 工具规范

当前自动化工具优先使用开阳 MCP。

配置平台可以将开阳 MCP 支持的工具聚合为统一表格展示，便于配置人员按操作目的选择工具。Skill 下发内容仍需保存具体的 `mcpName`、`toolName` 和 `params`，运行态不依赖展示聚合信息。

开阳 MCP 当前支持的工具：

| 工具 | 用途 | 必填参数 | 可选参数 | 输出 |
|---|---|---|---|---|
| `click` | 点击指定组件 | `componentId` | 无 | 无 |
| `input` | 向指定组件输入内容 | `componentId`、`value` | 无 | 无 |
| `read` | 读取指定组件数据 | `componentId` | 无 | 声明 `output` 变量名后可保存为顶层变量 |
| `select` | 选择指定组件的选项 | `componentId`、`value` | 无 | 无 |

参数说明：

| 参数 | 说明 |
|---|---|
| `componentId` | 开阳 MCP 识别的组件标识，不使用 CSS、XPath 或 DOM selector |
| `value` | 写入或选择的目标值，可使用模板变量 |

MCP 工具 step 结构：

```json
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
```

字段说明：

| 字段 | 说明 |
|---|---|
| `executor.type` | 固定为 `mcp` |
| `executor.mcpName` | MCP 名称，当前为 `kaiyang` |
| `executor.toolName` | MCP 工具名，由开发态选择 |
| `params` | 工具参数，按 MCP tool schema 配置 |

开阳 MCP 自动化工具使用 `componentId` 定位组件。`componentId` 由开阳 MCP 识别，Skill 侧不使用 CSS、XPath 或 DOM selector。

## 6. 执行前延迟

`beforeDelayMs` 用于在当前 step 执行前固定等待，适合给页面元素加载、弹窗渲染、列表刷新留出最小缓冲时间。

```json
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
}
```

规则如下：

- `beforeDelayMs` 可选，未配置时按 `0` 处理。
- `beforeDelayMs` 必须是大于等于 `0` 的整数。
- `beforeDelayMs` 只影响当前 step 执行前等待，不改变 `params`，也不传给底层工具。
- `beforeDelayMs` 等待完成后才调用当前 step 的 `executor`。
- 用户在等待期间中止任务时，等待应立即取消，当前 step 以 `USER_CANCELED` 失败，不再调用当前 step 的 `executor`。
- `beforeDelayMs` 不单独上报 `step.finished`。当前 step 的完成状态仍由工具执行结果决定。

## 7. 工具写法

### 7.1 开阳 MCP 工具用法表

开阳 MCP 工具 step 的 `executor.type` 固定为 `mcp`，`executor.mcpName` 固定为 `kaiyang`。配置时只需要根据操作目的选择 `toolName` 并填写对应 `params`。

| toolName | 用途 | stepId 示例 | params 示例 | 输出和后续引用 |
|---|---|---|---|---|
| `click` | 点击指定组件 | `clickQuery` | `{"componentId":"pension.queryButton"}` | 无 |
| `input` | 向指定组件输入内容 | `inputName` | `{"componentId":"pension.nameInput","value":"{{$_EVENT.userName}}"}` | 无 |
| `read` | 读取指定组件数据 | `readResult` | `{"componentId":"pension.resultPanel"}` | 声明 `"output": "result"` 后，后续可用 `{{result}}` 或 `{{result.name}}` 引用 |
| `select` | 选择指定组件的选项 | `selectType` | `{"componentId":"pension.typeSelect","value":"retirement"}` | 无 |

### 7.2 内置 wait 工具

用于固定等待。

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

说明：

- `durationMs` 允许为 `0`。
- `wait` 完成后也会上报 `step.finished`。

### 7.3 内置 request 工具

用于发起 HTTP 请求。

下例假设前置 `readResult` step 已声明 `"output": "result"`。

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
      "data": "{{result}}"
    }
  }
}
```

`request` 规范：

- 只支持 `GET`、`POST`。
- `url` 使用完整地址。
- `headers` 由 Skill 下发。
- `body` 只支持 JSON。
- 不支持 `form-data`。
- 不支持 `x-www-form-urlencoded`。

不支持的 method 会导致当前 step 失败：

```json
{
  "code": "REQUEST_METHOD_NOT_SUPPORTED",
  "message": "request only supports GET and POST",
  "detail": {
    "method": "PUT"
  }
}
```

## 8. 变量用法

Skill 支持简单模板变量。

支持位置：

```text
params 内的字符串字段
```

变量来源：

```text
$_EVENT.xxx
<outputName>.xxx
```

输出保存规则：

- 工具执行结果默认只进入执行记录和日志，不自动进入变量上下文。
- step 显式声明 `output` 变量名后，工具执行结果才会保存为顶层变量。
- `output` 保存的值允许为 `null`，变量名存在即不算缺失。
- `output` 变量名必须使用小驼峰命名。
- `output` 变量名必须全局唯一，不允许覆盖已有变量。
- `output` 变量名不允许使用保留字，例如 `event`、`steps`、`item`、`index`。
- 未声明 `output` 的 step，不允许被后续变量引用。
- 执行记录与变量上下文分离。即使未声明 `output` 变量名，任务执行窗口仍可展示 step 的成功、失败、耗时和错误信息。

变量解析规则：

| 场景 | 写法 | 解析规则 |
|---|---|---|
| 系统事件变量 | `{{$_EVENT.menuCode}}` | 从事件上下文读取 |
| 输出变量 | `{{result.name}}` | 从前置 step 声明的顶层变量读取 |
| 整体变量 | `{{result}}` | 当字符串只包含一个变量时，保留原始类型 |
| 字符串拼接 | `Bearer {{$_EVENT.token}}` | 转为字符串后拼接 |
| 条件表达式 | `{ "var": "result.amount" }` | 使用 JSON Logic 对象读取变量，不使用 `{{ }}` |
| 循环数组 | `{ "var": "list.items" }` | 求值结果必须是数组 |

系统变量规则：

- 系统变量统一使用 `$_` 前缀。
- 当前仅支持 `$_EVENT`，表示事件上下文。
- `$_STEPS` 等其他系统变量暂不支持，后续按需要再讨论。
- 用户声明的 `output` 变量名不能以 `$` 或 `_` 开头。

示例：

```json
{
  "stepId": "readUser",
  "output": "user",
  "executor": {
    "type": "mcp",
    "mcpName": "kaiyang",
    "toolName": "read"
  },
  "params": {
    "componentId": "pension.userPanel"
  }
}
```

后续 step 可以引用已保存的输出：

```json
{
  "stepId": "syncResult",
  "executor": {
    "type": "builtin",
    "toolName": "request"
  },
  "params": {
    "method": "POST",
    "url": "https://example.com/api/{{$_EVENT.menuCode}}/result",
    "headers": {
      "Authorization": "Bearer {{$_EVENT.token}}"
    },
    "body": {
      "name": "{{user.name}}",
      "amount": "{{user.amount}}"
    }
  }
}
```

变量规则：

- 缺失变量直接报错，当前 step 执行失败。
- 变量路径存在但值为 `null` 时，按 `null` 参与渲染或表达式求值。
- `params` 模板变量不支持表达式。
- 不支持计算。
- 不支持条件判断。
- 不支持默认值语法。

示例：

```json
{
  "headers": {
    "Authorization": "Bearer {{$_EVENT.token}}"
  },
  "body": {
    "missing": "{{user.missingField}}"
  }
}
```

如果 `$_EVENT.token` 或 `user.missingField` 不存在，当前 step 执行失败。

```json
{
  "code": "VARIABLE_RESOLVE_FAILED",
  "message": "variable path not found",
  "detail": {
    "path": "user.missingField"
  }
}
```

## 9. 完整 Skill 示例

```json
{
  "skillId": "pension-menu-open",
  "skillName": "养老金任务",
  "menuCode": "开阳侧标准菜单编码",
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
      "stepId": "waitResult",
      "executor": {
        "type": "builtin",
        "toolName": "wait"
      },
      "params": {
        "durationMs": 1000
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

## 10. 执行记录与上报结构

执行记录用于任务窗口展示、日志和服务端上报。执行记录不等同于变量上下文，未声明 `output` 变量名的 step 也必须产生执行记录。

step 执行记录建议结构：

```json
{
  "stepId": "readResult",
  "stepPath": "readResult",
  "status": "completed",
  "executor": {
    "type": "mcp",
    "mcpName": "kaiyang",
    "toolName": "read"
  },
  "beforeDelayMs": 300,
  "startedAt": "2026-06-03T10:00:00.000Z",
  "finishedAt": "2026-06-03T10:00:01.000Z",
  "durationMs": 1000,
  "outputName": "result"
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `stepId` | 配置中的 step 标识，小驼峰命名 |
| `stepPath` | 运行时路径；普通 step 等于 `stepId`，循环内可为 `processItems[0].inputName` |
| `status` | `completed`、`failed` 或 `skipped` |
| `executor` | 实际执行通道和工具信息 |
| `beforeDelayMs` | 当前 step 执行前等待时间 |
| `startedAt` | 当前 step 开始处理时间，包含执行前等待 |
| `finishedAt` | 当前 step 结束时间 |
| `durationMs` | 当前 step 总耗时，包含执行前等待 |
| `outputName` | 当前 step 保存的顶层变量名；未声明 `output` 时不填 |

失败记录示例：

```json
{
  "stepId": "syncResult",
  "stepPath": "syncResult",
  "status": "failed",
  "error": {
    "code": "VARIABLE_RESOLVE_FAILED",
    "message": "variable path not found",
    "detail": {
      "path": "user.name"
    }
  }
}
```

后续支持 `when` 或 group 时，条件不满足应记录为 `skipped`：

```json
{
  "stepId": "submitFlow",
  "stepPath": "submitFlow",
  "status": "skipped",
  "reason": "WHEN_FALSE"
}
```

上报事件建议：

| 事件 | 触发时机 | 说明 |
|---|---|---|
| `execution.started` | Skill 解析成功，准备执行第一个 step 前 | 包含 `skillId`、`skillVersion`、`skillName` |
| `step.started` | 当前 step 开始处理前 | 包含 `stepId`、`stepPath` 和 `beforeDelayMs` |
| `step.finished` | 当前 step completed、failed 或 skipped 后 | 包含完整 step 执行记录 |
| `execution.finished` | 全部执行成功、失败或用户中止后 | 包含最终状态和 steps 摘要 |

上报规则：

- `beforeDelayMs` 不单独上报，计入当前 step 的 `durationMs`。
- 变量上下文不默认上报，避免输出内容过大；需要排查时优先通过 step 执行记录和工具日志定位。
- 任一 step 失败后，立即上报该 step 的 `step.finished` 和整体 `execution.finished`。
- 用户中止时，当前任务按失败结束，错误码为 `USER_CANCELED`。
- 用户在 `beforeDelayMs` 等待期间中止时，当前 step 也应上报 failed，错误码为 `USER_CANCELED`。

## 11. 服务端静态校验规则

服务端发布前必须完成静态校验。子进程运行时不做完整 schema 校验，只做必要的防御性检查。

结构校验：

- `skillId` 必填。
- `skillName` 必填。
- `menuCode` 必填。
- `skillVersion` 必填。
- `steps` 非空。
- 每个 `stepId` 唯一。
- 每个 `stepId` 使用小驼峰命名。
- 每个 step 的 `beforeDelayMs` 为大于等于 `0` 的整数。
- 每个 step 的 `executor.type` 在支持范围内。
- `executor.type=mcp` 时，`mcpName` 和 `toolName` 必填且工具存在。
- `executor.type=builtin` 时，`toolName` 必填且工具存在。
- `params` 满足所选工具 schema。
- 开阳 MCP 自动化工具配置了 `params.componentId`。
- 内置 `wait` 配置了 `params.durationMs`。
- 内置 request 的 `params.method` 只使用 `GET` 或 `POST`。
- 内置 request 的 `params.url` 为完整地址。
- 内置 request 的 `params.body` 为 JSON。

变量与输出校验：

- 变量路径符合 `$_EVENT.xxx` 或已声明的顶层变量路径。
- 变量引用必须能解析到事件字段或前置输出变量。
- 被引用的前置 step 必须声明 `output` 变量名。
- `output` 变量名唯一且使用小驼峰命名。
- `output` 变量名不使用保留字，例如 `event`、`steps`、`item`、`index`。
- `output` 变量名不能以 `$` 或 `_` 开头。
- 同一个 Skill 中不允许后置 step 覆盖已有输出变量。
- 变量引用只能引用当前 step 之前已经产生的输出变量。

执行与上报校验：

- 每个 step 都能生成唯一 `stepPath`。
- `stepPath` 只由 Runtime 生成，配置人员不手写。

后续控制流校验：

- 表达式引擎采用 `json-logic-engine`，表达式必须是 JSON Logic 对象。
- 不支持 JS 表达式或字符串表达式，例如 `result.amount > 0 && $_EVENT.menuCode == "3040"`。
- `when` 表达式求值结果必须为 boolean。
- `foreach.items` 求值结果必须为数组。
- `foreach.maxIterations` 必填且不超过服务端配置上限。
- group 和 foreach 的嵌套层级不超过服务端配置上限。
- 循环展开后的最大 step 数不超过服务端配置上限。

建议默认限制：

| 项 | 建议值 | 说明 |
|---|---|---|
| `foreach.maxIterations` 最大值 | `50` | 防止异常大数组拖垮执行 |
| 控制流嵌套层级最大值 | `3` | 保持配置可读、可排查 |
| 展开后最大 step 数 | `200` | 限制单次任务执行规模 |

## 12. 制作检查清单

发布前人工检查：

- `skillId` 是否唯一。
- `skillName` 是否填写，并且适合在任务执行窗口展示。
- `skillVersion` 是否正确递增。
- `steps` 是否非空。
- 每个 `stepId` 是否唯一且语义清晰。
- 每个 `stepId` 是否使用小驼峰命名。
- 每个 step 的 `beforeDelayMs` 是否必要且数值合理。
- 每个 step 是否选择了正确的 `executor.type`。
- MCP step 是否选择了正确的 `mcpName` 和 `toolName`。
- 内置工具 step 是否选择了正确的 `toolName`。
- `params` 是否满足所选工具 schema。
- 开阳 MCP 自动化工具是否都配置了正确的 `componentId`。
- 内置 request 的 `params.method` 是否只使用 `GET` 或 `POST`。
- 内置 request 的 `params.body` 是否为 JSON。
- 变量路径是否符合规范。
- 变量引用是否都能解析到事件字段或前置输出变量。
- 被引用的前置步骤是否已声明 `output` 变量名。
- 前置步骤输出是否在后续变量引用前已经产生。

## 13. 后续控制流扩展建议

本期 Skill 仍保持线性、串行执行。后续如需要支持条件和循环，建议只扩展编排层，不改变工具 step 的执行通道。

建议新增三类节点：

| 节点类型 | 用途 | 执行语义 |
|---|---|---|
| tool step | 执行具体 MCP 或内置工具 | 按现有 `executor` 和 `params` 串行执行 |
| group step | 对一组步骤统一设置条件 | `when=true` 时执行内部 steps，`when=false` 时整个 group skipped |
| foreach step | 遍历数组并重复执行内部 steps | 先计算 `items`，再按数组顺序逐项串行执行内部 steps |

条件建议：

- `when` 只做轻量布尔判断，不做接口调用或副作用。
- `when` 必须使用 JSON Logic 对象，不支持 JS 表达式或字符串表达式。
- `when=false` 时当前 step 或 group 标记为 `skipped`，不算失败。
- `when` 求值异常时当前 step 失败，避免误跳过。
- 条件表达式只返回 boolean，其他类型按配置错误处理。
- 不支持 `else`，需要分支时使用两个互斥的 group。

复杂条件建议拆成前置计算 step：

下例假设前置 `readResult` step 已声明 `"output": "result"`。

```json
{
  "stepId": "calcSubmitCondition",
  "output": "canSubmit",
  "executor": {
    "type": "builtin",
    "toolName": "evaluate"
  },
  "params": {
    "expression": {
      "and": [
        { ">": [{ "var": "result.amount" }, 0] },
        { "==": [{ "var": "$_EVENT.menuCode" }, "3040"] }
      ]
    }
  }
}
```

后续 group 只引用布尔结果：

```json
{
  "stepId": "submitFlow",
  "type": "group",
  "when": {
    "==": [{ "var": "canSubmit" }, true]
  },
  "steps": []
}
```

循环建议：

- `foreach.items` 先求值得到数组。
- `foreach.items` 引用的前置 step 必须声明 `output` 变量名。
- 必须配置 `maxIterations`，防止异常大数组拖垮执行。
- 逻辑上展开为多组 step，实际执行时可以逐项生成、逐项串行执行。
- 循环内变量通过 `itemName` 暴露，例如 `{{item.name}}`。
- 任一内部 step 失败时，默认停止后续循环和后续外部步骤。
- group 和 foreach 允许嵌套，但必须限制最大嵌套层级。

下例假设前置 `readList` step 已声明 `"output": "list"`。

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

表达式引擎建议：

- 一期采用 `json-logic-engine`，仅用于 `when`、`evaluate` 和 `foreach.items` 的同步表达式求值。
- 一期表达式只接受 JSON Logic 对象，不接受 JS 表达式或字符串表达式。
- 一期不开放异步表达式、接口调用、副作用操作符或自定义操作符。
- 复杂数组筛选可后续引入 JSONata，但不建议在初期把 Skill 扩展成完整表达式语言。
- 业务规则复杂、需要接口查询或跨 Skill 复用时，应放到服务端或专门工具中，Skill 只根据返回结果编排。

## 14. 不建议的写法

不要在 Skill 里表达复杂业务逻辑：

```text
如果存在某按钮则点击，否则跳过
失败后重试 3 次
同时执行多个步骤
根据读取结果决定下一步
```

这些能力本期不支持。Skill 应该保持线性、明确、可排查。
