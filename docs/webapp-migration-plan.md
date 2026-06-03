# yxz-agent-webapp 迁移计划

更新时间：2026-06-03

相关文档：

- 正式文档索引：[formal-docs-index.md](C:/dev/projects/work/yxz-agent/docs/formal-docs-index.md)
- 产品设计：[product-design.md](C:/dev/projects/work/yxz-agent/docs/product-design.md)
- 系统架构：[system-architecture.md](C:/dev/projects/work/yxz-agent/docs/system-architecture.md)
- 运行流程：[runtime-flows.md](C:/dev/projects/work/yxz-agent/docs/runtime-flows.md)
- 前端设计整合：[webapp-design-integration.md](C:/dev/projects/work/yxz-agent/docs/webapp-design-integration.md)

## 1. 迁移目标

将 `C:\dev\projects\work\yxz-agent-webapp` 中已经成型的智能体前端工作台能力，迁移到当前 `yxz-agent` 项目中，作为正式主窗体和任务子窗体的执行层、展示层和状态模型基础。

迁移后应满足：

- 主窗体具备完整人工对话工作台。
- 任务子窗体可复用主窗体执行层基础能力。
- 业务窗体执行层负责调用营小助智能体服务和开阳 MCP。
- 业务窗体执行层负责直接上传任务记录。
- 子进程继续保持轻量，只负责常驻触发、开阳基座通信、窗体控制和轻量状态。
- 确认弹窗继续保持独立，只负责确认或忽略。

本计划只迁移正式设计需要的能力，不迁移 `yxz-agent-webapp` 中的 mock server、独立 MCP simulator 和旧 demo 后台执行方式。

## 2. 当前差异

| 项目 | 当前情况 | 迁移影响 |
| --- | --- | --- |
| `yxz-agent` | CommonJS + TypeScript，当前 `webapp` 只有轻量 Assistant/Popup 入口 | 需要补充 Vite/React 前端工程能力 |
| `yxz-agent-webapp` | Vite + React + antd + styled-components + zustand，已有完整工作台 | 可作为主窗体 UI、状态管理和执行层雏形来源 |
| 当前子进程 | 已有定时任务、确认弹窗、开阳基座通信和部分调度能力 | 需要保留，不把 MCP 工具执行迁回子进程 |
| 方案仓库 mock | 有 mock chat server、mock MCP server、standalone simulator | 只能进入开发调试资料，不能进入正式运行链路 |

## 3. 迁移范围

### 3.1 直接迁移

| 来源 | 目标 | 说明 |
| --- | --- | --- |
| `src/theme/appTheme.ts` | `webapp/src/theme/appTheme.ts` | 作为正式主题基础，后续按产品风格收敛 |
| `src/providers/AppProviders.tsx` | `webapp/src/providers/AppProviders.tsx` | 提供主题和全局前端上下文 |
| `src/components/chat/ChatWorkspace.tsx` | `webapp/src/assistant/components/ChatWorkspace/` | 迁为主窗体消息流和输入区基础 |
| `src/components/layout/AppShell.tsx` | `webapp/src/assistant/components/AppShell/` | 迁为主窗体布局基础，旧 demo 并发提示需改造 |
| `src/pages/DashboardPage.tsx` | `webapp/src/assistant/pages/MainWindowPage/` | 拆分为主窗体容器和组件组合 |
| `src/types/chat.ts` | `webapp/src/assistant/types/chat.ts` | 迁为展示层消息和卡片类型基础 |
| `src/types/mcpDto.ts` | `webapp/src/assistant/execution-layer/mcp/types.ts` | 迁为 MCP 工具结果适配类型基础 |

### 3.2 改造后迁移

