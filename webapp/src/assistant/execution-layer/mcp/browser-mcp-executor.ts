import {
  JsonRpcMcpToolClient,
  SseSessionJsonRpcToolTransport,
} from "../../../../../subprocess/service/execution/mcpToolClient"
import { getWebappRuntimeConfig } from "../../../shared/runtime-config"
import type { McpExecutor, McpExecutionRequest } from "./mcp-client"
import type { McpToolCallRawResult } from "./types"

function buildMcpUnavailableResult(request: McpExecutionRequest): McpToolCallRawResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `MCP tool "${request.toolName}" is unavailable because VITE_MCP_BASE_URL is not configured.`,
      },
    ],
  }
}

export function createBrowserMcpExecutor(baseUrl?: string): McpExecutor {
  const normalizedBaseUrl = (baseUrl ?? getWebappRuntimeConfig().mcpBaseUrl).trim()
  if (!normalizedBaseUrl) {
    return async (request) => buildMcpUnavailableResult(request)
  }

  const transport = new SseSessionJsonRpcToolTransport(normalizedBaseUrl)
  const client = new JsonRpcMcpToolClient(transport)

  return async (request) => {
    try {
      const result = await client.call(request.toolName, request.input ?? {})
      return result as McpToolCallRawResult
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text:
              error instanceof Error
                ? error.message
                : `MCP tool "${request.toolName}" execution failed.`,
          },
        ],
      }
    }
  }
}
