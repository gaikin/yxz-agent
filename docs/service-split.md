# Service 拆分说明

当前建议保留的 service 模块：

- `subprocess/service/YxzExtensionService.ts`
- `webapp/src/Assistant/index.tsx`
- `webapp/src/Popup/index.tsx`

## 职责

- `YxzExtensionService`
  - 宿主主线程 service
  - 负责初始化 DCF、响应 `@requestEvent`、触发定时任务、打开 popup

- `AssistantWindowPage`
  - 助手窗体页面 service
  - 已内聚在 `AssistantWindowPage.tsx` 中
  - 负责授权、打开面板、启停调度、读取页面 viewModel

- `PopupPageService`
  - popup 页面 service
  - 已内聚在 `ScheduleConfirmationPopup.tsx` 中
  - 负责从 `getPageInitData()` 初始化、确认执行、忽略执行、读取页面 viewModel

## 迁移时可不保留的中间层

- `runtime` 命名的 facade
- 聚合导出目录
- 仅用于包装 viewModel 的中间函数

## 推荐结构

```text
subprocess/service/
  YxzExtensionService.ts

dcf/
  ...

webapp/src/
  assistant/
    AssistantWindowPage.tsx
  popup/
  react/
    ScheduleConfirmationPopup.tsx
```