| 来源 | 目标 | 改造要求 |
| --- | --- | --- |
| `src/stores/useChatStore.ts` | `webapp/src/assistant/stores/` | 拆成 `chat.store`、`run.store`、`schedule.store`，移除旧后台任务语义 |
| `src/lib/chat/chatClient.ts` | `webapp/src/assistant/execution-layer/chat/` | 替换 mock API，接入营小助智能体服务正式链路 |
| `src/lib/chat/streamParser.ts` | `webapp/src/assistant/execution-layer/chat/` | 保留流解析思路，事件类型收敛到一次任务和任务步骤 |
| `src/lib/mcp/localMcpClient.ts` | `webapp/src/assistant/execution-layer/mcp/` | 接入正式开阳 MCP，不再直连 simulator |
| `src/lib/mcp/mcpAdapter.ts` | `webapp/src/assistant/execution-layer/mcp/` | 保留工具结果适配，统一输出运行事件和工具结果卡片数据 |
| `src/lib/localAgent/localAgentEventBus.ts` | `webapp/src/assistant/execution-layer/events/` | 正式命名为运行事件分发 |
| `src/lib/localAgent/localAgentEvents.ts` | `webapp/src/assistant/execution-layer/events/` | 事件命名按运行事件、人工接管、工具进度收敛 |
| `src/lib/localAgent/normalizeMcpNotification.ts` | `webapp/src/assistant/execution-layer/events/` | 改造为 MCP 通知到运行事件的标准化逻辑 |
| `src/data/agentWorkspace.ts` | `webapp/src/assistant/dev-fixtures/` | 只保留为开发 fixture，不进入正式数据源 |

### 3.3 只作参考

| 来源 | 用途 |
| --- | --- |
| `docs/product-design-agent-skill-mcp.md` | 产品语义参考 |
| `docs/conversation-flow.md` | 人工对话流程参考 |
| `docs/local-agent-state-machine.md` | 状态机参考 |
| `docs/local-agent-event-bus-design.md` | 运行事件分发参考 |
| `src/lib/backgroundTasks.ts` | 只参考并发提示体验，不保留后台执行术语 |

### 3.4 不迁移到正式链路

| 来源 | 原因 |
| --- | --- |
| `server/mock-chat-server.cjs` | mock 服务，只能作为开发调试资料 |
| `server/mock-mcp-sse-server.cjs` | mock MCP，只能作为开发调试资料 |
| `server/standalone-mcp-simulator.cjs` | 独立模拟器，不进入正式运行链路 |
| `server/dev-orchestrator.cjs` | 开发编排脚本，不作为正式能力 |
| 旧 demo 后台任务模型 | 当前正式设计没有后台执行方式 |

## 4. 目标目录

```text
webapp/
  src/
    app/
      main.tsx
      routes.tsx
      providers/

    assistant/
      pages/
        MainWindowPage/
      components/
        AppShell/
        ChatWorkspace/
        HistorySessionList/
        TaskStepPanel/
        ToolResultCard/
        ScheduleEntry/
      stores/
        chat.store.ts
        run.store.ts
        schedule.store.ts
      execution-layer/
        chat/
          chat-client.ts
          stream-parser.ts
        mcp/
          mcp-client.ts
          mcp-adapter.ts
        events/
          runtime-events.ts
          runtime-event-dispatcher.ts
          normalize-mcp-notification.ts
        records/
          task-record-uploader.ts
      services/
        kaiyang-base-communication.ts

    windows/
      schedule-confirmation-popup/
      task-window/

    theme/
    shared/
      types/
      utils/
```

目录原则：

- `assistant/execution-layer` 放业务窗体执行能力。
- `assistant/components` 放展示层组件。
- `assistant/stores` 放状态管理。
- `windows/schedule-confirmation-popup` 保留确认弹窗。
- `windows/task-window` 承载定时任务和事件触发任务。
- `services/kaiyang-base-communication.ts` 封装开阳基座通信实现细节。

## 5. 分阶段计划

### 阶段 0：迁移准备

目标：不改变现有行为，只补齐工程准备和迁移边界。

任务：

- 确认当前 `webapp` 是否采用 Vite 作为正式前端构建方式。
- 在当前项目中引入或对齐 `vite`、`@vitejs/plugin-react`、`react-dom`、`react-router-dom`、`styled-components`、`antd`、`zustand`。
- 明确 `package.json` 的构建命令如何同时构建子进程 TypeScript 和前端资源。
- 建立 `webapp/src/app`、`webapp/src/assistant`、`webapp/src/windows` 目录。
- 保留当前 `AssistantWindowPage`、`PopupPageService`，避免第一步破坏现有定时任务和确认弹窗。

验收：

- 当前 `npm run build` 仍可通过。
- 新增前端构建命令可以独立运行。
- 现有确认弹窗链路不受影响。

### 阶段 1：前端骨架迁移

目标：把 `yxz-agent-webapp` 的 UI 壳、主题、路由和基础组件迁入当前项目。

任务：

