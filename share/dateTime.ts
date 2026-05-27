const DATE_TIME_REGEXP =
  /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/

function pad2(value: number): string {
  return value.toString().padStart(2, "0")
}

export function formatDateTime(input: Date | number): string {
  const date = input instanceof Date ? input : new Date(input)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function formatNow(): string {
  return formatDateTime(new Date())
}

export function parseDateTime(value: string): Date {
  const matched = DATE_TIME_REGEXP.exec(value)
  if (!matched) {
    throw new Error(`Invalid datetime format: ${value}. Expected yyyy-MM-dd HH:mm:ss`)
  }

  const [, year, month, day, hour, minute, second] = matched
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )
}
