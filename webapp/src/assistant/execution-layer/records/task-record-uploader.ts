export type TaskRecordPayload = {
  runId: string
  sessionId: string
  title: string
  status: "completed" | "failed" | "cancelled"
  startedAt: string
  finishedAt: string
  summary?: string
}

export type TaskRecordUploadResult = {
  ok: boolean
  recordId?: string
  error?: string
}

export type TaskRecordUploadAttempt = {
  payload: TaskRecordPayload
  result: TaskRecordUploadResult
  uploadedAt: string
}

export type TaskRecordUploadHandler = (
  payload: TaskRecordPayload
) => Promise<TaskRecordUploadResult>

export class TaskRecordUploader {
  private readonly attempts: TaskRecordUploadAttempt[] = []

  constructor(private readonly uploadHandler?: TaskRecordUploadHandler) {}

  async upload(payload: TaskRecordPayload): Promise<TaskRecordUploadResult> {
    const result = this.uploadHandler
      ? await this.uploadHandler(payload)
      : {
          ok: false,
          error: "Task record upload endpoint is not connected in the current migration stage.",
        }

    this.attempts.push({
      payload,
      result,
      uploadedAt: new Date().toISOString(),
    })

    return result
  }

  getAttempts(): TaskRecordUploadAttempt[] {
    return [...this.attempts]
  }
}
