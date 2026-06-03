# 营小助方案讨论与决策记录

## 1. 文档定位

本文档用于记录需求讨论过程中的关键结论、已确认事项、待确认事项和简化策略，作为正式设计文档的上游输入。

使用原则如下：

- 本文档记录讨论结论，不追求正式设计文档的完整表达
- 正式设计文档中的关键结论应从本文档提取与沉淀
- 后续新增讨论应优先追加到本文档，再决定是否同步到正式设计
- 本文档允许保留待确认事项、版本性取舍和简化策略

## 2. 当前文档关系

- 讨论源文档：
  - [discussion-decisions.md](C:/dev/projects/work/yxz-agent/docs/discussion-decisions.md)
- 正式设计文档：
  - [assistant-window-dcf-formal-design.md](C:/dev/projects/work/yxz-agent/docs/assistant-window-dcf-formal-design.md)
  - [dcf-frontend-detailed-design.md](C:/dev/projects/work/yxz-agent/docs/dcf-frontend-detailed-design.md)
  - [agent-chat-architecture.md](C:/dev/projects/work/yxz-agent/docs/agent-chat-architecture.md)

## 3. 已确认结论

### 3.1 基础概念

- 领域概念统一使用 `定时任务`，不使用“固定任务”“固定内置任务”作为业务概念
- 当前版本只是“不支持用户创建、编辑、删除定时任务”，不是产品里有独立的“固定任务”模型
- 当前版本只存在一个预置的定时任务，但这是版本限制，不是领域定义

### 3.2 会话模型

- 点击创建会话时即创建真实会话
- `sessionId` 由后端创建并返回
- 不采用“草稿会话”模型
- 不采用“首条消息发送时再创建真实会话”的模型

### 3.3 人工对话与定时任务链路边界

- 人工对话走后端 Agent 编排链路
- 定时任务不经过后端 Agent
- 定时任务由 DCF 本地调度、本地执行
- 人工对话和定时任务共享开阳接入能力，但不共享后端编排链路

### 3.4 统一自动执行授权

- 不再采用“启用某个定时任务时单独授权”的模型
- 改为“用户首次打开子窗体时完成一次统一自动执行授权”
- 授权弹层当前版本只保留一个 `确定`
- 未完成统一自动执行授权前，不允许启用任何定时任务
- 统一授权完成后，`SCHEDULE_ENABLE` 可直接生效
- 定时任务详情不在启动时返回，打开弹窗时再请求

### 3.5 `BOOTSTRAP_STATE`

- `BOOTSTRAP_STATE` 返回：
  - 统一自动执行授权状态
  - DCF 就绪状态
- `BOOTSTRAP_STATE` 不返回：
  - 具体定时任务详情
- DCF 初始化状态异常需要记录埋点
- 面向用户只展示友好提示，具体技术细节通过埋点和后台日志排查

### 3.6 右下角独立弹窗

- 右下角弹窗与子窗体独立，不依赖子窗体是否打开
- 只要 DCF 正常运行，到点即可推送待执行概览给右下角弹窗
- 右下角弹窗展示的是待执行概览，不引入独立 `batch` 领域对象
- 用户可一次确认当前所有待执行项
- 用户可忽略当前展示的待执行项
- 关闭弹窗等同于忽略当前展示项

### 3.7 待执行项模型

- DCF 内部维护 `pending execution item` 列表
- 同一 `scheduleId` 再次到点时，新增新的 `execution item`
- 概览层不聚合，逐条展示
- 展示格式为：`任务名 + 触发时间`
- 示例：
  - `3040每日查询 09:00`
  - `3040每日查询 09:05`

### 3.8 执行队列规则

- 点击 `全部执行` 时，只放行点击瞬间弹窗里展示的待执行项
- 当前版本采用“确认时快照”策略
- 被确认的待执行项默认串行执行
- 串行顺序按 `requestedAt` 升序；同一时刻按入队顺序
- 单条失败不阻断后续项
- 执行过程中新增到点任务，不插入当前执行队列
- 执行过程中新增项继续保留为 `pending`
- 当前确认队列执行完后，如仍有 `pending` 项，右下角弹窗立即再次展示最新概览

