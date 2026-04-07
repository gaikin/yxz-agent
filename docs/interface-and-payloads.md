# 营小助接口与报文清单

## 1. 文档定位

本文档用于整理当前版本已经确定的接口定义与报文格式，覆盖以下通信方向：

- 助手子窗体 <-> DCF
- 右下角弹窗 <-> DCF
- DCF <-> 后端
- DCF -> MCP 工具调用

本文档只记录当前版本已经确定的内容，不记录待确认能力。

相关文档：

- 讨论源文档：[discussion-decisions.md](C:/dev/projects/work/yxz-agent/docs/discussion-decisions.md)
- 正式设计文档：[assistant-window-dcf-formal-design.md](C:/dev/projects/work/yxz-agent/docs/assistant-window-dcf-formal-design.md)
- 共享协议：[protocol.ts](C:/dev/projects/work/yxz-agent/shared/protocol.ts)

## 2. 助手子窗体 <-> DCF

### 2.1 DCF -> 助手子窗体

#### `BOOTSTRAP_STATE`

用途：

- 子窗体启动后获取统一自动执行授权状态和 DCF 就绪状态

示例：

```json
{
  "type": "BOOTSTRAP_STATE",
  "deviceId": "device-001",
  "automationAuthorization": {
    "authorized": false
  },
  "dcfRuntime": {
    "dcfStatus": "online",
    "kaiyangStatus": "connected",
    "kaiyangAuthorizationStatus": "authorized",
    "kaiyangEventHookStatus": "subscribed",
    "scheduleSubsystemReady": true
  },
  "sentAt": "2026-04-07T09:00:00.000Z"
}
```

#### `AUTOMATION_AUTHORIZED`

用途：

- 用户在子窗体中完成统一自动执行授权后，DCF 回传授权结果

示例：

```json
{
  "type": "AUTOMATION_AUTHORIZED",
  "deviceId": "device-001",
  "authorizedAt": "2026-04-07T09:01:00.000Z",
  "sentAt": "2026-04-07T09:01:00.000Z"
}
```

#### `SCHEDULE_STATE_SNAPSHOT`

用途：

- 子窗体打开定时任务面板时获取当前预置任务状态

示例：

```json
{
  "type": "SCHEDULE_STATE_SNAPSHOT",
  "deviceId": "device-001",
  "schedules": [
    {
      "scheduleId": "schedule_3040_daily",
      "name": "3040每日查询",
      "enabled": true,
      "cronExpression": "0 0 9 * * *",
      "timezone": "Asia/Shanghai",
      "nextTriggerAt": "2026-04-08T01:00:00.000Z",
      "lastTriggeredAt": "2026-04-07T01:00:00.000Z",
      "lastCompletedAt": "2026-04-07T01:00:12.000Z",
      "lastStatus": "completed"
    }
  ],
  "sentAt": "2026-04-07T09:02:00.000Z"
}
```

#### `SCHEDULE_ENABLED`

用途：

- DCF 启用定时任务并计算下次触发时间后回传

示例：

```json
{
  "type": "SCHEDULE_ENABLED",
  "deviceId": "device-001",
  "scheduleId": "schedule_3040_daily",
  "nextTriggerAt": "2026-04-08T01:00:00.000Z",
  "sentAt": "2026-04-07T09:03:00.000Z"
}
```

#### `SCHEDULE_DISABLED`

用途：

- DCF 关闭定时任务后回传

示例：

```json
{
  "type": "SCHEDULE_DISABLED",
  "deviceId": "device-001",
  "scheduleId": "schedule_3040_daily",
  "sentAt": "2026-04-07T09:04:00.000Z"
}
```

### 2.2 助手子窗体 -> DCF

#### `AUTHORIZE_AUTOMATION`

用途：

- 用户首次打开子窗体时点击统一自动执行授权弹层中的 `确定`

示例：

```json
{
  "type": "AUTHORIZE_AUTOMATION",
  "deviceId": "device-001",
  "sentAt": "2026-04-07T09:01:00.000Z"
}
```

#### `SCHEDULE_STATE`

用途：

- 子窗体打开定时任务面板时请求当前任务状态

示例：

```json
{
  "type": "SCHEDULE_STATE",
  "deviceId": "device-001",
  "sentAt": "2026-04-07T09:02:00.000Z"
}
```

#### `SCHEDULE_ENABLE`

用途：

- 启用当前预置定时任务

示例：

```json
{
  "type": "SCHEDULE_ENABLE",
  "deviceId": "device-001",
  "scheduleId": "schedule_3040_daily",
  "sentAt": "2026-04-07T09:03:00.000Z"
}
```

#### `SCHEDULE_DISABLE`

用途：

- 关闭当前预置定时任务

示例：

```json
{
  "type": "SCHEDULE_DISABLE",
  "deviceId": "device-001",
  "scheduleId": "schedule_3040_daily",
  "sentAt": "2026-04-07T09:04:00.000Z"
}
```

## 3. 右下角弹窗 <-> DCF

### 3.1 DCF -> 右下角弹窗

#### `SCHEDULE_EXECUTION_OVERVIEW_UPDATED`

用途：

- DCF 在到点创建待确认执行项后，向弹窗推送最新概览
- 当前队列执行完后，如果仍有 `pending` 项，也会再次推送

示例：

