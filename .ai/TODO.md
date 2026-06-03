# TODO

更新时间：2026-06-03

只保留当前活跃任务；历史和已完成事项归档到 `.ai/archive/`。

| 优先级 | 事项 | 状态 | 读取 |
| --- | --- | --- | --- |
| P1 | 把主窗体最小会话回复替换为真实营小助服务调用 | 待办 | `docs/runtime-flows.md` |
| P1 | 把 `mcp-client` 和 `mcp-adapter` 接到正式开阳 MCP 链路 | 待办 | `docs/system-architecture.md` |
| P1 | 明确主窗体和任务子窗体执行层基础库复用边界 | 待确认 | `docs/system-architecture.md` |
| P1 | 对齐事件触发任务脚本实现与正式方案 | 进行中 | `docs/event-task-script-execution-design.md` |
| P2 | 建立任务记录真实上传链路并决定失败重试策略 | 待确认 | `docs/runtime-flows.md` |
| P2 | 处理前端大 chunk 告警，做路由或组件拆包 | 待办 | `webapp/vite.config.ts` |
| P2 | 补充完整开阳 MCP 工具清单 | 待确认 | `docs/event-task-script-authoring-guide.md` |

维护规则：新增任务必须可执行；完成后移出 HOT，必要背景写入 `.ai/archive/`。
