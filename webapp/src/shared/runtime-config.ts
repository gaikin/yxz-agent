export type WebappRuntimeConfig = {
  assistantCreateUrl?: string
  assistantStreamUrl?: string
  assistantReportUrl?: string
  mcpBaseUrl?: string
}

declare global {
  var __YXZ_WEBAPP_CONFIG__: WebappRuntimeConfig | undefined
}

function resolveOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin
  }

  return "http://127.0.0.1"
}

export function getWebappRuntimeConfig(): Required<WebappRuntimeConfig> {
  const config = globalThis.__YXZ_WEBAPP_CONFIG__ ?? {}
  const origin = resolveOrigin()
  const defaultAssistantBaseUrl = "http://127.0.0.1:8787"
  const defaultMcpBaseUrl = "http://127.0.0.1:8791/api/v1/mcp"

  return {
    assistantCreateUrl:
      config.assistantCreateUrl ??
      (typeof window !== "undefined"
        ? `${defaultAssistantBaseUrl}/api/conversations/create`
        : `${origin}/api/conversations/create`),
    assistantStreamUrl:
      config.assistantStreamUrl ??
      (typeof window !== "undefined"
        ? `${defaultAssistantBaseUrl}/api/conversations/:conversationId/stream`
        : `${origin}/api/conversations/:conversationId/stream`),
    assistantReportUrl:
      config.assistantReportUrl ??
      (typeof window !== "undefined"
        ? `${defaultAssistantBaseUrl}/api/conversations/:conversationId/report`
        : `${origin}/api/conversations/:conversationId/report`),
    mcpBaseUrl:
      config.mcpBaseUrl ??
      (typeof window !== "undefined" ? defaultMcpBaseUrl : `${origin}/api/v1/mcp`),
  }
}
