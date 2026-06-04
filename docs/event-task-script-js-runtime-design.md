# 事件触发任务受控 JS 脚本执行方案

更新时间：2026-06-04

相关文档：

- 术语规范：[terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md)
- 系统架构：[system-architecture.md](C:/dev/projects/work/yxz-agent/docs/system-architecture.md)
- 运行流程：[runtime-flows.md](C:/dev/projects/work/yxz-agent/docs/runtime-flows.md)
- 当前正式脚本方案：[event-task-script-execution-design.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-execution-design.md)

## 1. 文档定位

本文是“事件触发任务脚本从结构化 JSON DSL 迁移到受控 JS 脚本运行时”的支撑设计，用于说明迁移动机、目标边界、执行模型、安全控制、结果协议和迁移路径。

本文不是对当前正式方案的直接替换。当前正式口径仍以 [event-task-script-execution-design.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-execution-design.md) 为准。本文用于支持后续评审和实现迁移。

## 2. 背景与问题

当前结构化 JSON DSL 方案具备可校验、可控和易审计的优点，但随着任务脚本能力扩展，已经出现以下问题：

- 工具结果需要更多后处理能力，例如字段提取、序列化、拼接和条件分支。
- 为覆盖更多场景，需要持续增加内置操作符、输出模式和特例处理，执行层补丁逐步增多。
- 外部表达式库容易带来依赖源、模块格式和浏览器运行时兼容问题。
- 继续沿 JSON DSL 扩展，复杂度会逐渐逼近“半套脚本语言”，但作者体验仍然较差。

因此，后续方向可转为“受控 JS 脚本运行时”，以可编程能力替代不断膨胀的补丁式 DSL 扩展。

## 3. 总体目标

- 脚本作者可使用 JS 风格表达业务逻辑和结果处理。
- 运行时不直接开放宿主环境，不允许任意访问全局对象。
- 所有能力通过受控上下文注入。
- 子进程仍不执行脚本；脚本执行仍归属任务子窗体执行层。
- 任务记录、运行事件、错误结构和可取消语义保持可观测。
- 安全控制不是事后补救，而是运行时能力模型的一部分。

## 4. 总体原则

- 允许脚本使用 JS 语法，但不允许直接执行任意宿主能力。
- 不使用裸 `eval` / `new Function` 直接跑不受控脚本。
- 脚本只运行在专用执行上下文中。
- 脚本所有外部能力都通过 `ctx` 白名单 API 暴露。
- 静态扫描、能力隔离、超时限制和输出限制必须同时存在。
- 运行时安全边界优先于作者便利性。

## 5. 执行模型

脚本以“单次任务执行”为单位运行，任务子窗体执行层负责：

1. 加载脚本源码与元数据。
2. 对脚本做发布前或加载前静态检查。
3. 创建一次独立脚本执行上下文。
4. 注入受控 `ctx`。
5. 运行脚本入口函数。
6. 采集步骤事件、日志、结果和错误。
7. 上报任务记录并回传任务摘要。

脚本入口建议固定为：

```ts
export default async function run(ctx) {
  // ...
}
```

运行结果建议统一为：

```ts
type ScriptRunResult = {
  status: "completed" | "failed"
  data?: unknown
  summary?: string
}
```

## 6. 能力模型

脚本不能直接访问宿主全局能力，统一通过 `ctx` 注入。

建议最小能力集：

```ts
interface ScriptContext {
  event: Record<string, unknown>
  signal: AbortSignal
  vars: {
    get(path: string): unknown
    set(name: string, value: unknown): void
    has(name: string): boolean
  }
  mcp: {
    call(toolName: string, args: Record<string, unknown>): Promise<unknown>
  }
  http: {
    request(input: {
      method: "GET" | "POST"
      url: string
      headers?: Record<string, string>
      body?: unknown
    }): Promise<unknown>
  }
  wait(ms: number): Promise<void>
  log(input: {
    level?: "debug" | "info" | "warn" | "error"
    message: string
    data?: unknown
  }): void
  steps: {
    run<T>(name: string, action: () => Promise<T>): Promise<T>
  }
  result: {
    text(value: unknown): string
    json(value: unknown): string
    pick(value: unknown, path: string): unknown
  }
}
```

关键规则：

