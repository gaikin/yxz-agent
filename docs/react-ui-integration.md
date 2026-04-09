# React UI 接入说明

## 目标

- DCF 在北京时间每天 `10:00` 触发 `3040每日查询`
- 到点后向 React UI 推送待确认弹窗
- 用户点击确认后执行 `query_3040_today` skill

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

主动触发 DCF 事件时默认使用：

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
- 默认 skill：`query_3040_today`
- 默认时区：`Asia/Shanghai`
- 默认触发时间：每天 `10:00`
- 未传 `rumJsCache` 时默认使用内存缓存
- 未传 `toolTransport` 时默认请求 `http://127.0.0.1:26666/mcp`

## 行为链路

1. React UI 调用 assistant page service 完成授权和启用定时任务
2. popup 页面通过 `window.BridgeJS.getPageInitData()` 读取初始化数据
3. DCF 调度器在北京时间 `10:00` 创建待执行项
4. service 通过 `openYxzWinByOptions({ pageInitParam })` 打开弹窗
5. popup page service 从 `pageInitParam` 恢复初始 overview
6. React UI 弹出确认框
7. 用户点击确认
8. popup page service 发送 `CONFIRM_ALL_SCHEDULE_EXECUTIONS`
9. DCF 执行 `query_3040_today` skill

