# Standalone Schedule Module

这个目录是一套独立的本地调度 + skill 执行实现。

约束：

- 不依赖 `subprocess/service`
- 不依赖 `share`
- 不依赖 `webapp`
- 只使用 Node 内置能力、`axios`、`cron-parser`

模块说明：

- `utils.js`
  - 时间格式化
  - JSON 文件读写
  - skill 参数引用解析
- `local-json-skill-loader.js`
  - 读取本地 `skill.json`
- `mcp-axios-client.js`
  - 基于 `axios` 的 MCP JSON-RPC 调用
- `direct-mcp-skill-runner.js`
  - 直接遍历 `steps` 调 MCP
- `local-json-schedule-engine.js`
  - 读取本地 `schedules.json`
  - 解析 cron
  - 注册 `setTimeout`
  - 启动时若已执行过则停止调度
- `local-scheduled-skill-runner.js`
  - 把调度、skill 读取、MCP 执行串起来

示例：

```powershell
node subprocess/schedule/local-scheduled-skill-runner.js
```

可选环境变量：

- `MCP_BASE_URL`
- `SCHEDULES_FILE`
- `SCHEDULE_HISTORY_FILE`
