# .ai 索引

更新时间：2026-06-03

## HOT：默认读取

每次开始工作默认只读取：

1. `.ai/PROJECT_STATE.md`
2. `.ai/TODO.md`
3. `.ai/HANDOFF.md`

## WARM：按需读取

| 文档 | 什么时候读取 |
| --- | --- |
| `.ai/workflows/README.md` | 架构、重构、发布、排障、跨模块改动、复杂实现 |
| `.ai/skills/README.md` | 需要选择文档、前端、子进程、脚本 DSL 或测试策略 |
| `docs/formal-docs-index.md` | 涉及产品、架构、术语、正式文档或执行方案 |
| `docs/terminology.md` | 涉及命名、术语、正式对外表述 |
| `docs/event-task-script-execution-design.md` | 涉及事件触发任务脚本执行语义 |
| `docs/event-task-script-authoring-guide.md` | 涉及脚本配置、变量、条件、循环和工具表 |

## COLD：历史归档

| 文档 | 什么时候读取 |
| --- | --- |
| `.ai/archive/` | 仅追溯历史规则、旧读取顺序、已归档决策时读取 |
| `docs/archive/` | 仅追溯历史方案背景时读取，不作为当前设计约束 |

不要把 `.ai/archive/` 设为默认读取。
