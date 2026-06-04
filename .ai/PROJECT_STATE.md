# PROJECT_STATE

更新时间：2026-06-04

## 1. 快照

项目：`yxz-agent`

定位：营小助智能体客户端工程，运行在开阳基座中，提供人工对话、定时任务、事件触发任务、MCP 工具调用和任务记录上报能力。

## 2. HOT 结论

- 正式架构：子进程 + 主窗体 + 任务子窗体 + 确认弹窗。
- 子进程只负责常驻触发、窗体唤起、平台接入和轻量持久化。
- 子进程不承担 MCP 工具能力、不执行智能体调度、不上传任务记录。
- 主窗体承载人工对话类业务会话。
- 任务子窗体承载定时任务和事件触发任务。
- 业务窗体内部拆分为执行层和展示层。
- MCP 调用、任务推进、运行事件、任务记录上传归属业务窗体执行层。
- 确认弹窗只负责确认或忽略，不执行任务。
- 事件触发任务结构化脚本由任务子窗体执行层解释执行。
- `webapp` 已完成独立 Vite 前端工程接入，主窗体工作台已迁入当前仓库。
- 主窗体最小正式会话链路已打通：`LIST_AGENTS`、`LIST_SESSIONS`、`CREATE_SESSION`、`GET_SESSION_DETAIL`、`USER_MESSAGE`、`CANCEL_RUN` 已可用。
- 前端执行层骨架已建立：`chat-client`、`stream-parser`、`mcp-client`、`mcp-adapter`、`task-record-uploader` 已落位。
- 主窗体独立网页端布局样式已恢复；`styled-components` 的全局样式不再通过 `@import` 注入字体，字体改由 `webapp/index.html` 加载。
- 任务脚本表达式求值已改为本地手工实现，保留 JSON Logic 风格对象写法，不再依赖外部表达式库。
- 已明确当前不采用“直接执行 JS 表达式”的方案；如需提升作者体验，应走“类 JS 写法编译到受限 DSL”，而不是在运行时开放 `eval/new Function`。
- 已新增受控 JS 脚本运行时支撑设计，方向是“可执行 JS 语法 + 受控 `ctx` 能力注入 + 静态扫描 + 资源限制”，目前仍待评审，不是正式方案。
- 当前代码已新增实验性 builtin `script`：通过 `params.function` 传入函数字符串，执行时向函数注入只读上下文，主要用于结果后处理；该能力尚未进入正式文档口径。
- 当前子进程里的 `AssistantSessionService` 仍是过渡实现，只提供最小会话存储和模拟回复，不是正式营小助服务接入。

## 3. 技术栈

| 层面 | 当前技术 |
| --- | --- |
| 语言 | TypeScript 5.9，JavaScript |
| 包管理 | npm，`package-lock.json` |
| 运行环境 | Node.js，浏览器窗体，开阳基座宿主环境 |
| 前端 | React 19，React Router 7，Vite 7 |
| UI/状态 | Ant Design 5，styled-components 6，Zustand 5 |
| 子进程/工具 | Node 服务模块，MCP SDK，Axios，cron-parser |
| 测试 | Node built-in test runner |
| 构建 | `tsc`，Vite |

## 4. 目录地图

| 目录 | 作用 |
| --- | --- |
| `share/` | 共享协议、宿主类型、路由、时间工具 |
| `subprocess/service/` | 子进程服务、通道服务、调度服务、MCP 客户端 |
| `webapp/src/` | React 前端、窗体、执行层事件、组件、状态 |
| `docs/` | 当前正式设计文档和支撑文档 |
| `docs/archive/` | 历史草案和旧口径 |
| `tests/` | Node 测试 |
| `skills/` | 本地技能示例或配置 |

当前与迁移最相关的目录：

- `webapp/src/pages/Assistant/`：主窗体 runtime 与 service 接线。
- `webapp/src/assistant/execution-layer/`：新迁入的主窗体执行层骨架。
- `subprocess/service/chat/`：当前过渡期会话运行时。
- `tests/webappExecutionLayer.test.ts`：执行层与流式事件回归测试。

