import fs from "node:fs/promises"
import path from "node:path"
import type { SkillDefinition } from "./SkillService"

function isRecord(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input)
}

function assertSkillDefinition(input: unknown, filePath: string): SkillDefinition {
  if (!isRecord(input)) {
    throw new Error(`Invalid skill json: ${filePath}`)
  }

  if (typeof input.skillId !== "string" || input.skillId.length === 0) {
    throw new Error(`Invalid skillId in ${filePath}`)
  }

  if (typeof input.name !== "string" || input.name.length === 0) {
    throw new Error(`Invalid name in ${filePath}`)
  }

  if (typeof input.version !== "number") {
    throw new Error(`Invalid version in ${filePath}`)
  }

  if (!Array.isArray(input.steps)) {
    throw new Error(`Skill must define steps in ${filePath}`)
  }

  return input as unknown as SkillDefinition
}

export async function loadSkillFromFile(filePath: string): Promise<SkillDefinition> {
  const raw = await fs.readFile(filePath, "utf-8")
  const parsed = JSON.parse(raw) as unknown
  return assertSkillDefinition(parsed, filePath)
}

export async function loadSkillsFromDirectory(workspaceRoot: string): Promise<SkillDefinition[]> {
  const skillsDir = path.join(workspaceRoot, "skills")

  let fileNames: string[]
  try {
    fileNames = await fs.readdir(skillsDir)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw error
  }

  const skills: SkillDefinition[] = []
  for (const fileName of fileNames) {
    if (!fileName.endsWith(".json")) {
      continue
    }
    skills.push(await loadSkillFromFile(path.join(skillsDir, fileName)))
  }

  return skills
}
