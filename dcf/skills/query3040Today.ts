import type { SkillDefinition } from "./types"

export const query3040TodaySkill: SkillDefinition = {
  skillId: "query_3040_today",
  name: "3040当日查询",
  description: "打开3040，点击查询，并直接返回最后一个工具结果",
  version: 1,
  tools: [
    {
      toolId: "open_menu",
      tool: "openMenu",
      args: {
        menuShortCode: "3040",
      },
      saveAs: "tabInfo",
    },
    {
      toolId: "execute_query",
      tool: "executePageCommands",
      args: {
        tabIdFrom: "tabInfo.tabId",
        commands: [
          {
            componentId: "btn_query_1",
            command: "click",
          },
        ],
      },
      saveAs: "queryResult",
    },
  ],
}

