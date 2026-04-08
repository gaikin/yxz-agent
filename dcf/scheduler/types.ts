import type { AutomationAuthorizationState, ScheduleExecutionStatus, SchedulePendingExecutionItem } from "../../types/frontendProtocol"
import type { SkillExecutionResult } from "../skills/types"

export interface ScheduleDefinition {
  scheduleId: string
  name: string
  cronExpression: string
  timezone: string
  skillId: string
}

export interface ScheduleRuntimeState {
  scheduleId: string
  enabled: boolean
  nextTriggerAt?: string
  lastTriggeredAt?: string
  lastCompletedAt?: string
  lastStatus?: ScheduleExecutionStatus
  lastRunId?: string
  lastError?: {
    code: string
    message: string
  }
}

export interface ScheduleRunRecord {
  executionId: string
  scheduleId: string
  scheduleName: string
  requestedAt: string
  runId?: string
  startedAt?: string
  completedAt?: string
  status: SchedulePendingExecutionItem["status"]
  result?: SkillExecutionResult
}

export interface DcfConfig {
  mcpBaseUrl: string
  schedules: ScheduleDefinition[]
}

export interface PopupEventPublisher {
  publishOverview(): Promise<void>
}

export interface PendingExecutionNotifier {
  notify(overview: import("../../types/frontendProtocol").ScheduleExecutionOverview): Promise<void>
}

export interface FrontendEventPublisher {
  publishBootstrapState(): Promise<void>
  publishAutomationAuthorized(authorizedAt: string): Promise<void>
  publishScheduleStateSnapshot(): Promise<void>
  publishScheduleEnabled(scheduleId: string, nextTriggerAt?: string): Promise<void>
  publishScheduleDisabled(scheduleId: string): Promise<void>
}

export interface BootstrapSnapshot {
  automationAuthorization: AutomationAuthorizationState
  runtime: {
    dcfStatus: "starting" | "online" | "error"
    kaiyangStatus?: "disconnected" | "connecting" | "connected" | "reconnecting" | "degraded"
    kaiyangAuthorizationStatus?: "authorizing" | "authorized" | "failed"
    kaiyangEventHookStatus?: "subscribing" | "subscribed" | "failed"
    scheduleSubsystemReady: boolean
  }
}


