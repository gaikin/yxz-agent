# 营小助功能模块拆分

## 一、目的

本文档用于将早期“助手子窗体 + 营小助 DCF 子进程”方案拆分为可独立实施的功能模块，便于排期、分工和并行开发。

> 状态说明：本文是早期模块拆分文档，保留用于排期和迁移参考。当前正式术语以 [terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md) 为准，当前架构方向以 [thin-subprocess-window-agent-architecture.md](C:/dev/projects/work/yxz-agent/docs/thin-subprocess-window-agent-architecture.md) 为准。后续重写时，应将旧口径统一收敛为“子进程、主窗体、任务子窗体、执行层、展示层、开阳基座通信、运行事件分发”。

整体分层重构口径优先见：[thin-subprocess-window-agent-architecture.md](C:/dev/projects/work/yxz-agent/docs/thin-subprocess-window-agent-architecture.md)

术语规范见：[terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md)

分层拆解草案见：[layered-architecture-refactor.md](C:/dev/projects/work/yxz-agent/docs/layered-architecture-refactor.md)

总方案见：[agent-chat-architecture.md](C:/dev/projects/work/yxz-agent/docs/agent-chat-architecture.md)  
详细设计见：[dcf-frontend-detailed-design.md](C:/dev/projects/work/yxz-agent/docs/dcf-frontend-detailed-design.md)

## 二、拆分原则

- 以职责边界为主，不按文件零散拆分
- 前端与 DCF 子进程分开拆分
- 协议定义单独成块，优先完成
- 定时任务与人工对话复用执行链路，但在实施上拆开推进
- 每个模块都应有清晰输入、输出和依赖
- 所有功能模块都应支持独立引入，只保留必要耦合
- 模块之间只通过公开接口、事件或共享协议协作，避免依赖彼此内部实现
- UI 模块不直接调用执行、解析、上报等业务实现，只订阅状态并触发命令
- 运行时模块不反向依赖具体 UI 框架
- 工具执行模块不依赖具体业务场景，只根据标准输入执行并返回结果

## 三、模块总览

建议拆分为 4 个实施面和 2 个公共层。

### 3.1 实施面

1. 助手子窗体 UI 面
2. 助手子窗体状态与通信面
3. DCF 子进程运行与开阳接入面
4. DCF 子进程调度与执行面

### 3.2 公共层

1. 共享协议层
2. 场景联调层

## 四、详细模块拆分

### 4.1 助手子窗体 UI 面

目标：完成用户可见交互界面。

模块清单：

- `chat-shell`
  - 职责：主对话区容器、消息输入、发送、取消
  - 输入：`chat.store`、`run.store`
  - 输出：`user_message`、`cancel_run`

- `history-session-list`
  - 职责：展示历史会话摘要列表并支持切换
  - 输入：`chat.store`
  - 输出：`get_session_detail`

- `agent-list`
  - 职责：展示左下角智能体列表并发起创建会话
  - 输入：`chat.store`
  - 输出：`create_session`

- `run-step-panel`
  - 职责：展示执行步骤和阶段状态
  - 输入：`run.store`
  - 输出：无

- `schedule-entry`
  - 职责：展示固定入口“定时任务”并打开轻量面板
  - 输入：`schedule.store`
  - 输出：无

- `schedule-panel`
  - 职责：展示定时任务信息和启用/关闭入口
  - 输入：`schedule.store`
  - 输出：`schedule_enable`、`schedule_disable`

- `automation-authorization-modal`
  - 职责：展示统一自动执行授权弹窗
  - 输入：`schedule.store.automationAuthorization`
  - 输出：`authorize_automation`

### 4.2 助手子窗体状态与通信面

目标：完成助手子窗体内部状态管理和与 DCF 的消息通信。

模块清单：

- `chat.store`
  - 职责：维护智能体列表、历史会话摘要、当前会话详情和当前选择智能体
  - 输入：`list_agents`、`list_sessions`、`get_session_detail`、`session_created`、`user_message`、`assistant_done`
  - 输出：供 UI 读取

- `run.store`
  - 职责：维护运行步骤、流式输出、执行状态
  - 输入：`run_started`、`step_started`、`step_finished`、`assistant_delta`
  - 输出：供 UI 读取

- `schedule.store`
  - 职责：维护统一自动执行授权状态、DCF 启动状态、定时任务状态和轻量面板状态
  - 输入：`bootstrap_state`、`automation_authorized`、`schedule_state_snapshot`、`schedule_enabled`、`schedule_disabled`
  - 输出：供 UI 读取

- `assistant-window-channel-client`
  - 职责：基于 `window.BridgeJs.listen` 和 `window.BridgeJs.sendToWindow` 与 DCF 子进程建立通信
  - 输入：UI 发起的交互事件
  - 输出：DCF 返回的事件

- `frontend-event-handler-registry`
  - 职责：以装饰器方式注册 DCF 侧前端事件 handler，并完成按事件类型分发
  - 输入：反序列化后的前端事件
  - 输出：对应 handler 调用

- `event-dispatcher`
  - 职责：把 DCF 返回事件分发到各 store
  - 输入：DCF 事件流
  - 输出：store 更新动作

### 4.3 DCF 子进程运行与开阳接入面

目标：完成 DCF 启动、授权、开阳连接和 `eventHook` 订阅。

模块清单：

- `bootstrap`
  - 职责：DCF 启动总控
  - 输入：本地配置
  - 输出：初始化状态

- `auth-manager`
  - 职责：向开阳授权并管理 `accessToken`
  - 输入：授权请求
  - 输出：`accessToken`

