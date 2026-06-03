# .ai 工作流系统

更新时间：2026-06-03

## 分层

- HOT：每次默认读取，短且可恢复。
- WARM：按需读取，用于复杂任务。
- COLD：历史归档，不默认读取。

## 默认读取

每次默认只读取：

1. `.ai/PROJECT_STATE.md`
2. `.ai/TODO.md`
3. `.ai/HANDOFF.md`

完整索引见 `.ai/INDEX.md`。

## 按需读取

- 架构、重构、发布、排障：读 `.ai/workflows/README.md`。
- 技能选择和检查清单：读 `.ai/skills/README.md`。
- 产品、架构、术语、正式文档：读 `docs/formal-docs-index.md`。
- 历史追溯：读 `.ai/archive/`，但不要设为默认读取。

## 维护

- HOT 文件只保留恢复当前工作所需信息。
- 已完成事项和历史规则进入 `.ai/archive/`。
- `.ai` 与正式设计冲突时，以正式设计为准，并更新 `.ai`。
