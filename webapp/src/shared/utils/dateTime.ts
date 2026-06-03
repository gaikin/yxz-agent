function toDate(value?: Date | string | number): Date | null {
  if (value === undefined || value === null || value === "") {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatNow(): string {
  return new Date().toISOString()
}

export function formatDisplayTime(value?: Date | string | number): string {
  const date = toDate(value)
  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function formatDisplayDateTime(value?: Date | string | number): string {
  const date = toDate(value)
  if (!date) {
    return "-"
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}
