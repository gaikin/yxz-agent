export function getByPath(values: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".")
  let current: unknown = values

  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      throw new Error(`Path not found: ${path}`)
    }

    current = (current as Record<string, unknown>)[segment]

    if (current === undefined) {
      throw new Error(`Path not found: ${path}`)
    }
  }

  return current
}

export function resolveArgs(input: unknown, values: Record<string, unknown>): unknown {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveArgs(item, values))
  }

  if (typeof input === "object") {
    const output: Record<string, unknown> = {}

    for (const [key, value] of Object.entries(input)) {
      if (key.endsWith("From")) {
        const realKey = key.slice(0, -4)
        output[realKey] = getByPath(values, String(value))
      } else {
        output[key] = resolveArgs(value, values)
      }
    }

    return output
  }

  return input
}

