# HANDOFF

更新时间：2026-06-03

## 下一次接手必读

1. `.ai/PROJECT_STATE.md`
2. `.ai/TODO.md`
3. `.ai/INDEX.md`

## 当前接手重点

- `.ai` 工作流已改为 HOT/WARM/COLD 三层。
- 默认读取不包含 `.ai/archive/`。
- 当前正式架构要求子进程保持轻量，不承担 MCP、脚本执行、任务记录上传。
- 事件触发任务脚本方案已在 `docs/` 下正式化。
- `webapp` 迁移已经进入“执行层接线”阶段，不再只是 UI 骨架。
- 当前主窗体真实可用的是最小正式会话协议；真实营小助服务和正式 MCP 还没接入。

## 最近动作

- 创建 `.ai/INDEX.md`。
- 新增 HOT 文件：`.ai/PROJECT_STATE.md`、`.ai/TODO.md`、`.ai/HANDOFF.md`。
- 将初始长版工作流摘要归档到 `.ai/archive/2026-06-03-initial-ai-workflow.md`。
- 把 `webapp` 主窗体工作台、状态拆分、Vite 构建链路迁入当前仓库。
- 打通 `LIST_AGENTS / LIST_SESSIONS / CREATE_SESSION / GET_SESSION_DETAIL / USER_MESSAGE / CANCEL_RUN` 前后端链路。
- 新增主窗体执行层骨架：`chat-client`、`stream-parser`、`mcp-client`、`mcp-adapter`、`task-record-uploader`。
- 修复过渡会话运行时的流式分片重复问题，并新增 `tests/webappExecutionLayer.test.ts`。
- 当前测试状态：`npm test` 通过，`50/50`。

## 仍需确认

- 任务子窗体关闭时，等待队列是否全部丢弃。
- 任务记录上传失败是否需要业务窗体执行层本地重试。
- 主窗体和任务子窗体是否共用同一套执行层基础库。
- 开阳 MCP 完整工具清单。
- 主窗体真实营小助服务调用最终是仍经子进程代理，还是改为窗体执行层直连正式接口。
