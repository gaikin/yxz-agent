# 营小助正式设计文档索引

更新时间：2026-06-03

## 1. 文档定位

本文是营小助当前正式设计文档入口。后续产品讨论、架构评审和代码迁移，应优先引用本文列出的正式文档。

历史草案、旧 DCF 口径、旧事件触发方案和早期模块拆分已集中归档到 [archive](C:/dev/projects/work/yxz-agent/docs/archive/README.md)。归档文档只用于追溯背景，不作为当前设计约束。

## 2. 正式文档

| 文档 | 作用 | 使用场景 |
| --- | --- | --- |
| [terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md) | 统一术语 | 所有产品、架构、代码设计文档必须优先遵守 |
| [product-design.md](C:/dev/projects/work/yxz-agent/docs/product-design.md) | 正式产品设计 | 说明营小助整体产品如何工作、有哪些窗体、用户如何完成任务 |
| [system-architecture.md](C:/dev/projects/work/yxz-agent/docs/system-architecture.md) | 正式系统架构 | 说明子进程、主窗体、任务子窗体、确认弹窗、执行层、展示层的职责边界 |
| [runtime-flows.md](C:/dev/projects/work/yxz-agent/docs/runtime-flows.md) | 正式运行流程 | 说明人工对话、定时任务、事件触发任务、任务记录上传、窗体关闭等链路 |
| [event-task-script-execution-design.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-execution-design.md) | 事件触发任务脚本执行方案 | 说明结构化脚本的执行边界、变量规则、条件循环、执行记录和上报结构 |
| [webapp-migration-plan.md](C:/dev/projects/work/yxz-agent/docs/webapp-migration-plan.md) | 前端迁移计划 | 说明如何将 `yxz-agent-webapp` 迁移到当前项目 |
| [react-ui-integration.md](C:/dev/projects/work/yxz-agent/docs/react-ui-integration.md) | 当前 React 接入说明 | 说明现有代码入口和短期接入方式 |

## 3. 支撑文档

| 文档 | 状态 | 说明 |
| --- | --- | --- |
| [thin-subprocess-window-agent-architecture.md](C:/dev/projects/work/yxz-agent/docs/thin-subprocess-window-agent-architecture.md) | 支撑设计 | 记录“子进程 + 窗体执行层 + 窗体展示层”的讨论过程和细节 |
| [webapp-design-integration.md](C:/dev/projects/work/yxz-agent/docs/webapp-design-integration.md) | 支撑设计 | 记录 `C:\dev\projects\work\yxz-agent-webapp` 如何并入当前项目设计 |
| [event-task-script-authoring-guide.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-authoring-guide.md) | 支撑规范 | 面向配置人员说明事件触发任务脚本的制作规则、工具写法和发布前检查项 |
| [event-task-script-js-runtime-design.md](C:/dev/projects/work/yxz-agent/docs/event-task-script-js-runtime-design.md) | 支撑设计 | 记录事件触发任务从 JSON DSL 迁移到受控 JS 脚本运行时的方案 |

正式文档与支撑文档冲突时，以正式文档为准；术语冲突时，以 [terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md) 为准。

## 4. 当前核心结论

- 产品采用“子进程 + 主窗体 + 任务子窗体 + 确认弹窗”的窗体模型。
- 子进程是常驻基础设施，不承担 MCP 工具能力，不承担智能体调度，不上传任务记录。
- 主窗体承载人工对话类业务会话。
- 任务子窗体承载定时任务和事件触发任务。
- 确认弹窗只负责待确认任务项的确认或忽略，不执行任务。
- 业务窗体内部拆分为执行层和展示层。
- MCP 工具能力、智能体调度、任务记录上传都归属业务窗体执行层。
- 事件触发任务的结构化脚本由任务子窗体执行层解释执行，子进程不解释脚本、不调用 MCP。
- 所有任务记录都由业务窗体执行层直接上传营小助智能体服务。
- 子进程只保留轻量任务摘要、配置、授权状态、待确认任务项和触发源等常驻状态。
- 当前没有后台执行方式，所有任务都由窗体承载。

## 5. 后续维护规则

- 新增设计文档前，先判断是否应该补充到现有正式文档。
- 已废弃或存在旧口径的文档放入 `docs/archive/`。
- 正式文档中避免使用旧术语，例如 DCF、Runtime、Channel、对话子窗体、后台任务。
- 代码字段和历史文件名可以保留英文或旧名，但文档正文必须使用规范中文术语。
