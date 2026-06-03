# 营小助开发任务清单

## 一、目的

本文档用于将“助手子窗体 + 营小助 DCF 子进程”方案拆分为可排期、可分工、可验收的开发任务。

相关文档：

- 总方案：[agent-chat-architecture.md](C:/dev/projects/work/yxz-agent/docs/agent-chat-architecture.md)
- 详细设计：[dcf-frontend-detailed-design.md](C:/dev/projects/work/yxz-agent/docs/dcf-frontend-detailed-design.md)
- 模块拆分：[module-breakdown.md](C:/dev/projects/work/yxz-agent/docs/module-breakdown.md)
- 协议定义：[protocol.ts](C:/dev/projects/work/yxz-agent/share/protocol.ts)

## 二、实施范围

本次迭代包含以下能力：

- 助手子窗体支持人工对话触发 3040 当日查询
- 助手子窗体支持左下角智能体列表、历史会话摘要列表和单主对话区
- 助手子窗体支持通过固定入口“定时任务”启用、关闭当前预置的定时任务
- 用户首次打开子窗体时完成统一自动执行授权，授权后按 `cron` 自动执行
- DCF 子进程完成开阳授权、`eventHook` 订阅、工具调用和资源读取

本次迭代不包含以下能力：

- 定时任务新增、编辑、删除
- 后端内部编排实现
- 多场景扩展

## 三、里程碑划分

建议分为 5 个里程碑：

1. 协议与骨架就绪
2. DCF 初始化与开阳接入打通
3. 定时任务启用授权与本地调度打通
4. 助手子窗体交互打通
5. 3040 场景端到端联调

## 四、任务清单

### M1 协议与骨架就绪

#### T1 统一协议定义

- 目标：收敛助手子窗体与 DCF、DCF 与后端之间的事件定义
- 输入：详细设计、现有 [protocol.ts](C:/dev/projects/work/yxz-agent/share/protocol.ts)
- 输出：
  - `FrontendToDcfEvent`
  - `DcfToFrontendEvent`
  - `DcfToBackendEvent`
  - `BackendToDcfEvent`
- 验收标准：
  - 人工触发链路事件完整
  - 会话管理链路事件完整
  - 智能体列表链路事件完整
  - 定时任务启用授权链路事件完整
  - 3040 skill 与页面原子命令相关类型完整
  - 助手子窗体 <-> DCF 事件名统一为全大写、下划线分隔

#### T2 建立工程目录骨架

- 目标：创建助手子窗体和 DCF 子进程的基础目录结构
- 输出：
  - `frontend/`
  - `dcf-subprocess/`
  - `share/`
- 验收标准：
  - 目录结构与详细设计一致
  - 关键占位文件可正常引用共享协议

### M2 DCF 初始化与开阳接入打通

#### T3 实现配置加载与启动入口

- 目标：完成 DCF 启动入口和基础配置加载
- 负责模块：
  - `runtime/bootstrap.ts`
  - `runtime/config-loader.ts`
- 验收标准：
  - DCF 启动后可完成初始化流程编排
  - 配置缺失时返回明确错误
  - DCF 初始化异常时可记录结构化埋点

#### T4 实现开阳授权管理

- 目标：DCF 启动时向开阳授权并获取 `accessToken`
- 负责模块：
  - `kaiyang/auth-manager.ts`
  - `kaiyang/kaiyang-client.ts`
- 验收标准：
  - 能成功获取并缓存 `accessToken`
  - 后续请求自动携带 `accessToken`
  - 授权失败时可返回结构化错误

#### T5 实现健康检查与工具集拉取

- 目标：完成开阳健康检查、`tools/list` 拉取和工具集缓存
- 负责模块：
  - `kaiyang/healthcheck.ts`
  - `kaiyang/toolset-cache.ts`
- 验收标准：
  - DCF 完成健康检查
  - 能获取工具集快照
  - 工具集可在内存中缓存

#### T6 实现 eventHook 订阅

- 目标：完成开阳 `eventHook` 订阅和内部标准化
- 负责模块：
  - `kaiyang/event-hook-subscriber.ts`
  - `kaiyang/event-hook-normalizer.ts`
- 验收标准：
  - 初始化完成后自动订阅 `eventHook`
  - 可接收原始事件
  - 可转换为内部标准事件

#### T7 实现 DCF 与后端网关通信

- 目标：建立 DCF 与后端之间的消息收发能力
- 负责模块：
  - `gateway/backend-gateway-client.ts`
- 验收标准：
  - 可向后端发送 `hello`、`tool_result`、`resource_result`
  - 可向后端发送 `create_session`、`list_agents`、`list_sessions`、`get_session_detail`
  - 可接收后端下发的 `execute_tool`、`read_resource`

### M3 定时任务启用授权与本地调度打通

#### T8 实现本地定时任务配置加载

- 目标：加载本地内置定时任务定义
- 负责模块：
  - `scheduler/schedule-loader.ts`
- 验收标准：
  - 可读取内置任务列表
  - 任务数据结构包含 `scheduleId`、`cronExpression`、`timezone`、`skillId`

