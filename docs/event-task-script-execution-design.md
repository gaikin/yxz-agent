# 事件触发任务脚本执行方案

更新时间：2026-06-03

相关文档：

- 术语规范：[terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md)
- 系统架构：[system-architecture.md](C:/dev/projects/work/yxz-agent/docs/system-architecture.md)
- 运行流程：[runtime-flows.md](C:/dev/projects/work/yxz-agent/docs/runtime-flows.md)
- 脚本制作规范：[event-task-script-authoring-guide.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-authoring-guide.md)

## 1. 文档定位

本文说明事件触发任务脚本的正式执行方案，重点定义脚本模型、执行边界、变量规则、条件循环、执行记录、上报结构和静态校验要求。

本文遵守当前总体架构：子进程只负责事件接入、触发、确认和窗体唤起；任务执行、MCP 工具调用、步骤推进、任务记录上传都归属任务子窗体执行层。确认弹窗只负责确认或忽略，不执行任务。

## 2. 总体原则

- 脚本是一份结构化 JSON DSL，不是可执行代码。
- 脚本描述技能的结构化执行步骤；技能用于表达可执行业务能力，脚本用于表达该能力的步骤编排。
- 脚本由任务子窗体执行层解释执行。
- 子进程不获取脚本、不解释脚本、不调用 MCP、不上传任务记录。
- 服务端或配置平台必须在发布前完成静态校验，只下发校验通过的脚本。
- 任务子窗体执行层只做必要的防御性检查，不承担完整 schema 校验职责。
- 运行时不做业务 action 到底层工具的映射，脚本必须显式指定 `executor.type`、`mcpName`、`toolName` 和 `params`。
- 脚本执行默认串行、快速失败，不支持并发、重试和脚本级总超时。

## 3. 执行链路

事件触发任务进入任务子窗体后，脚本执行链路如下：

```text
开阳事件到达
  -> 子进程事件接入器生成触发源
  -> 子进程按策略创建待确认任务项
  -> 确认弹窗展示待确认任务项
  -> 用户确认执行
  -> 子进程唤起任务子窗体并传入事件上下文
  -> 任务子窗体执行层创建一次任务
  -> 获取技能及其结构化脚本
  -> 上报 execution.started
  -> 按顺序解释执行 steps
  -> 按步骤调用开阳 MCP 或内置工具
  -> 产生 step 执行记录和运行事件
  -> 上报 execution.finished
  -> 上传任务记录到营小助智能体服务
  -> 回写轻量任务摘要给子进程
```

关键规则：

- 用户确认前不开始脚本执行。
- 用户忽略或取消确认时，不创建一次脚本执行，不上报 `execution.started`。
- 一次任务进入执行后，即使失败或被中止，也需要形成任务记录。
- 任务记录由任务子窗体执行层直接上传营小助智能体服务。

## 4. 脚本结构

脚本顶层结构：