- 脚本只能通过 `ctx.mcp.call()` 使用 MCP。
- 脚本不能直接访问 `fetch`、`BridgeJs`、文件系统、`process`、定时器和任意全局对象。
- 结果处理能力如序列化、字段提取、文本化，统一通过 `ctx.result.*` 暴露。

## 7. 安全模型

### 7.1 运行时隔离

- 脚本运行在专用执行环境中。
- 不向脚本暴露宿主全局对象引用。
- 禁止脚本直接获取构造器链、原型链逃逸能力和动态模块加载能力。

### 7.2 静态扫描

发布前或加载前静态扫描至少检查：

- 禁止 `eval`
- 禁止 `Function`
- 禁止 `import()` 动态加载
- 禁止直接访问 `window`、`document`、`globalThis`、`process`
- 禁止直接访问网络或宿主桥
- 禁止高风险无限循环模式

静态扫描用于提前拦截高风险写法，但不能替代运行时隔离。

### 7.3 资源限制

- 单次脚本执行必须设置总超时。
- 所有异步能力都必须绑定 `AbortSignal`。
- 限制日志条数和日志总大小。
- 限制最终返回结果大小。
- 限制步骤记录条数。

### 7.4 输出控制

- 变量上下文只保存显式写入内容。
- 执行记录默认保留摘要，不默认保留超大原始对象。
- 对敏感数据支持后续扩展掩码策略。

## 8. 结果与步骤协议

当前 JSON DSL 的一个核心问题是“工具结果原样透传后仍需后处理”。JS 方案下建议显式区分：

- 原始工具结果
- 变量上下文值
- 步骤展示摘要
- 最终任务结果

建议步骤包装 API：

```ts
await ctx.steps.run("readResult", async () => {
  const raw = await ctx.mcp.call("read", { componentId: "pension.resultPanel" })
  const text = ctx.result.text(raw)
  ctx.vars.set("resultText", text)
  return {
    raw,
    summary: text,
  }
})
```

建议执行层记录：

- `raw`：仅在受控场景保留
- `summary`：用于 UI 和任务摘要
- `storedOutputs`：写入变量上下文的顶层变量名

## 9. 与当前 JSON DSL 的关系

迁移期建议同时支持两种脚本形态：

| 形态 | 作用 | 状态 |
| --- | --- | --- |
| JSON DSL | 存量脚本兼容 | 迁移期保留 |
| 受控 JS 脚本 | 新能力主路径 | 逐步引入 |

运行时可通过脚本元数据区分：

```json
{
  "scriptType": "json-dsl"
}
```

```json
{
  "scriptType": "controlled-js"
}
```

迁移策略：

- 存量低复杂度脚本继续保留 JSON DSL。
- 需要复杂结果处理、分支和数据变换的新脚本优先走受控 JS。
- 后续如果 JS 方案稳定，可逐步冻结 JSON DSL 新能力扩展。

## 10. 实现分阶段建议

### 第一阶段：运行时骨架

- 新增受控 JS 脚本引擎模块。
- 固定入口 `export default async function run(ctx)`.
- 注入最小 `ctx` 能力。
- 接入取消、超时和步骤事件。

### 第二阶段：安全控制

- 补静态扫描。
- 收紧可访问全局对象。
- 限制日志、结果和步骤规模。

### 第三阶段：迁移接入

- 在任务子窗体执行层加入按 `scriptType` 分发。
- 让任务记录上传链路兼容 JS 脚本执行结果。
- 保持现有 UI 的步骤展示和任务摘要模型不变。

### 第四阶段：作者体验

- 提供脚本模板。
- 提供本地 runner。
- 提供发布前检查和错误提示。

## 11. 当前明确不做

- 不直接在运行时开放任意宿主 JS 能力。
- 不让脚本直接操作 DOM、Bridge 或文件系统。
- 不以“事后扫描”替代运行时隔离。
- 不在第一阶段引入完整 npm 生态或第三方任意库。

## 12. 待确认问题

- 受控 JS 脚本的具体执行容器选型。
- 脚本源码如何存储、下发和版本化。
- 与现有 JSON DSL 是否长期双轨共存。
- 任务子窗体 UI 中步骤级日志展示粒度。
- 服务端是否承担脚本静态扫描和签名校验。
