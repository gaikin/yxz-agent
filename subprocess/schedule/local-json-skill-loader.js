"use strict"

const path = require("node:path")
const { readJsonFile } = require("./utils")

function assertSkillDefinition(skill, source) {
  if (!skill || typeof skill !== "object" || Array.isArray(skill)) {
    throw new Error(`Invalid skill file: ${source}`)
  }

  const requiredStrings = ["skillId", "name"]
  for (const field of requiredStrings) {
    if (typeof skill[field] !== "string" || skill[field].length === 0) {
      throw new Error(`Invalid ${field} in ${source}`)
    }
  }

  if (typeof skill.version !== "number") {
    throw new Error(`Invalid version in ${source}`)
  }

  if (!Array.isArray(skill.steps)) {
    throw new Error(`Skill must define steps in ${source}`)
  }

  for (const [index, step] of skill.steps.entries()) {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new Error(`Invalid step at ${source}#${index}`)
    }
    if (typeof step.stepId !== "string" || step.stepId.length === 0) {
      throw new Error(`Invalid stepId at ${source}#${index}`)
    }
    if (typeof step.action !== "string" || step.action.length === 0) {
      throw new Error(`Invalid action at ${source}#${index}`)
    }
    if (!step.params || typeof step.params !== "object" || Array.isArray(step.params)) {
      throw new Error(`Invalid params at ${source}#${index}`)
    }
  }

  return skill
}

async function loadSkillFromFile(filePath) {
  const parsed = await readJsonFile(filePath)
  return assertSkillDefinition(parsed, filePath)
}

async function loadSkillsFromDirectory(directoryPath) {
  const fs = require("node:fs/promises")
  let entries = []
  try {
    entries = await fs.readdir(directoryPath)
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return []
    }
    throw error
  }

  const skills = []
  for (const fileName of entries) {
    if (!fileName.endsWith(".json")) {
      continue
    }
    skills.push(await loadSkillFromFile(path.join(directoryPath, fileName)))
  }
  return skills
}

module.exports = {
  loadSkillFromFile,
  loadSkillsFromDirectory,
}
