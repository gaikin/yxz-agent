import { formatDateTime } from "../../../share/dateTime"

export function createId(prefix: string, date = new Date()): string {
  const timestamp = formatDateTime(date).replace(/[-:\s]/g, "")
  const random = Math.random().toString(36).slice(2, 8)
  return `${prefix}_${timestamp}_${random}`
}