#### T9 实现定时任务运行状态存储

- 目标：保存任务启用状态、授权状态和最近执行结果
- 负责模块：
  - `scheduler/schedule-runtime-store.ts`
- 验收标准：
  - 支持读取任务摘要
  - 支持更新 `enabled`、`lastStatus`、`nextTriggerAt`、`lastRunId`

#### T9.1 实现待确认执行项存储

- 目标：保存定时任务待确认执行项与概览状态
- 负责模块：
  - `scheduler/schedule-pending-execution-store.ts`
- 验收标准：
  - 可新增待确认执行项
  - 可按当前待确认项生成概览
  - 可更新 `pending / confirmed / running / completed / failed / skipped` 状态

#### T10 实现统一自动执行授权流程

- 目标：支持“首次打开子窗体 -> 统一授权 -> 后续可启用定时任务”
- 负责模块：
  - `scheduler/authorization-queue.ts`
  - `gateway/frontend-channel-server.ts`
  - `gateway/frontend-event-publisher.ts`
  - `gateway/frontend-event-handler-registry.ts`
- 验收标准：
  - DCF 可返回 `BOOTSTRAP_STATE`
  - 收到 `AUTHORIZE_AUTOMATION` 后可持久化统一授权状态
  - 收到授权确认后可返回 `AUTOMATION_AUTHORIZED`
  - DCF 前端事件处理使用装饰器风格注册，不使用大 `switch(type)`

#### T11 实现 cron 调度器

- 目标：基于 `cron-parser` 计算 `nextTriggerAt` 并注册、触发已启用任务
- 负责模块：
  - `scheduler/scheduler-manager.ts`
- 验收标准：
  - 基于 `cron-parser` 正确计算下一次执行时间
  - 将 `nextTriggerAt` 回写到任务运行状态
  - 仅已启用任务进入调度
  - 关闭任务时可注销调度
  - 到点后可触发一次本地 skill 执行

#### T12 实现定时任务运行保护

- 目标：避免同一任务短时间重复触发和同一 run 重复提交
- 负责模块：
  - `gateway/run-guard.ts`
- 验收标准：
  - 相同任务执行中再次触发时可拒绝或跳过
  - 拒绝结果可记录为结构化状态

#### T13 实现定时任务 skill 注册与执行器

- 目标：支持按 `skillId` 执行本地 skill，并收敛执行结果
- 负责模块：
  - `scheduler/schedule-skill-registry.ts`
  - `scheduler/schedule-skill-runner.ts`
  - `scheduler/schedule-run-record-store.ts`
- 验收标准：
  - 能根据 `skillId` 找到并执行对应 skill
  - 能记录步骤流和最终结果
  - 执行失败时能返回结构化错误并落本地记录

#### T13.1 实现右下角执行确认弹窗通道

- 目标：支持独立右下角弹窗展示待执行概览，并一次确认多条待执行任务
- 负责模块：
  - `channel/popup-channel-server.ts`
  - `channel/popup-event-publisher.ts`
  - `channel/popup-event-handler-registry.ts`
- 验收标准：
  - 到点后可向右下角弹窗推送 `SCHEDULE_EXECUTION_OVERVIEW_UPDATED`
  - 可接收 `CONFIRM_ALL_SCHEDULE_EXECUTIONS`
  - 可接收 `DISMISS_ALL_SCHEDULE_EXECUTIONS`
  - 被确认的待执行项默认串行执行
  - 过期时间机制暂列为待确认事项，本阶段不实现
  - 点击 `全部执行` 时仅放行当前待执行项快照，执行中新增项留待下一轮确认
  - 执行中态不允许忽略或关闭弹窗，队列执行完后自动关闭

### M4 助手子窗体交互打通

#### T14 实现助手子窗体通信客户端

- 目标：建立助手子窗体与 DCF 的消息通信能力
- 负责模块：
  - `services/assistant-window-channel-client.ts`
- 验收标准：
  - 基于 `window.BridgeJs.listen` 和 `window.BridgeJs.sendToWindow` 完成封装
  - 可发送 `CREATE_SESSION`、`LIST_AGENTS`、`LIST_SESSIONS`、`GET_SESSION_DETAIL`
  - 可发送 `USER_MESSAGE`
  - 可发送 `AUTHORIZE_AUTOMATION`、`SCHEDULE_ENABLE`、`SCHEDULE_DISABLE`、`SCHEDULE_STATE`
  - 可接收 DCF 推送事件

#### T15 实现事件分发器

- 目标：将 DCF 事件分发到各 store
- 负责模块：
  - `services/event-dispatcher.ts`
- 验收标准：
  - 会话事件正确进入 `chat.store`、`run.store`
  - 启动状态与定时任务事件正确进入 `schedule.store`

#### T16 实现会话与步骤状态管理

- 目标：完成消息区和步骤区所需状态
- 负责模块：
  - `stores/chat.store.ts`
  - `stores/run.store.ts`
- 验收标准：
  - 可展示智能体列表
  - 可展示历史会话摘要列表
  - 支持点击创建会话并由后端分配 `sessionId`
  - 可展示人工触发消息流
  - 可展示 `run_started`、`step_started`、`step_finished`
  - 可展示最终助手回复

