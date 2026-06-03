import fs from "node:fs/promises"
import path from "node:path"
import {
  assertSkillScriptDefinition,
  type SkillDefinition,
} from "./execution/skillScriptEngine"

export async function loadSkillFromFile(filePath: string): Promise<SkillDefinition> {
  const raw = await fs.readFile(filePath, "utf-8")
  const parsed = JSON.parse(raw) as unknown
  assertSkillScriptDefinition(parsed, filePath)
  return parsed
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
