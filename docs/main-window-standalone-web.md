# 主窗体独立网页端说明

更新时间：2026-06-03

## 当前状态

主窗体人工对话主流程已调整为独立网页端模式：

- 主窗体创建和推进业务会话时，直接走网页端执行层。
- 主窗体不再依赖子进程来完成 `LIST_AGENTS`、`CREATE_SESSION`、`USER_MESSAGE`、`CANCEL_RUN` 主流程。
- 子进程桥接能力保留为可选增强，只用于调度、授权、确认弹窗等宿主相关能力。

## 固定端口

当前默认固定端口如下：

- `yxz-agent` 主窗体网页端开发服务：`http://127.0.0.1:5174`
- `yxz-agent-webapp` 调试前端：`http://127.0.0.1:5173`
- `yxz-agent-webapp` 模拟后端服务：`http://127.0.0.1:8787`
- `yxz-agent-webapp` 模拟 MCP 服务：`http://127.0.0.1:8791`

前端开发服务已启用 `strictPort`，端口被占用时会直接报错，不再自动漂移到其他端口。

## 主流程

当前主窗体网页端主流程为：

1. 页面本地创建草稿会话。
2. 用户首条消息发送时，网页端直接创建正式业务会话。
3. 网页端直接请求会话流式接口。
4. 网页端直接调用 MCP 服务。
5. 工具结果在页面内回显。
6. 宿主未连接时，不影响人工对话主流程。

## 运行时配置

网页端运行时配置通过全局变量注入：

```ts
globalThis.__YXZ_WEBAPP_CONFIG__ = {
  assistantCreateUrl: "http://127.0.0.1:8787/api/conversations/create",
  assistantStreamUrl: "http://127.0.0.1:8787/api/conversations/:conversationId/stream",
  assistantReportUrl: "http://127.0.0.1:8787/api/conversations/:conversationId/report",
  mcpBaseUrl: "http://127.0.0.1:8791/api/v1/mcp",
}
```

如果没有显式注入，主窗体会默认连接本机模拟服务：

- 会话接口默认使用 `http://127.0.0.1:8787`
- MCP 默认使用 `http://127.0.0.1:8791/api/v1/mcp`

这组默认地址用于对接 `C:\dev\projects\work\yxz-agent-webapp` 中的模拟后端和模拟 MCP。

## 保留的宿主能力

以下能力仍然可以通过宿主桥接增强，但不再阻断主窗体人工对话：

- 自动执行授权
- 定时任务状态读取
- 启用/停用定时任务
- 立即触发定时任务
- 确认弹窗相关链路

## 当前边界

- 主窗体已经能独立作为完整网页端运行。
- 调度和确认弹窗仍属于宿主增强能力，不属于网页端强依赖。
- 任务子窗体和确认弹窗的宿主链路暂不在这次改造范围内。