- 迁移 `AppProviders`、`appTheme`。
- 迁移 `AppShell` 并去除旧 demo 后台任务文案。
- 迁移 `DashboardPage`，拆成正式主窗体容器。
- 迁移 `ChatWorkspace`，作为主对话区基础。
- 建立主窗体路由和任务子窗体路由。
- 将当前 `AssistantWindowPage` 的授权和定时任务入口嵌入新主窗体，而不是删除。

验收：

- 主窗体能展示新工作台骨架。
- 当前授权、定时任务启用、确认弹窗入口仍可访问。
- 页面不依赖 mock chat server 或 mock MCP server。

### 阶段 2：状态管理拆分

目标：把 `useChatStore` 拆成正式状态管理，不直接照搬旧 demo 模型。

任务：

- 从 `useChatStore` 拆出 `chat.store`：业务会话、消息、当前会话、草稿。
- 拆出 `run.store`：一次任务、任务步骤、工具结果、人工接管状态。
- 拆出 `schedule.store`：自动执行授权、任务启用状态、待确认概览入口。
- 删除或隔离旧 `backgroundTasks`，只保留并发运行提示能力。
- 建立状态管理和展示组件之间的稳定接口。

验收：

- 主窗体消息流由 `chat.store` 驱动。
- 任务步骤区由 `run.store` 驱动。
- 定时任务入口由 `schedule.store` 驱动。
- 代码正文不再使用“后台任务”作为正式状态概念。

### 阶段 3：开阳基座通信接入

目标：用正式开阳基座通信替换浏览器 demo 链路。

任务：

- 建立 `kaiyang-base-communication.ts`，封装 `window.BridgeJs` 等实现细节。
- 建立主窗体到子进程的子进程指令发送能力。
- 建立子进程通知订阅能力。
- 将当前 `Assistant/runtime.ts` 中的 channel client 能力迁入正式服务。
- 将子进程通知转换为状态管理更新。

验收：

- 展示层组件不直接调用 `window.BridgeJs`。
- 子进程指令和子进程通知都有统一封装。
- 当前定时任务状态能进入新主窗体状态管理。

### 阶段 4：主窗体执行层迁移

目标：迁移人工对话、流解析、运行事件分发和 MCP 工具调用基础能力。

任务：

- 改造 `chatClient`，接入营小助智能体服务正式接口。
- 迁移 `streamParser`，输出业务会话、一次任务、任务步骤和工具调用相关运行事件。
- 改造 `localMcpClient`，接入正式开阳 MCP。
- 建立运行事件分发，替代旧 `LocalAgentEventBus` 命名。
- 将人工接管事件标准化为运行事件。
- 建立 `task-record-uploader`，由主窗体执行层直接上传任务记录。

验收：

- 用户在主窗体发送消息后，能创建或继续业务会话。
- 流式响应能驱动消息和任务步骤展示。
- MCP 工具调用结果能展示并进入任务记录。
- 任务记录上传不经过子进程。

### 阶段 5：任务子窗体迁移

目标：建立定时任务和事件触发任务共用的任务子窗体。

任务：

- 新建 `windows/task-window`。
- 复用主窗体执行层的聊天、MCP、运行事件分发和任务记录上传能力。
- 支持子进程传入定时任务上下文和事件触发任务上下文。
- 支持等待确认、执行中、已完成、已失败、已中止、已接管状态展示。
- 支持任务摘要回写子进程。
- 保留任务类型分支：定时任务和事件触发任务的文案、队列、授权策略可不同。

验收：

- 定时任务确认后进入任务子窗体执行。
- 事件触发任务可进入同一任务子窗体框架。
- 任务子窗体关闭时执行层销毁。
- 已进入执行的一次任务形成任务记录并上传营小助智能体服务。

### 阶段 6：确认弹窗视觉和链路收敛

目标：保留确认弹窗职责，同时让视觉和状态接入新前端体系。

任务：

- 保留 `ScheduleConfirmationPopup` 的独立入口。
- 将弹窗样式迁入统一主题。
- 只消费待确认任务概览。
- 只发送确认或忽略子进程指令。
- 确认后由子进程唤起任务子窗体。

验收：

- 确认弹窗不包含执行层。
- 确认弹窗不调用 MCP。
- 确认弹窗不上传任务记录。

### 阶段 7：开发调试资料隔离

目标：把方案仓库的 mock 和 demo 能力纳入开发资料，但不进入正式运行链路。

任务：