```json
{
  "skillId": "pensionMenuOpen",
  "skillName": "养老金任务",
  "menuCode": "3040",
  "skillVersion": "1.0.0",
  "steps": []
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `skillId` | 技能唯一标识 |
| `skillName` | 技能名称，用于确认弹窗和任务子窗体展示 |
| `menuCode` | 开阳侧菜单编码或业务场景编码 |
| `skillVersion` | 技能版本，用于日志、排查和上报 |
| `steps` | 脚本步骤列表，不允许为空 |

脚本支持三类节点：

| 节点类型 | 识别方式 | 用途 | 执行语义 |
| --- | --- | --- | --- |
| 工具步骤 | 未声明 `type` 或 `type=tool` | 调用 MCP 或内置工具 | 按 `executor` 和 `params` 执行一次工具调用 |
| 分组步骤 | `type=group` | 对一组步骤统一设置条件 | `when=true` 时执行内部步骤，`when=false` 时整体跳过 |
| 循环步骤 | `type=foreach` | 遍历数组并重复执行内部步骤 | 先计算数组，再按数组顺序逐项串行执行 |

工具步骤示例：

```json
{
  "stepId": "readResult",
  "beforeDelayMs": 300,
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

字段说明：

| 字段 | 说明 |
| --- | --- |
| `stepId` | 任务步骤标识，使用小驼峰命名，同一脚本内唯一 |
| `beforeDelayMs` | 当前步骤执行前延迟，可选，未配置按 `0` 处理 |
| `output` | 当前步骤工具结果保存到变量上下文时使用的顶层变量名，可选 |
| `executor` | 执行器声明 |
| `params` | 工具参数，支持模板变量 |
| `when` | 条件表达式，可用于工具步骤和分组步骤 |

## 5. 执行模型

脚本按步骤顺序串行执行。

执行规则：

- 同一任务子窗体内同一时间只执行一个当前任务。
- 同一脚本内的步骤按顺序执行。
- 任一步骤失败，立即停止后续步骤。
- 任一循环内部步骤失败，默认停止当前循环和后续外部步骤。
- 不支持步骤重试。
- 不支持并发步骤。
- 不设置脚本级总超时。
- 底层工具超时由具体工具或执行通道负责。
- 用户可以在任务子窗体中止当前任务。

`beforeDelayMs` 用于当前步骤调用执行器前的固定等待，适合为页面元素加载、弹窗渲染、列表刷新预留缓冲时间。

`beforeDelayMs` 规则：

- 可选，未配置时按 `0` 处理。
- 必须是大于等于 `0` 的整数。
- 暂不设置最大值限制。
- 只影响当前步骤执行前等待，不进入 `params`，不传给底层工具。
- 等待完成后才调用当前步骤的 `executor`。
- 等待必须可取消。
- 用户在等待期间中止任务时，等待立即结束，当前步骤以 `USER_CANCELED` 失败，不再调用当前步骤执行器。
- 延迟耗时计入当前步骤 `durationMs`，不单独上报一条步骤完成事件。

## 6. 执行器模型

每个工具步骤必须声明 `executor` 和 `params`。

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

执行器类型：

| `executor.type` | 说明 |
| --- | --- |
| `mcp` | 调用指定 MCP 下的指定工具 |
| `builtin` | 调用内置工具 |

运行时只根据 `executor.type` 分发到对应执行通道，不维护业务动作映射表。

## 7. 变量与输出

脚本变量上下文由系统变量和显式输出变量组成。

变量来源：

| 来源 | 写法 | 说明 |
| --- | --- | --- |
| 事件上下文 | `$_EVENT.xxx` | 当前仅支持的系统变量 |
| 步骤输出 | `result.xxx` | 前置步骤显式声明 `output` 后产生的顶层变量 |
| 循环当前项 | `item.xxx` | `foreach.itemName` 声明的循环内临时变量 |

系统变量规则：

- 系统变量统一使用 `$_` 前缀。
- 当前仅支持 `$_EVENT`。
- `$_STEPS` 等其他系统变量暂不支持。
- 用户声明的输出变量名不能以 `$` 或 `_` 开头。

输出保存规则：

- 工具结果默认只进入执行记录和工具日志，不自动进入变量上下文。
- 步骤显式声明 `output` 后，工具结果才保存为顶层变量。
- `output` 变量名使用小驼峰命名。
- `output` 变量名在同一脚本内必须全局唯一。
- `output` 变量名不能使用保留字，例如 `event`、`steps`、`item`、`index`。
- `output` 保存的值允许为 `null`，变量名存在即不算缺失。
- 未声明 `output` 的步骤，不允许被后续变量引用。

模板规则：

| 场景 | 写法 | 解析规则 |
| --- | --- | --- |
| 系统事件变量 | `{{$_EVENT.menuCode}}` | 从事件上下文读取 |
| 输出变量 | `{{result.name}}` | 从前置输出变量读取 |
| 整体变量 | `{{result}}` | 当字符串只包含一个变量时，保留原始类型 |
| 字符串拼接 | `Bearer {{$_EVENT.token}}` | 按字符串渲染后拼接 |

缺失变量直接导致当前步骤失败，错误码为 `VARIABLE_RESOLVE_FAILED`。变量路径存在但值为 `null` 时，按 `null` 参与渲染或表达式求值。

## 8. 条件与循环

条件和循环表达式采用 JSON Logic 风格对象，由任务执行层内置的受限表达式求值器解释执行。脚本中只接受 JSON 对象表达式，不接受 JS 表达式或字符串表达式。

表达式使用范围：

| 字段 | 用途 | 结果要求 |
| --- | --- | --- |
| `when` | 控制工具步骤或分组步骤是否执行 | 必须为 boolean |
| `foreach.items` | 计算循环数组 | 必须为 array |
| 内置 `evaluate` 工具 | 计算中间结果并保存为输出变量 | 按工具定义返回 |

条件示例：

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
}
```

循环示例：

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

控制流规则：

- `when=false` 时当前步骤或分组步骤记录为 `skipped`，不算失败。
- `when` 求值异常时当前步骤失败。
- `when` 不支持接口调用、异步计算或副作用。
- `foreach.items` 先求值得到数组，再开始执行内部步骤。
- `foreach.maxIterations` 必填。
- `foreach.itemName` 默认为 `item`，如配置则必须使用小驼峰命名。
- 分组和循环允许嵌套，但必须限制最大嵌套层级。

默认规模限制：

| 项 | 默认限制 | 说明 |
| --- | --- | --- |
| `foreach.maxIterations` 最大值 | `50` | 防止异常大数组拖垮执行 |
| 控制流嵌套层级最大值 | `3` | 保持配置可读、可排查 |
| 展开后最大步骤数 | `200` | 限制单次任务执行规模 |

## 9. 执行记录与上报

执行记录用于任务子窗体展示、日志排查和服务端上报。执行记录与变量上下文分离，未声明 `output` 的步骤也必须产生执行记录。

步骤执行记录建议结构：

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
| --- | --- |
| `stepId` | 配置中的任务步骤标识 |
| `stepPath` | 执行层生成的运行时路径 |
| `status` | `completed`、`failed` 或 `skipped` |
| `executor` | 实际执行通道和工具信息 |
| `beforeDelayMs` | 当前步骤执行前等待时间 |
| `startedAt` | 当前步骤开始处理时间，包含执行前等待 |
| `finishedAt` | 当前步骤结束时间 |
| `durationMs` | 当前步骤总耗时，包含执行前等待 |
| `outputName` | 当前步骤保存的顶层变量名；未声明 `output` 时不填 |
| `error` | 失败时的错误结构 |
| `reason` | 跳过时的原因，例如 `WHEN_FALSE` |

`stepPath` 只由执行层生成，配置人员不手写。普通步骤的 `stepPath` 等于 `stepId`；循环内步骤可生成类似 `processItems[0].inputName` 的路径。

运行事件：

| 事件 | 触发时机 | 说明 |
| --- | --- | --- |
| `execution.started` | 用户确认执行后，准备执行第一个步骤前 | 标识一次脚本执行开始 |
| `step.started` | 当前步骤开始处理前 | 包含 `stepId`、`stepPath` 和 `beforeDelayMs` |
| `step.finished` | 当前步骤完成、失败或跳过后 | 包含完整步骤执行记录 |
| `execution.finished` | 全部执行成功、失败或用户中止后 | 标识一次脚本执行结束 |

上报规则：

- 任一步骤失败后，立即上报该步骤的 `step.finished` 和整体 `execution.finished`。
- 用户中止时，当前任务按失败结束，错误码为 `USER_CANCELED`。
- 用户在 `beforeDelayMs` 等待期间中止时，当前步骤也按 `USER_CANCELED` 失败。
- 变量上下文不默认上报，避免输出内容过大。
- 任务记录上传失败不阻塞一次任务完成。

## 10. 服务端静态校验

服务端或配置平台发布脚本前必须完成静态校验。

结构校验：

- `skillId`、`skillName`、`menuCode`、`skillVersion` 必填。
- `steps` 非空。
- 每个 `stepId` 全局唯一。
- 每个 `stepId` 使用小驼峰命名。
- 每个步骤的 `beforeDelayMs` 为大于等于 `0` 的整数。
- 节点类型在支持范围内。
- 工具步骤必须声明 `executor` 和 `params`。
- `executor.type=mcp` 时，`mcpName` 和 `toolName` 必填且工具存在。
- `executor.type=builtin` 时，`toolName` 必填且工具存在。
- `params` 满足所选工具 schema。

变量与表达式校验：

- 变量路径只允许引用 `$_EVENT`、前置输出变量或循环当前项。
- 被引用的前置步骤必须声明 `output`。
- 变量引用不能引用尚未产生的输出变量。
- `output` 变量名全局唯一且使用小驼峰命名。
- `output` 变量名不能以 `$` 或 `_` 开头。
- `output` 变量名不能使用保留字。
- JSON Logic 表达式结构合法。
- `when` 表达式求值结果必须为 boolean。
- `foreach.items` 求值结果必须为数组。
- `foreach.maxIterations` 必填且不超过服务端配置上限。
- 分组和循环嵌套层级不超过服务端配置上限。
- 循环展开后的最大步骤数不超过服务端配置上限。

运行边界校验：

- 不允许 JS 表达式或字符串表达式。
- 不允许异步表达式。
- 不允许表达式接口调用。
- 不允许表达式副作用操作。
- 不允许未注册的自定义表达式操作符。

## 11. 当前不支持

- 脚本内任意 JS 代码执行。
- 字符串形式条件表达式，例如 `result.amount > 0 && $_EVENT.menuCode == "3040"`。
- 步骤并发执行。
- 步骤自动重试。
- 脚本级总超时。
- 输出字段投影和敏感字段过滤。
- `else` 分支；需要分支时使用两个互斥分组。
- `$_STEPS` 等除 `$_EVENT` 以外的系统变量。

## 12. 待确认问题

暂无。