- `kaiyang-client`
  - 职责：统一封装所有开阳请求
  - 输入：工具调用、资源读取、订阅请求
  - 输出：开阳响应

- `healthcheck`
  - 职责：开阳可用性检查
  - 输入：`accessToken`
  - 输出：健康状态

- `event-hook-subscriber`
  - 职责：订阅开阳 `eventHook`
  - 输入：`accessToken`
  - 输出：原始事件流

- `event-hook-normalizer`
  - 职责：将原始事件转为内部标准事件
  - 输入：原始 `eventHook`
  - 输出：内部事件

- `toolset-cache`
  - 职责：缓存当前工具集并处理刷新
  - 输入：`tools/list`、工具集变更事件
  - 输出：工具集快照

### 4.4 DCF 子进程调度与执行面

目标：完成定时任务加载、`cron` 调度、启用授权、任务执行和本地记录。

模块清单：

- `schedule-loader`
  - 职责：加载本地内置定时任务配置
  - 输入：本地配置文件
  - 输出：任务定义列表

- `schedule-store`
  - 职责：保存任务启用状态、授权状态、最近执行状态
  - 输入：启用/关闭/执行结果
  - 输出：任务运行状态

- `schedule-run-record-store`
  - 职责：保存每次定时任务执行记录
  - 输入：步骤流、执行结果
  - 输出：任务执行记录

- `schedule-pending-execution-store`
  - 职责：保存待确认执行项和待执行概览
  - 输入：到点触发、确认结果、忽略结果、执行结果
  - 输出：待确认执行项与概览

- `scheduler-manager`
  - 职责：使用 `cron-parser` 计算 `nextTriggerAt`，并以 `setTimeout` 方式注册与注销任务
  - 输入：已启用任务
  - 输出：到点触发事件

- `authorization-queue`
  - 职责：管理统一自动执行授权状态持久化
  - 输入：`authorize_automation`
  - 输出：`automation_authorized`

- `schedule-skill-registry`
  - 职责：维护 `skillId -> skill` 映射
  - 输入：内置 skill 定义
  - 输出：可执行 skill

- `schedule-skill-runner`
  - 职责：执行定时任务对应 skill，生成页面原子命令并收敛结果
  - 输入：`scheduleId`、任务定义、运行上下文
  - 输出：执行结果、步骤记录

- `popup-channel-server`
  - 职责：向独立右下角弹窗推送待执行概览，并接收批量确认结果
  - 输入：待执行概览、弹窗确认事件
  - 输出：批量确认请求

- `backend-gateway-client`
  - 职责：与后端 Agent Gateway 通信
  - 输入：会话管理请求、转发消息、执行结果
  - 输出：后端事件

- `tool-executor`
  - 职责：执行 `openMenu`、`executePageCommands`
  - 输入：后端下发工具调用
  - 输出：`tool_result`

- `resource-reader`
  - 职责：读取 `/tabs/shcema/lowCode`
  - 输入：后端下发资源读取请求
  - 输出：`resource_result`

- `run-guard`
  - 职责：控制同一任务短时间重复触发和同一 run 重复提交
  - 输入：新的执行请求
  - 输出：允许执行或拒绝执行

## 五、公共层

### 5.1 共享协议层

目标：统一所有模块间的事件和数据结构。

模块：

- [protocol.ts](C:/dev/projects/work/yxz-agent/share/protocol.ts)

优先级：

- 必须最先收敛

覆盖范围：

- 助手子窗体 <-> DCF
- DCF <-> 后端

### 5.2 场景联调层

目标：围绕 3040 当日查询形成端到端可验证链路。

内容：

- 人工对话触发联调
- 定时任务启用授权联调
- `cron` 到点自动执行联调

## 六、推荐实施顺序

建议按以下顺序推进：

1. 共享协议层
2. DCF 子进程运行与开阳接入面
3. DCF 子进程调度与执行面
4. 助手子窗体状态与通信面
5. 助手子窗体 UI 面
6. 场景联调层

## 七、可并行拆分建议

### A 组：助手子窗体 UI

- `chat-shell`
- `schedule-entry`
- `run-step-panel`
- `schedule-panel`
- `automation-authorization-modal`

### B 组：助手子窗体状态与通信

- `chat.store`
- `run.store`
- `schedule.store`
- `assistant-window-channel-client`
- `event-dispatcher`

### C 组：DCF 启动与开阳接入

- `bootstrap`
- `auth-manager`
- `kaiyang-client`
- `healthcheck`
- `event-hook-subscriber`
- `event-hook-normalizer`
- `toolset-cache`

### D 组：DCF 调度与执行

- `schedule-loader`
- `schedule-store`
- `scheduler-manager`
- `authorization-queue`
- `backend-gateway-client`
- `tool-executor`
- `resource-reader`
- `run-guard`

### E 组：协议与联调

- `share/protocol.ts`
- mock 数据
- 联调脚本

## 八、MVP 最小交付

如果先做最小可交付版本，建议优先完成以下模块：

- 助手子窗体
  - `chat-shell`
  - `schedule-entry`
  - `run-step-panel`
  - `schedule-panel`
- `automation-authorization-modal`
  - `chat.store`
  - `run.store`
  - `schedule.store`
  - `assistant-window-channel-client`

- DCF 子进程
  - `bootstrap`
  - `auth-manager`
  - `kaiyang-client`
  - `event-hook-subscriber`
  - `schedule-loader`
  - `schedule-store`
  - `scheduler-manager`
  - `authorization-queue`
  - `backend-gateway-client`
  - `tool-executor`
  - `resource-reader`

- 公共层
  - `share/protocol.ts`
