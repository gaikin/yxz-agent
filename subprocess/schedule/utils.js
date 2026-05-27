"use strict"

const fs = require("node:fs/promises")
const path = require("node:path")

function pad2(value) {
  return String(value).padStart(2, "0")
}

function formatDateTime(input) {
  const date = input instanceof Date ? input : new Date(input)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(
    date.getHours()
  )}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

async function readJsonFile(filePath, defaultValue) {
  try {
    const raw = await fs.readFile(filePath, "utf-8")
    return JSON.parse(raw)
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return defaultValue
    }
    throw error
  }
}

async function writeJsonFile(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8")
}

function getByPath(values, pathText) {
  const segments = String(pathText).split(".")
  let current = values

  for (const segment of segments) {
    if (current === null || typeof current !== "object") {
      throw new Error(`Path not found: ${pathText}`)
    }

    current = current[segment]
    if (current === undefined) {
      throw new Error(`Path not found: ${pathText}`)
    }
  }

  return current
}

function resolveParams(input, values) {
  if (
    input === null ||
    typeof input === "string" ||
    typeof input === "number" ||
    typeof input === "boolean"
  ) {
    return input
  }

  if (Array.isArray(input)) {
    return input.map((item) => resolveParams(item, values))
  }

  if (typeof input === "object") {
    const output = {}
    for (const [key, value] of Object.entries(input)) {
      if (key.endsWith("From")) {
        output[key.slice(0, -4)] = getByPath(values, value)
      } else {
        output[key] = resolveParams(value, values)
      }
    }
    return output
  }

  return input
}

module.exports = {
  formatDateTime,
  readJsonFile,
  writeJsonFile,
  getByPath,
  resolveParams,
}