- 将 mock chat server、mock MCP server、standalone simulator 放入 `devtools/` 或文档归档。
- 为前端执行层提供可注入的开发 mock 接口。
- 正式构建不引用 devtools。
- 删除或隔离旧 demo 数据入口。

验收：

- 正式代码不 import mock server。
- 开发模式可以单独启动 mock。
- 正式构建产物不包含 simulator。

## 6. 依赖迁移计划

建议依赖：

| 依赖 | 用途 | 迁移方式 |
| --- | --- | --- |
| `vite` | 前端构建 | 新增 devDependency |
| `@vitejs/plugin-react` | React Vite 插件 | 新增 devDependency |
| `react-dom` | React DOM 渲染 | 新增 dependency |
| `react-router-dom` | 前端路由 | 新增 dependency |
| `styled-components` | 主题和组件样式 | 新增 dependency |
| `antd` | 基础组件和提示 | 新增 dependency |
| `zustand` | 状态管理 | 新增 dependency |

注意：

- 当前项目 `type` 是 `commonjs`，前端 Vite 配置需要避免影响子进程 CommonJS 构建。
- 子进程构建和前端构建建议拆成独立命令，例如 `build:subprocess`、`build:webapp`、`build`。
- 依赖版本优先沿用 `yxz-agent-webapp` 当前版本，再按当前项目锁文件统一安装。

## 7. 风险和处理策略

| 风险 | 影响 | 处理策略 |
| --- | --- | --- |
| 一次性迁移过多 UI 和执行逻辑 | 难以定位问题 | 按阶段迁移，每阶段保持可运行 |
| 旧 demo 后台任务语义混入正式设计 | 和当前产品边界冲突 | 只保留并发提示体验，不保留后台执行方式 |
| mock API 被误用为正式接口 | 正式链路不可靠 | mock 只能进入 devtools |
| MCP 调用上下文不清晰 | 工具调用无法绑定窗体和一次任务 | MCP 能力统一由业务窗体执行层管理 |
| 任务记录上传误走子进程 | 破坏架构边界 | 任务记录上传只允许在业务窗体执行层 |
| Vite 构建影响当前 TypeScript 构建 | 构建链路不稳定 | 子进程和前端分命令构建 |

## 8. 里程碑建议

| 里程碑 | 目标 | 主要产物 |
| --- | --- | --- |
| M1 | 前端工程接入 | Vite 构建、主窗体骨架、统一主题 |
| M2 | 主窗体展示层迁移 | AppShell、ChatWorkspace、历史业务会话、输入区 |
| M3 | 状态管理拆分 | `chat.store`、`run.store`、`schedule.store` |
| M4 | 开阳基座通信接入 | 子进程指令、子进程通知、状态同步 |
| M5 | 主窗体执行层接入 | 营小助智能体服务、MCP、运行事件分发、任务记录上传 |
| M6 | 任务子窗体上线 | 定时任务和事件触发任务共用任务子窗体 |
| M7 | 收敛和清理 | mock 隔离、旧入口删除、文档和测试补齐 |

## 9. 建议任务拆分

第一批可执行任务：

1. 新增前端构建脚手架和依赖。
2. 搭建 `webapp/src/app` 和正式目录结构。
3. 迁移主题、Provider、AppShell 和 ChatWorkspace。
4. 把当前 `AssistantWindowPage` 嵌入新主窗体。
5. 拆分 `useChatStore` 的类型和状态边界。
6. 封装开阳基座通信服务。
7. 建立运行事件分发的类型定义。

第二批可执行任务：

1. 改造 chat client 接入营小助智能体服务。
2. 改造 MCP client 接入开阳 MCP。
3. 实现任务记录上传器。
4. 实现任务步骤区。
5. 接入人工接管运行事件。
6. 新建任务子窗体入口。

第三批可执行任务：

1. 定时任务确认后唤起任务子窗体。
2. 事件触发任务进入任务子窗体。
3. 窗体关闭和中止策略实现。
4. mock 和 devtools 隔离。
5. 端到端联调和回归测试。

## 10. 待确认问题

- 当前项目是否接受引入 Vite 作为正式前端构建工具。
- 主窗体和任务子窗体是否共用同一套执行层模块，还是拆成共享基础包和窗体适配层。
- 任务子窗体关闭时，等待队列是否全部丢弃。
- 任务记录上传失败是否需要业务窗体执行层本地重试策略。
- 多任务并发数是否允许用户在界面配置。