## 5. 编码规范

- TypeScript 使用 `strict`，优先显式类型和共享协议类型。
- 共享协议优先放在 `share/protocol.ts`。
- 子进程服务以 class 和依赖注入为主，保持可测试。
- 前端状态优先沿用 Zustand store。
- UI 优先沿用现有 Ant Design、styled-components 和 app theme。
- 文档正文遵守 `docs/terminology.md`；旧代码字段可按迁移节奏保留。
- 修改前必须看 `git status --short`，避免覆盖既有改动。

## 6. 脚本 DSL 状态

- 事件触发任务脚本已正式化为结构化 JSON DSL。
- 脚本执行归属任务子窗体执行层。
- 当前仓库已新增可独立引入的脚本执行引擎，入口为 `subprocess/service/execution/skillScriptEngine.ts`。
- 脚本执行引擎已按职责拆分为小驼峰模块：类型、校验、模板解析、内置工具、示例和错误处理已从主引擎文件拆出。
- 运行时按步骤串行执行，快速失败。
- 当前不支持步骤并发、自动重试、脚本级总超时。
- `beforeDelayMs` 可选、不设最大值、必须可取消。
- 工具结果默认不进入变量上下文。
- 只有显式声明 `output` 才保存顶层变量。
- 系统变量当前仅支持 `$_EVENT`。
- 条件和循环表达式使用 JSON Logic 对象。
- 运行时表达式求值由仓库内置解释器实现，不再依赖 `json-logic-engine` 或 `json-logic-js`。
- 缺失变量直接失败，错误码为 `VARIABLE_RESOLVE_FAILED`。
- 当前已支持 `group`、`foreach`、`evaluate`、`wait`、`request` 和 `USER_CANCELED`。

## 7. 风险

| 风险 | 当前处理 |
| --- | --- |
| 工作区已有大量未提交变更 | 只修改任务相关文件，不回滚他人改动 |
| archive 与正式文档并存 | 当前设计以 `docs/formal-docs-index.md` 为准 |
| 旧术语残留 | 正式文档避免 DCF、Runtime、Channel 正文口径 |
| 子进程职责膨胀 | 不把 MCP、脚本执行、任务记录上传放回子进程 |
| 脚本 DSL 仍在落地 | 实现前读 `docs/event-task-script-execution-design.md` |
| 前端迁移中间态 | 改 UI 前确认当前入口、路由和 store |
| 主窗体执行层仍有占位实现 | `mcp-client`、`task-record-uploader` 目前只有正式接口骨架，未接真实服务 |
| 会话运行时仍在子进程过渡承载 | 后续要把真实营小助服务调用和更多执行职责迁回窗体执行层 |
| 前端构建包偏大 | `vite build` 仍有大 chunk 告警，后续需要拆包 |
| 脚本执行回显方式容易与 assistant 消息流混淆 | 当前结论是实时只回显任务级摘要，完整步骤明细放历史执行记录，不把每个脚本步骤转成 assistant 文本泡泡 |

## 8. 验证命令

| 命令 | 用途 |
| --- | --- |
| `npm run build:subprocess` | 编译 TypeScript |
| `npm run build:webapp` | 构建前端 |
| `npm test` | 构建并运行 Node 测试 |
| `npm run build` | 完整构建 |

当前验证状态：

- `npm test` 通过，当前为 `56/56`。
- `node --test dist/tests/webappExecutionLayer.test.js` 通过。
- `npm run build:webapp` 通过，但仍有 chunk size warning。
- `npm run build:subprocess` 通过。
- `node --test dist/tests/skillEngine.test.js dist/tests/scheduleSkillRunner.test.js` 通过。
- 主窗体独立网页端页面已在浏览器中复测，三栏布局和卡片样式恢复正常。

## 9. 按需扩展

- 架构、重构、发布、排障：读 `.ai/workflows/README.md`。
- 正式产品或术语：读 `docs/formal-docs-index.md`、`docs/terminology.md`。
- 脚本 DSL：读事件任务脚本两份正式文档。
