# AGENTS.md

更新时间：2026-06-03

## 1. 入口规则

本文件是 AI 协作入口，目标是降低默认上下文占用，同时保留可恢复性。

默认只读取 HOT 文件：

1. `.ai/PROJECT_STATE.md`
2. `.ai/TODO.md`
3. `.ai/HANDOFF.md`

不要默认读取 `.ai/archive/`。

## 2. 分层读取

| 层级 | 文件 | 读取时机 |
| --- | --- | --- |
| HOT | `.ai/PROJECT_STATE.md` | 每次默认读取 |
| HOT | `.ai/TODO.md` | 每次默认读取 |
| HOT | `.ai/HANDOFF.md` | 每次默认读取 |
| WARM | `.ai/INDEX.md` | 需要找文档或判断读取范围 |
| WARM | `.ai/workflows/README.md` | 架构、重构、发布、排障、跨模块改动 |
| WARM | `.ai/skills/README.md` | 需要任务类型检查清单 |
| WARM | `docs/formal-docs-index.md` | 产品、架构、术语、正式文档 |
| COLD | `.ai/archive/` | 仅追溯历史规则或旧决策 |

## 3. 项目边界

项目是营小助智能体客户端工程，运行在开阳基座中。

核心模型：

- 子进程。
- 主窗体。
- 任务子窗体。
- 确认弹窗。
- 业务窗体执行层。
- 业务窗体展示层。

关键边界：

- 子进程只负责常驻触发、窗体唤起、平台接入、轻量持久化。
- 子进程不承担 MCP 工具能力。
- 子进程不执行智能体调度。
- 子进程不上传任务记录。
- 主窗体承载人工对话类业务会话。
- 任务子窗体承载定时任务和事件触发任务。
- MCP 调用、任务推进、运行事件、任务记录上传归属业务窗体执行层。
- 确认弹窗只负责确认或忽略，不执行任务。
- 事件触发任务结构化脚本由任务子窗体执行层解释执行。
- 脚本是 JSON DSL，不是任意 JS 代码。
- 工具结果必须显式声明 `output` 才进入变量上下文。
- 系统变量当前仅支持 `$_EVENT`。
- 条件和循环表达式使用 JSON Logic 对象。

## 4. 编码规则

- TypeScript 使用 `strict`。
- 共享协议优先放在 `share/`。
- 子进程服务放在 `subprocess/service/`。
- 前端窗体和组件放在 `webapp/src/`。
- 前端状态优先沿用 Zustand store。
- UI 优先沿用 Ant Design、styled-components 和 app theme。
- 展示层不直接调用营小助智能体服务、开阳基座或开阳 MCP。
- 正式文档术语遵守 `docs/terminology.md`。
- 正式设计入口是 `docs/formal-docs-index.md`。
- 旧代码字段可保留，正式文档正文避免旧术语 DCF、Runtime、Channel。
- 跨层事件和协议字段优先补 `share/protocol.ts`。
- 子进程实现保持依赖注入和可测试结构。
- 前端改动先确认当前路由、入口和 store。

## 5. 工作规则

- 修改前先执行或读取 `git status --short`。
- 不覆盖已有未提交改动。
- 优先做最小范围修改。
- 不确定产品含义、架构边界、协议字段、执行语义时先确认。
- 文档更新使用正式、对外可读口吻。
- 代码变更后运行最小相关验证。
- 阶段性完成后更新 `.ai/TODO.md` 或 `.ai/HANDOFF.md`。
- 已完成或过期内容归档到 `.ai/archive/`。
- 不把 `docs/archive/` 当作当前设计约束。
- `.ai` 与正式文档冲突时，以正式文档为准并更新 `.ai`。

## 6. 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run build:subprocess` | 编译 TypeScript |
| `npm run build:webapp` | 构建前端 |
| `npm test` | 构建并运行 Node 测试 |
| `npm run build` | 完整构建 |
| `npm run dev:webapp` | 启动前端开发服务 |

## 7. 排障提示

- 构建失败先区分本次改动和既有脏工作区。
- 文档口径冲突先查 `docs/formal-docs-index.md`。
- 术语冲突先查 `docs/terminology.md`。
- 脚本 DSL 冲突先查事件任务脚本文档。
