# HANDOFF

更新时间：2026-06-03

## 下一次接手必读

1. `.ai/PROJECT_STATE.md`
2. `.ai/TODO.md`
3. `.ai/INDEX.md`

## 当前接手重点

- `.ai` 工作流已改为 HOT/WARM/COLD 三层。
- 默认读取不包含 `.ai/archive/`。
- 当前正式架构要求子进程保持轻量，不承担 MCP、脚本执行、任务记录上传。
- 事件触发任务脚本方案已在 `docs/` 下正式化。
- `webapp` 迁移已经进入“执行层接线”阶段，不再只是 UI 骨架。
- 当前主窗体真实可用的是最小正式会话协议；真实营小助服务和正式 MCP 还没接入。

## 最近动作

- 创建 `.ai/INDEX.md`。
- 新增 HOT 文件：`.ai/PROJECT_STATE.md`、`.ai/TODO.md`、`.ai/HANDOFF.md`。
- 将初始长版工作流摘要归档到 `.ai/archive/2026-06-03-initial-ai-workflow.md`。
- 把 `webapp` 主窗体工作台、状态拆分、Vite 构建链路迁入当前仓库。
- 打通 `LIST_AGENTS / LIST_SESSIONS / CREATE_SESSION / GET_SESSION_DETAIL / USER_MESSAGE / CANCEL_RUN` 前后端链路。
- 新增主窗体执行层骨架：`chat-client`、`stream-parser`、`mcp-client`、`mcp-adapter`、`task-record-uploader`。
- 修复过渡会话运行时的流式分片重复问题，并新增 `tests/webappExecutionLayer.test.ts`。
- 当前测试状态：`npm test` 通过，`50/50`。
- 主窗体人工对话主流程已切换为独立网页端执行：网页端直接创建会话、直连流式接口、直连 MCP。
- 主窗体对子进程桥接的依赖已降为宿主增强能力，主要保留调度、授权和确认弹窗链路。
- 主窗体默认指向 `C:\dev\projects\work\yxz-agent-webapp` 提供的本机 mock：`8787` 会话服务、`8791` MCP 服务。
- 新增独立网页端说明文档：`docs/main-window-standalone-web.md`。
- 修复主窗体独立网页端布局错乱：将字体加载从 `AppProviders` 的 `createGlobalStyle @import` 移到 `webapp/index.html`，并补齐 `html/body/#root` 高度。
- 新增独立脚本执行引擎模块：`subprocess/service/execution/skillScriptEngine.ts`。
- 将脚本执行引擎按职责拆分为小驼峰模块：`skillScriptEngine.ts`、`skillScriptTypes.ts`、`skillScriptValidator.ts`、`skillScriptTemplate.ts`、`skillScriptBuiltinTools.ts`、`skillScriptExamples.ts`、`skillScriptErrors.ts`。
- 将脚本定义从旧版 `action/saveAs` 模式切换到正式 JSON DSL：`skillName/menuCode/skillVersion + executor/params/output/when/foreach`。
- `LocalSkillLoader`、调度执行链路、本地示例技能和 `run-local-skill.js` 已接入新引擎模块。
- 新引擎已支持模板变量、`beforeDelayMs`、`group`、`foreach`、`evaluate`/`wait`/`request` 内置工具，以及 `USER_CANCELED`、`VARIABLE_RESOLVE_FAILED` 等正式错误语义。
- 新增并更新脚本引擎相关测试；当前 `npm test` 通过，结果为 `56/56`。
- 继续对 `skillScriptEngine.ts` 做了一轮“只降复杂度、不改行为”的精简：抽出了统一步骤生命周期包装，减少 `tool/group/foreach` 三类步骤的重复逻辑。
- 当前脚本执行引擎已基本达到人工审查可读性要求；如需继续优化，优先级已低于任务子窗体正式接入。
- 已确认对话窗中的脚本执行回显口径：实时执行时只显示任务级摘要，不实时逐步显示每个脚本步骤；执行完成后提供可查看每一步结果的结构化历史记录。
- 已明确不采用“把每个脚本步骤都转成 assistant 文本泡泡”的方案，避免消息流与运行日志混淆。
- 为本地脚本联调补充了 `run-local-skill.js` 的 MCP 路径覆盖能力：支持 `MCP_SESSION_PATH`、`MCP_MESSAGE_PATH`、`MCP_SESSION_CLOSE_PATH`，并支持通过 `SKILL_EVENT_JSON` 或 `SKILL_EVENT_FILE` 注入 `$_EVENT`。
- 新增 `skills/test_mcp_2900_smoke.json` 和 `scripts/fixtures/test-mcp-2900-event.json`，可直接联调 `D:\Dev\work\test-mcp` 的 `menu-browser-mcp`。
- 新增 `npm run demo:skill:test-mcp`，默认连 `http://127.0.0.1:3000` 的 `test-mcp`，默认跑 `skills/test_mcp_2900_smoke.json`，也支持用命令参数覆盖 skill 文件和事件文件。
- 已在 2026-06-03 本机验证通过：`MCP_BASE_URL=http://127.0.0.1:3000`、`MCP_SESSION_PATH=/mcp`、`MCP_MESSAGE_PATH=/messages` 下，脚本可完成打开菜单、填值、勾选、点击和读取结果。
- 已修复本地 runner “脚本执行完成但进程不退出”的问题；根因是本地 CLI 在结果输出后未及时结束，导致 SSE/SDK 清理阶段把 Node 进程挂住。

## 仍需确认

- 任务子窗体关闭时，等待队列是否全部丢弃。
- 任务记录上传失败是否需要业务窗体执行层本地重试。
- 主窗体和任务子窗体是否共用同一套执行层基础库。
- 开阳 MCP 完整工具清单。
- 任务子窗体是否也按主窗体模式改为独立网页端直连正式接口。
- 任务子窗体执行层如何接入新独立脚本执行引擎，并补齐正式运行事件与任务记录上传链路。
- 对话窗中“任务级摘要”具体展示样式、入口位置，以及历史执行记录的查看交互。