### 3.9 弹窗状态规则

- `pending` 状态：
  - 可 `全部执行`
  - 可 `忽略`
  - 可关闭
- `executing` 状态：
  - 不允许再点击 `忽略`
  - 不允许手动关闭弹窗
- 当前确认队列执行完后：
  - 弹窗自动关闭
  - 若仍有 `pending` 项，立即再次展示

### 3.10 忽略与 `skipped`

- 用户点击“忽略”后，当前展示项记为 `skipped`
- `skipped` 不补执行、不重试
- 任务本身保持启用
- 后续再次到点仍正常新增新的 `execution item`
- `skipped` 写入执行记录
- `skipped` 写入对应 `scheduleId` 的 `lastStatus`
- 当前版本对 `skipped` 只记录，不做特殊处理

### 3.11 过期机制

- 当前版本暂不实现待执行项自动过期机制
- “是否引入过期时间”列为待确认事项

### 3.12 skill 设计原则

- 本次迭代为内测版
- skill 全部使用结构化语言定义
- 不引入自然语言可执行 skill
- 目标优先是把执行链路跑通、跑稳

### 3.13 最小结构化 skill schema

- skill 顶层仅保留：
  - `skillId`
  - `name`
  - `description`
  - `version`
  - `tools`
- skill 顶层不定义：
  - `input`
  - `context`
  - `result.extract`
- skill 内不显式定义：
  - `onError`
- 当前版本组件定位直接使用固定 `componentId`
- 不在 skill 内做动态组件定位

### 3.14 当前 `query_3040_today`

- 当前简化版 `query_3040_today` 的流程改为：
  - 打开菜单
  - 点击查询
  - 获取查询结果
- 结果获取属于 `executePageCommands` 的工具结果
- 工具调用结果统一走 `{ result: { content: [{ type: "text", text: "..." }] } }`
- 当前版本不做 `extract`
- skill 成功时直接返回最后一个 tool 的原始结果

### 3.15 `args` 引用规则

- 当前版本 `args` 只支持两种能力：
  - 字面量
  - `xxxFrom` 路径引用
- 不支持：
  - 表达式
  - 模板
  - 函数
  - 数组下标
  - 默认值

### 3.16 运行时上下文与执行模型

- `SkillRuntimeContext` 最小结构：
  - `values`
  - `lastToolResult`
- `saveAs` 保存 tool 原始结果
- 成功时返回最后一个 tool 原始结果
- 失败由 engine 统一收敛为平台级错误

### 3.17 通用错误码

- 保留 `error`
- 不做场景定制错误码
- `error.code` 使用通用平台级错误码
- 当前最小集合：
  - `MENU_OPEN_FAILED`
  - `SCHEMA_READ_FAILED`
  - `TARGET_NOT_FOUND`
  - `TARGET_NOT_UNIQUE`
  - `COMMAND_EXECUTION_FAILED`
  - `EXECUTION_BLOCKED`
  - `RUNTIME_EXCEPTION`

### 3.18 成功/失败/跳过结果

- `completed`
  - 不写 `summary`
- `failed`
  - 保留 `error`
- `skipped`
  - 写固定 `summary`

## 4. 当前最小 skill 示例

```yaml
skillId: query_3040_today
name: 3040当日查询
description: 打开3040，点击查询，并直接返回最后一个工具结果
version: 1

tools:
  - toolId: open_menu
    tool: openMenu
    args:
      menuShortCode: "3040"
    saveAs: tabInfo

  - toolId: execute_query
    tool: executePageCommands
    args:
      tabIdFrom: tabInfo.tabId
      commands:
        - componentId: btn_query_1
          command: click
    saveAs: queryResult
```

## 5. 待确认事项

- 定时任务每次执行是否生成历史会话
- 是否引入待执行项自动过期机制
- 后续是否需要让成功结果支持结构化提取，而不只是返回最后一个 tool 原始结果