```json
{
  "type": "SCHEDULE_EXECUTION_OVERVIEW_UPDATED",
  "deviceId": "device-001",
  "overview": {
    "pendingCount": 2,
    "items": [
      {
        "executionId": "exec_20260407T090000001",
        "scheduleId": "schedule_3040_daily",
        "scheduleName": "3040每日查询",
        "requestedAt": "2026-04-07T01:00:00.000Z",
        "status": "pending"
      },
      {
        "executionId": "exec_20260407T090500001",
        "scheduleId": "schedule_3040_daily",
        "scheduleName": "3040每日查询",
        "requestedAt": "2026-04-07T01:05:00.000Z",
        "status": "pending"
      }
    ],
    "updatedAt": "2026-04-07T01:05:00.000Z"
  },
  "sentAt": "2026-04-07T01:05:00.000Z"
}
```

### 3.2 右下角弹窗 -> DCF

#### `CONFIRM_ALL_SCHEDULE_EXECUTIONS`

用途：

- 用户点击 `全部执行`
- 只放行点击瞬间弹窗里展示的待执行项快照

示例：

```json
{
  "type": "CONFIRM_ALL_SCHEDULE_EXECUTIONS",
  "deviceId": "device-001",
  "executionIds": [
    "exec_20260407T090000001",
    "exec_20260407T090500001"
  ],
  "sentAt": "2026-04-07T01:05:10.000Z"
}
```

#### `DISMISS_ALL_SCHEDULE_EXECUTIONS`

用途：

- 用户点击 `忽略`
- 或关闭弹窗
- 当前展示项统一记为 `skipped`

示例：

```json
{
  "type": "DISMISS_ALL_SCHEDULE_EXECUTIONS",
  "deviceId": "device-001",
  "executionIds": [
    "exec_20260407T090000001",
    "exec_20260407T090500001"
  ],
  "sentAt": "2026-04-07T01:05:10.000Z"
}
```

## 4. DCF <-> 后端

### 4.1 DCF -> 后端

#### `hello`

示例：

```json
{
  "type": "hello",
  "deviceId": "device-001",
  "clientVersion": "0.1.0",
  "sentAt": "2026-04-07T00:59:50.000Z"
}
```

#### `tool_result`

示例：

```json
{
  "type": "tool_result",
  "deviceId": "device-001",
  "sessionId": "session-001",
  "runId": "run-001",
  "toolCallId": "tool-call-001",
  "status": "success",
  "result": {
    "result": {
      "content": [
        {
          "type": "text",
          "text": "{\"rows\":[]}"
        }
      ]
    }
  },
  "sentAt": "2026-04-07T01:10:00.000Z"
}
```

#### `tool_error`

示例：

```json
{
  "type": "tool_error",
  "deviceId": "device-001",
  "sessionId": "session-001",
  "runId": "run-001",
  "toolCallId": "tool-call-001",
  "status": "failed",
  "error": {
    "code": "COMMAND_EXECUTION_FAILED",
    "message": "执行页面命令失败",
    "retryable": false
  },
  "sentAt": "2026-04-07T01:10:00.000Z"
}
```

#### `resource_result`

示例：

```json
{
  "type": "resource_result",
  "deviceId": "device-001",
  "sessionId": "session-001",
  "runId": "run-001",
  "requestId": "request-001",
  "status": "success",
  "resource": {
    "uri": "/tabs/schema/lowCode",
    "data": {
      "tabId": "tab_001",
      "components": []
    }
  },
  "sentAt": "2026-04-07T01:10:00.000Z"
}
```

### 4.2 后端 -> DCF

#### `run_started`

示例：

```json
{
  "type": "run_started",
  "sessionId": "session-001",
  "runId": "run-001",
  "status": "running",
  "createTime": "2026-04-07T01:10:00.000Z",
  "sentAt": "2026-04-07T01:10:00.000Z"
}
```

#### `step_started`

示例：

```json
{
  "type": "step_started",
  "sessionId": "session-001",
  "runId": "run-001",
  "stepId": "step-001",
  "title": "打开3040",
  "toolName": "openMenu",
  "input": {
    "menuShortCode": "3040"
  },
  "startTime": "2026-04-07T01:10:01.000Z",
  "sentAt": "2026-04-07T01:10:01.000Z"
}
```

#### `step_finished`

示例：

```json
{
  "type": "step_finished",
  "sessionId": "session-001",
  "runId": "run-001",
  "stepId": "step-001",
  "status": "success",
  "endTime": "2026-04-07T01:10:02.000Z",
  "sentAt": "2026-04-07T01:10:02.000Z"
}
```

#### `assistant_done`

示例：

```json
{
  "type": "assistant_done",
  "sessionId": "session-001",
  "runId": "run-001",
  "messageId": "message-001",
  "text": "查询完成",
  "sentAt": "2026-04-07T01:10:10.000Z"
}
```

#### `run_failed`

示例：

```json
{
  "type": "run_failed",
  "sessionId": "session-001",
  "runId": "run-001",
  "error": "执行失败",
  "sentAt": "2026-04-07T01:10:10.000Z"
}
```

## 5. DCF -> MCP 工具调用报文

### 5.1 统一调用格式

当前版本所有工具调用统一使用 JSON-RPC 2.0：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "toolName",
    "arguments": {}
  }
}
```

### 5.2 `openMenu`

请求：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "openMenu",
    "arguments": {
      "menuShortCode": "3040"
    }
  }
}
```

响应示例：

```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"tabId\":\"tab_001\"}"
      }
    ]
  }
}
```

### 5.3 `executePageCommands`

请求：

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "executePageCommands",
    "arguments": {
      "tabId": "tab_001",
      "commands": [
        {
          "componentId": "btn_query_1",
          "command": "click"
        }
      ]
    }
  }
}
```

响应示例：

```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"rows\":[]}"
      }
    ]
  }
}
```

## 6. 当前版本说明

- 本文档只整理当前版本已经确定的接口与报文
- 定时任务不生成历史会话
- 待执行项自动过期机制当前不实现
- 成功结果不做 `extract`，skill 默认返回最后一个 tool 原始结果
