# AI 工作流（WARM）

更新时间：2026-06-03

本文件按需读取。仅在架构、重构、发布、排障、跨模块改动或复杂实现时读取。

## 1. 通用开发

1. 读取 HOT：`.ai/PROJECT_STATE.md`、`.ai/TODO.md`、`.ai/HANDOFF.md`。
2. 执行 `git status --short`，确认已有改动。
3. 读取任务相关正式文档和代码。
4. 判断是否需要确认需求。
5. 按最小范围修改。
6. 运行最小相关验证。
7. 更新 `.ai/TODO.md` 或 `.ai/HANDOFF.md`。

## 2. 文档更新工作流

1. 先读 `docs/formal-docs-index.md`。
2. 再读 `docs/terminology.md`。
3. 判断目标内容应更新正式文档、支撑文档还是 archive。
4. 正式文档使用对外正式介绍口吻。
5. 只把 archive 作为背景材料，不直接继承旧口径。
6. 更新索引或相关引用。
7. 用 `rg` 检查旧术语和冲突表述。

常用检查：

```text
rg -n "DCF|Runtime|Channel|后台任务|任务执行窗口|pendingTriggers|callbackUrl" docs
```

## 3. 前端开发工作流

1. 确认目标窗体：主窗体、任务子窗体或确认弹窗。
2. 读取对应 `webapp/src/` 入口、组件和 store。
3. 确认展示层和执行层边界。
4. 按现有 UI 样式和状态管理方式实现。
5. 运行 `npm run build:webapp`。
6. 如涉及交互路径，补充或更新测试。

## 4. 子进程服务工作流

1. 读取 `docs/system-architecture.md` 和 `docs/runtime-flows.md`。
2. 确认改动是否属于子进程常驻能力。
3. 修改 `share/` 协议时同步更新发送方、接收方和测试。
4. 修改服务时保持依赖注入和可测试结构。
5. 运行 `npm test` 或最小相关测试。

## 5. 脚本 DSL 工作流

1. 读取 `docs/event-task-script-execution-design.md`。
2. 读取 `docs/event-task-script-authoring-guide.md`。
3. 明确本次改动属于模型、表达式、变量、工具调用、上报还是校验。
4. 服务端静态校验与执行层防御性检查分开设计。
5. 不引入任意 JS 执行。
6. 保持串行、快速失败、可观测。
7. 更新示例和发布前检查项。

## 6. 交接

每次完成阶段性工作后，更新 `.ai/HANDOFF.md`：

- 本轮做了什么。
- 改了哪些文件。
- 哪些验证已运行。
- 哪些问题仍需确认。
- 下一步建议从哪里开始。