#### T17 实现定时任务状态管理

- 目标：完成统一自动执行授权状态、定时任务状态和轻量面板所需状态
- 负责模块：
  - `stores/schedule.store.ts`
- 验收标准：
  - 可维护统一自动执行授权状态
  - 可维护 DCF 启动就绪状态
  - 可维护定时任务状态
  - 可维护轻量面板开关状态
  - 可展示统一自动执行授权弹窗状态
  - 初始化异常和定时任务相关异常仅展示友好提示文案，不透出底层技术细节

#### T18 实现助手子窗体 UI

- 目标：完成最小可用界面
- 负责模块：
  - `modules/history-session-list/`
  - `modules/agent-list/`
  - `modules/chat-message-panel/`
  - `modules/run-step-panel/`
  - `modules/schedule-entry/`
  - `modules/schedule-panel/`
  - `modules/automation-authorization-modal/`
- 验收标准：
  - 可查看历史会话摘要并切换
  - 可通过智能体列表选择智能体并创建会话
  - 可发起人工对话
  - 可查看步骤流
  - 可通过固定入口“定时任务”打开轻量面板
  - 可完成统一自动执行授权并启用、关闭任务

### M5 3040 场景端到端联调

#### T19 实现工具执行器

- 目标：执行后端下发的 `openMenu` 和 `executePageCommands`
- 负责模块：
  - `gateway/tool-executor.ts`
- 验收标准：
  - 能转发 `openMenu`
  - 能转发 `executePageCommands`
  - 能返回标准 `tool_result`

#### T20 实现资源读取器

- 目标：读取 `/tabs/shcema/lowCode`
- 负责模块：
  - `gateway/resource-reader.ts`
- 验收标准：
  - 能读取指定 `tabId` 对应资源
  - 能返回标准 `resource_result`

#### T21 实现 `query_3040_today` skill

- 目标：实现“打开3040并查询当天数据”的本地 skill
- 负责模块：
  - `scheduler/skills/query_3040_today.ts`
- 验收标准：
  - skill 内部可计算当天日期
  - skill 可打开 `3040`
  - skill 可读取 schema 并按 label 优先规则定位日期输入框和查询按钮
  - skill 可生成 `executePageCommands` 原子命令
  - skill 返回统一结构化结果

#### T22 完成人工触发 3040 联调

- 目标：打通“助手子窗体 -> DCF -> 后端 -> 开阳 -> DCF -> 助手子窗体”
- 验收标准：
  - 用户输入“打开3040，查询当日数据”后可看到完整步骤流
  - 开阳完成菜单打开、页面结构读取和命令执行
  - 助手子窗体展示最终结果

#### T23 完成定时任务 3040 联调

- 目标：打通“启用授权 -> cron 到点 -> 本地 skill 自动执行”
- 验收标准：
  - 首次打开子窗体时可完成统一自动执行授权
  - 统一授权后任务进入已启用状态
  - 到点后可通过独立右下角弹窗展示待执行概览
  - 用户可一次确认多条待执行任务
  - 被确认任务按顺序执行本地 skill
  - 结果可回写到定时任务状态和本地执行记录

## 五、依赖关系

主要依赖关系如下：

- T1 是所有开发任务前置依赖
- T4 依赖 T3
- T5、T6 依赖 T4
- T7 依赖 T3
- T10 依赖 T8、T9
- T11 依赖 T8、T9、T10
- T13 依赖 T8、T9、T11、T12
- T14、T15 依赖 T1
- T16、T17 依赖 T15
- T18 依赖 T16、T17
- T19、T20 依赖 T4、T5、T7
- T21 依赖 T4、T8、T13、T19、T20
- T22 依赖 T14、T16、T19、T20
- T23 依赖 T10、T11、T13、T17、T21

## 六、并行实施建议

建议按以下工作面并行推进：

- A 线：协议与骨架
  - T1、T2

- B 线：DCF 初始化与开阳接入
  - T3、T4、T5、T6、T7

- C 线：定时任务调度
  - T8、T9、T10、T11、T12、T13

- D 线：助手子窗体状态与通信
  - T14、T15、T16、T17

- E 线：助手子窗体 UI
  - T18

- F 线：执行与联调
  - T19、T20、T21、T22、T23

## 七、最小可交付范围

如需先完成最小版本，建议优先交付以下任务：

- T1 统一协议定义
- T3 DCF 启动入口
- T4 开阳授权管理
- T6 `eventHook` 订阅
- T7 DCF 与后端通信
- T9 定时任务运行状态存储
- T10 启用授权流程
- T11 `cron` 调度器
- T13 助手子窗体通信客户端
- T14 事件分发器
- T15 会话与步骤状态管理
- T16 定时任务状态管理
- T17 助手子窗体最小界面
- T18 工具执行器
- T19 资源读取器
- T20 人工触发联调

## 八、交付建议

建议每项任务交付时至少包含：

- 代码实现
- 自测说明
- 关键交互截图或日志
- 已知限制
- 下一步依赖
