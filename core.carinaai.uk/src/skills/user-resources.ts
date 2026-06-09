import fs from 'fs/promises';
import path from 'path';
import { CARINA_RESOURCES_DIR } from '../config/paths.js';
import { saveSkill, skillExistsByName } from './store.js';
import { ingestPackDirectory } from './ingestion.js';
import type { PackSkillInput } from './packs/property-uk/skills.js';

export function getResourcesDir(): string {
  return CARINA_RESOURCES_DIR;
}

export async function ensureResourcesLayout(baseDir = getResourcesDir()): Promise<void> {
  await fs.mkdir(path.join(baseDir, 'skills'), { recursive: true });
  await fs.mkdir(path.join(baseDir, 'knowledge'), { recursive: true });
  await fs.mkdir(path.join(baseDir, 'packs'), { recursive: true });
}

export async function loadUserSkillsFromDir(baseDir = getResourcesDir()): Promise<number> {
  const skillsDir = path.join(baseDir, 'skills');
  await ensureResourcesLayout(baseDir);

  let loaded = 0;
  const entries = await fs.readdir(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.json')) continue;

    const raw = await fs.readFile(path.join(skillsDir, entry.name), 'utf8');
    const parsed = JSON.parse(raw) as PackSkillInput | PackSkillInput[] | { skills: PackSkillInput[] };
    const skills = Array.isArray(parsed)
      ? parsed
      : 'skills' in parsed && Array.isArray(parsed.skills)
        ? parsed.skills
        : [parsed as PackSkillInput];

    for (const skill of skills) {
      if (!skill.name || !skill.description || !skill.steps) continue;
      if (await skillExistsByName(skill.name)) continue;
      await saveSkill(skill);
      loaded++;
    }
  }

  return loaded;
}

export async function importSkillFile(filePath: string): Promise<string> {
  const resolved = path.resolve(filePath);
  const raw = await fs.readFile(resolved, 'utf8');
  const parsed = JSON.parse(raw) as PackSkillInput | { skills: PackSkillInput[] };
  const skills = 'skills' in parsed && Array.isArray(parsed.skills) ? parsed.skills : [parsed as PackSkillInput];

  let loaded = 0;
  for (const skill of skills) {
    if (await skillExistsByName(skill.name)) continue;
    await saveSkill(skill);
    loaded++;
  }
  return `Loaded ${loaded} skill(s) from ${resolved}`;
}

export async function ingestUserKnowledge(baseDir = getResourcesDir()): Promise<number> {
  const knowledgeDir = path.join(baseDir, 'knowledge');
  try {
    await fs.access(knowledgeDir);
  } catch {
    return 0;
  }
  return ingestPackDirectory('user-resources', knowledgeDir);
}

export async function loadAllUserResources(baseDir = getResourcesDir()): Promise<{
  skillsLoaded: number;
  chunksIngested: number;
}> {
  const skillsLoaded = await loadUserSkillsFromDir(baseDir);
  const chunksIngested = await ingestUserKnowledge(baseDir);
  return { skillsLoaded, chunksIngested };
}
