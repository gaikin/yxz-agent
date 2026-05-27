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
  "stepId": "click-query",
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
| `read` | 读取指定组件数据 | `componentId` | 无 | 当前 step 的 `output` |
| `select` | 选择指定组件的选项 | `componentId`、`value` | 无 | 无 |

参数说明：

| 参数 | 说明 |
|---|---|
| `componentId` | 开阳 MCP 识别的组件标识，不使用 CSS、XPath 或 DOM selector |
| `value` | 写入或选择的目标值，可使用模板变量 |

MCP 工具 step 结构：

```json
{
  "stepId": "click-query",
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

## 6. 工具写法

### 6.1 开阳 MCP 工具用法表

开阳 MCP 工具 step 的 `executor.type` 固定为 `mcp`，`executor.mcpName` 固定为 `kaiyang`。配置时只需要根据操作目的选择 `toolName` 并填写对应 `params`。

| toolName | 用途 | stepId 示例 | params 示例 | 输出和后续引用 |
|---|---|---|---|---|
| `click` | 点击指定组件 | `click-query` | `{"componentId":"pension.queryButton"}` | 无 |
| `input` | 向指定组件输入内容 | `input-name` | `{"componentId":"pension.nameInput","value":"{{event.userName}}"}` | 无 |
| `read` | 读取指定组件数据 | `read-result` | `{"componentId":"pension.resultPanel"}` | 子进程透传为当前 step 的 `output`，后续可用 `{{steps.read-result.output}}` 或 `{{steps.read-result.output.name}}` 引用 |
| `select` | 选择指定组件的选项 | `select-type` | `{"componentId":"pension.typeSelect","value":"retirement"}` | 无 |

### 6.2 内置 wait 工具

用于固定等待。

```json
{
  "stepId": "wait-page-ready",
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

### 6.3 内置 request 工具

用于发起 HTTP 请求。

```json
{
  "stepId": "sync-result",
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
      "data": "{{steps.read-result.output}}"
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

## 7. 变量用法

Skill 支持简单模板变量。

支持位置：

```text
params 内的字符串字段
```

变量来源：

```text
event.xxx
steps.<stepId>.output.xxx
```

示例：

```json
{
  "stepId": "sync-result",
  "executor": {
    "type": "builtin",
    "toolName": "request"
  },
  "params": {
    "method": "POST",
    "url": "https://example.com/api/{{event.menuCode}}/result",
    "headers": {
      "Authorization": "Bearer {{event.token}}"
    },
    "body": {
      "name": "{{steps.read-user.output.name}}",
      "amount": "{{steps.read-user.output.amount}}"
    }
  }
}
```

变量规则：

- 缺失变量替换为空字符串。
- 不支持表达式。
- 不支持计算。
- 不支持条件判断。
- 不支持默认值语法。

示例：

```json
{
  "headers": {
    "Authorization": "Bearer {{event.token}}"
  },
  "body": {
    "missing": "{{steps.no-such-step.output.x}}"
  }
}
```

如果 `event.token` 和 `steps.no-such-step.output.x` 不存在，渲染结果为：

```json
{
  "headers": {
    "Authorization": "Bearer "
  },
  "body": {
    "missing": ""
  }
}
```

## 8. 完整 Skill 示例

```json
{
  "skillId": "pension-menu-open",
  "skillName": "养老金任务",
  "menuCode": "开阳侧标准菜单编码",
  "skillVersion": "1.0.0",
  "steps": [
    {
      "stepId": "click-query",
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
      "stepId": "wait-result",
      "executor": {
        "type": "builtin",
        "toolName": "wait"
      },
      "params": {
        "durationMs": 1000
      }
    },
    {
      "stepId": "read-result",
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
      "stepId": "sync-result",
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
          "menuCode": "{{event.menuCode}}",
          "result": "{{steps.read-result.output}}"
        }
      }
    }
  ]
}
```

## 9. 服务端配置校验建议

服务端发布前建议校验：

- `skillId` 必填。
- `skillName` 必填。
- `menuCode` 必填。
- `skillVersion` 必填。
- `steps` 非空。
- 每个 `stepId` 唯一。
- 每个 step 的 `executor.type` 在支持范围内。
- `executor.type=mcp` 时，`mcpName` 和 `toolName` 必填且工具存在。
- `executor.type=builtin` 时，`toolName` 必填且工具存在。
- `params` 满足所选工具 schema。
- 开阳 MCP 自动化工具配置了 `params.componentId`。
- 内置 `wait` 配置了 `params.durationMs`。
- 内置 request 的 `params.method` 只使用 `GET` 或 `POST`。
- 内置 request 的 `params.url` 为完整地址。
- 内置 request 的 `params.body` 为 JSON。
- 变量路径符合 `event.xxx` 或 `steps.<stepId>.output.xxx`。

## 10. 制作检查清单

发布前人工检查：

- `skillId` 是否唯一。
- `skillName` 是否填写，并且适合在任务执行窗口展示。
- `skillVersion` 是否正确递增。
- `steps` 是否非空。
- 每个 `stepId` 是否唯一且语义清晰。
- 每个 step 是否选择了正确的 `executor.type`。
- MCP step 是否选择了正确的 `mcpName` 和 `toolName`。
- 内置工具 step 是否选择了正确的 `toolName`。
- `params` 是否满足所选工具 schema。
- 开阳 MCP 自动化工具是否都配置了正确的 `componentId`。
- 内置 request 的 `params.method` 是否只使用 `GET` 或 `POST`。
- 内置 request 的 `params.body` 是否为 JSON。
- 变量路径是否符合规范。
- 前置步骤输出是否在后续变量引用前已经产生。

## 11. 不建议的写法

不要在 Skill 里表达复杂业务逻辑：

```text
如果存在某按钮则点击，否则跳过
失败后重试 3 次
同时执行多个步骤
根据读取结果决定下一步
```

这些能力本期不支持。Skill 应该保持线性、明确、可排查。
