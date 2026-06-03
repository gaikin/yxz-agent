# 初始 AI 工作流归档

归档时间：2026-06-03

## 归档原因

初始 `.ai` 工作流和根目录协作文件信息较完整，但默认读取链路偏长。为降低默认上下文占用，将历史说明、完整技能清单、通用工作流和旧读取顺序归档到本文。

归档内容不作为默认读取内容；需要追溯初始约定时再读取。

## 归档前行数

| 文件 | 行数 | 用途 |
| --- | ---: | --- |
| `AGENTS.md` | 45 | AI 协作入口、读取顺序、开发命令和编码规范 |
| `PROJECT_STATE.md` | 60 | 项目状态、技术栈、架构、风险 |
| `TODO.md` | 17 | 当前待办和工作流待办 |
| `HANDOFF.md` | 29 | 交接摘要、重点上下文、待确认问题 |
| `.ai/README.md` | 31 | `.ai` 目录说明、旧默认读取顺序 |
| `.ai/skills/README.md` | 55 | 文档、子进程、前端、脚本 DSL、测试技能清单 |
| `.ai/workflows/README.md` | 50 | 通用、文档、前端、子进程、脚本、交接工作流 |

## 归档内容摘要

### 初始默认读取顺序

1. `.ai/README.md`
2. `.ai/workflows/README.md`
3. `.ai/skills/README.md`
4. `PROJECT_STATE.md`
5. `TODO.md`
6. `HANDOFF.md`
7. `docs/formal-docs-index.md`

该读取顺序已废弃，新的默认读取顺序见 `.ai/INDEX.md`。

### 初始核心规则

- 后续所有 AI 工作优先读取 `.ai`。
- 正式文档术语遵守 `docs/terminology.md`。
- 正式设计入口为 `docs/formal-docs-index.md`。
- 子进程不承担 MCP 工具能力。
- 展示层不直接调用营小助智能体服务、开阳基座或开阳 MCP。
- 修改前检查工作区状态，避免覆盖已有改动。
- 不确定的产品含义、架构边界、协议字段和执行语义先确认。
- 代码变更后优先运行最小相关验证。

### 初始 TODO 全量归档

| 优先级 | 事项 | 原状态 | 归档原因 |
| --- | --- | --- | --- |
| P0 | 固化 `.ai` 工作流读取约定 | 已完成 | 已完成，不保留在 HOT |
| P0 | 保持正式文档口径一致 | 进行中 | 转为常规维护规则，不作为当前活跃任务 |
| P1 | 对齐事件触发任务脚本实现与正式方案 | 待办 | 仍保留在 `.ai/TODO.md` |
| P1 | 梳理任务子窗体执行层基础库复用方式 | 待确认 | 仍保留在 `.ai/TODO.md` |
| P1 | 明确任务子窗体关闭时等待队列策略 | 待确认 | 仍保留在 `.ai/TODO.md` |
| P2 | 补充完整开阳 MCP 工具清单 | 待确认 | 仍保留在 `.ai/TODO.md` |
| P2 | 为前端迁移补充稳定验证清单 | 待办 | 非当前活跃任务，归档 |
| P2 | 评估任务记录上传失败的本地重试策略 | 待确认 | 作为交接问题保留，不放 HOT TODO |

### 根目录文件处理

- `AGENTS.md` 保留为根目录唯一 AI 协作入口。
- `PROJECT_STATE.md` 已删除，权威状态迁移到 `.ai/PROJECT_STATE.md`。
- `TODO.md` 已删除，权威待办迁移到 `.ai/TODO.md`。
- `HANDOFF.md` 已删除，权威交接迁移到 `.ai/HANDOFF.md`。
- 默认读取链路为 `.ai/PROJECT_STATE.md`、`.ai/TODO.md`、`.ai/HANDOFF.md`。

### 初始技能清单

文档设计：

- 更新正式设计文档、梳理架构、归档旧口径时使用。
- 先读 `docs/formal-docs-index.md` 和 `docs/terminology.md`。
- archive 只作背景，不作为当前约束。

子进程服务：

- 修改 `subprocess/service/`、定时任务、事件接入、通道服务、轻量持久化时使用。
- 子进程不承担 MCP、不上传任务记录、只保留轻量状态和触发摘要。
- 跨窗体通信语义优先使用共享协议类型。

前端窗体：

- 修改 `webapp/src/`、主窗体、任务子窗体、确认弹窗、展示组件或状态管理时使用。
- 展示层通过用户指令和运行事件与执行层交互。
- 状态管理优先沿用 Zustand store。
- UI 风格优先沿用 Ant Design、styled-components 和 app theme。

脚本 DSL：

- 修改事件触发任务脚本设计、制作规范或实现时使用。
- 先读 `docs/event-task-script-execution-design.md`。
- 脚本是 JSON DSL，不是 JS 代码。
- 系统变量当前仅支持 `$_EVENT`。
- 工具结果必须显式声明 `output` 才进入变量上下文。
- 条件和循环表达式使用 JSON Logic 对象。
- `beforeDelayMs` 可取消，中止时返回 `USER_CANCELED`。

测试与验证：

- 修改核心服务、协议、调度、执行层或共享类型时使用。
- 优先运行最小相关测试。
- 跨层协议变更运行 `npm test`。
- 前端构建变更运行 `npm run build:webapp`。
- 整体打包影响运行 `npm run build`。

### 初始工作流

通用开发：

1. 读取 `.ai/README.md`、`.ai/skills/README.md`、`PROJECT_STATE.md`。
2. 执行 `git status --short`。
3. 读取任务相关正式文档和代码。
4. 判断是否需要确认需求。
5. 按最小范围修改。
6. 运行最小相关验证。
7. 更新 `TODO.md` 或 `HANDOFF.md`。

文档更新：

1. 先读 `docs/formal-docs-index.md`。
2. 再读 `docs/terminology.md`。
3. 判断目标内容应更新正式文档、支撑文档还是 archive。
4. 正式文档使用对外正式介绍口吻。
5. 只把 archive 作为背景材料，不直接继承旧口径。
6. 更新索引或相关引用。
7. 用 `rg` 检查旧术语和冲突表述。

前端开发：

1. 确认目标窗体。
2. 读取对应 `webapp/src/` 入口、组件和 store。
3. 确认展示层和执行层边界。
4. 按现有 UI 样式和状态管理方式实现。
5. 运行 `npm run build:webapp`。
6. 如涉及交互路径，补充或更新测试。

子进程服务：

1. 读取 `docs/system-architecture.md` 和 `docs/runtime-flows.md`。
2. 确认改动是否属于子进程常驻能力。
3. 修改 `share/` 协议时同步更新发送方、接收方和测试。
4. 修改服务时保持依赖注入和可测试结构。
5. 运行 `npm test` 或最小相关测试。

脚本 DSL：

1. 读取 `docs/event-task-script-execution-design.md`。
2. 读取 `docs/event-task-script-authoring-guide.md`。
3. 明确改动属于模型、表达式、变量、工具调用、上报还是校验。
4. 服务端静态校验与执行层防御性检查分开设计。
5. 不引入任意 JS 执行。
6. 保持串行、快速失败、可观测。
7. 更新示例和发布前检查项。

交接：

- 本轮做了什么。
- 改了哪些文件。
- 哪些验证已运行。
- 哪些问题仍需确认。
- 下一步建议从哪里开始。
