# React UI 接入说明

## 前端设计整合

正式文档入口见：[formal-docs-index.md](C:/dev/projects/work/yxz-agent/docs/formal-docs-index.md)

核心架构方向见：[thin-subprocess-window-agent-architecture.md](C:/dev/projects/work/yxz-agent/docs/thin-subprocess-window-agent-architecture.md)

术语规范见：[terminology.md](C:/dev/projects/work/yxz-agent/docs/terminology.md)

完整设计整合口径见：[webapp-design-integration.md](C:/dev/projects/work/yxz-agent/docs/webapp-design-integration.md)

`C:\dev\projects\work\yxz-agent-webapp` 中的前端方案作为主窗体执行层、展示层和状态模型参考，也可为任务子窗体提供执行层基础。后续迁移代码时，应保留当前项目的子进程常驻能力、开阳基座通信、共享协议、定时触发和确认弹窗链路；MCP 工具能力放入业务窗体执行层，不放入子进程。

## 目标

- 子进程在北京时间每天 `10:00` 触发 `3040每日查询`
- 到点后向 React UI 推送待确认弹窗
- 用户点击确认后由子进程唤起任务子窗体，任务子窗体负责执行对应技能

## 可直接使用的接入入口

- `AssistantWindowPage`
- `PopupPageService`
- `YxzExtensionService`

主要代码位置：

- `subprocess/service/YxzExtensionService.ts`
- `webapp/src/Assistant/index.tsx`
- `webapp/src/Popup/index.tsx`
- `webapp/src/Popup`

现成 React 弹窗组件：

- `ScheduleConfirmationPopup`
- `getPopupPageServiceFromHost`
- `AssistantWindowPage`

当前代码中主动触发子进程通知时使用开阳基座通信实现，例如：

- `window.BridgeJs.sendToWindow(windowId, channel, JSON.stringify(event))`

## React 侧建议接法

`AssistantWindowPage` 和 `PopupPageService` 负责把页面流程过程化，组件直接调用页面内逻辑获取和推进状态。

示例：

```tsx
import { ScheduleConfirmationPopup } from "../webapp/src/Popup/ScheduleConfirmationPopup"

export function SchedulePopup() {
  return <ScheduleConfirmationPopup />
}
```

assistant 页面也可以直接使用：

```tsx
import { AssistantWindowPage } from "../webapp/src/Assistant"

export function AssistantPage() {
  return <AssistantWindowPage />
}
```

## 现有默认行为

- 默认定时任务：`schedule_3040_daily`
- 默认技能：`query_3040_today`
- 默认时区：`Asia/Shanghai`
- 默认触发时间：每天 `10:00`
- 未传 `rumJsCache` 时默认使用内存缓存
- 未传 `toolTransport` 时默认请求 `http://127.0.0.1:26666/mcp`

## 行为链路

1. React UI 调用 assistant page service 完成授权和启用定时任务
2. popup 页面通过 `window.BridgeJS.getPageInitData()` 读取初始化数据
3. 子进程定时触发器在北京时间 `10:00` 创建待确认任务项
4. service 通过 `openYxzWinByOptions({ pageInitParam })` 打开弹窗
5. popup page service 从 `pageInitParam` 恢复初始 overview
6. React UI 弹出确认框
7. 用户点击确认
8. popup page service 发送 `CONFIRM_ALL_SCHEDULE_EXECUTIONS`
9. 子进程唤起任务子窗体并传入触发源上下文
10. 任务子窗体执行层执行 `query_3040_today` 技能并负责后续交互

