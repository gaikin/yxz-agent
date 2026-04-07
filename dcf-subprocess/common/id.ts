export function createId(prefix: string, now = new Date()): string {
  const iso = now.toISOString().replace(/[-:.TZ]/g, "")
  return `${prefix}_${iso}`
}

