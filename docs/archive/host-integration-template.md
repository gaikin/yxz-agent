# 主进程接入模板

## 适用场景

现有宿主入口类似：

```ts
xx.init()
```

希望在它之后初始化营小助运行时，并在 React 页面中挂载新的确认弹窗。

## 主进程初始化

```ts
import { YxzExtensionService } from "./subprocess/service/YxzExtensionService"
import { socketServer } from "./hostSocketServer"

export async function bootstrapHost() {
  await xx.init()

  const yxzService = new YxzExtensionService(socketServer, {
    workspaceRoot: process.cwd(),
  })

  await yxzService.init()
  return yxzService
}
```

service 类符合宿主模式：

- 放在 `service` 目录
- 继承 `ControllerAbstract(socketServer)`
- 使用 `@requestEvent(url)` 标记宿主路由方法
- 初始化后调用 `init()`

如果宿主里暂时还没有正式的 `rumJsCache`，可以先不传，runtime 会自动退回到带 demo 数据的内存缓存。

如果宿主里暂时还没有自定义的 `toolTransport`，也可以先不传。
runtime 会默认使用：

- MCP endpoint：`http://127.0.0.1:26666/mcp`

也可以显式传一个内存 demo 实现：

```ts
import { createDemoRumJsCache } from "./subprocess/service/common/demoRuntimeData"

const rumJsCache = createDemoRumJsCache({
  automationAuthorization: {
    authorized: true,
    authorizedAt: "2026-04-08 09:00:00",
  },
})
```

如果你们宿主有自己的 MCP 调用通道，再显式传自定义 `toolTransport`：

```ts
import type { JsonRpcToolTransport } from "./dcf/execution/mcpToolClient"

const toolTransport: JsonRpcToolTransport = {
  async send(request) {
    return hostMcpClient.send(request)
  },
}
```

## React 页面挂载

```tsx
import { ScheduleConfirmationPopup } from "./webapp/src/react/ScheduleConfirmationPopup"

export function App() {
  return (
    <>
      <ExistingApp />
      <ScheduleConfirmationPopup />
    </>
  )
}
```

popup 页面初始化数据由宿主提供：

```ts
window.BridgeJS.getPageInitData()
```

当前弹窗组件会优先读取：

- `deviceId`
- `dcfWindowId`
- `overview`

其他页面如果要主动触发事件，统一走 Bridge 事件：

```ts
window.BridgeJs.sendToWindow(windowId, "assistant_window", JSON.stringify(event))
```

DCF 向页面推送状态时，宿主可以直接用：

```ts
sendEventByWinId(winId, "assistant_window", JSON.stringify(event))
```

定时任务到点后的建议链路：

1. `YxzExtensionService.init()`
2. 定时任务触发
3. service 收到待执行概览
4. 调用 `windowService.openYxzWinByOptions({ pageInitParam })`
5. popup 页面通过 `window.BridgeJS.getPageInitData()` 读取初始化数据
6. 弹窗首屏直接展示待确认任务

当前默认打开参数：

- `x: 1120`
- `y: 640`
- `width: 380`
- `height: 320`
- `title: "营小助待确认任务"`
- `hash: "/yxz/popup"`
- `name: "yxz-agent-popup"`

也可以在 service 初始化时覆盖：

```ts
const yxzService = new YxzExtensionService(socketServer, {
  workspaceRoot: process.cwd(),
  rumJsCache,
  windowService,
  popupWindowOptions: {
    x: 900,
    y: 520,
    width: 420,
    height: 360,
    title: "营小助弹窗",
    hash: "/agent/popup",
    name: "yxz-popup-window",
  },
})
```

## 责任划分

- `YxzExtensionService` 放在宿主初始化层
- popup 组件内部自行读取 `getPageInitData()` 并创建 runtime
- `ScheduleConfirmationPopup` 直接无参挂在应用根部即可

## 迁移顺序

1. 在 `xx.init()` 后初始化 `YxzExtensionService`
2. 打通 `sendEventByWinId -> listen(channel)` 事件链路
3. 在 React 根组件挂载 `ScheduleConfirmationPopup`
4. 完成授权并启用 `schedule_3040_daily`
5. 验证北京时间每天 `10:00` 出现确认弹窗
6. 点击确认后验证执行 `query_3040_today`
