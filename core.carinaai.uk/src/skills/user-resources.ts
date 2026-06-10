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

export type CustomResourceKind = 'skill' | 'knowledge';

export interface CustomResourceFile {
  kind: CustomResourceKind;
  name: string;
  size: number;
  updatedAt: string;
}

function safeBasename(filename: string): string {
  const base = path.basename(filename).replace(/[^\w.\-]+/g, '-');
  if (!base || base === '.' || base === '..') {
    throw new Error('Invalid filename');
  }
  return base;
}

function targetDir(kind: CustomResourceKind, baseDir = getResourcesDir()): string {
  return path.join(baseDir, kind === 'skill' ? 'skills' : 'knowledge');
}

export async function listCustomResources(baseDir = getResourcesDir()): Promise<CustomResourceFile[]> {
  await ensureResourcesLayout(baseDir);
  const files: CustomResourceFile[] = [];

  for (const kind of ['skill', 'knowledge'] as const) {
    const dir = targetDir(kind, baseDir);
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (kind === 'skill' && ext !== '.json') continue;
      if (kind === 'knowledge' && ext !== '.md' && ext !== '.txt') continue;
      const stat = await fs.stat(path.join(dir, entry.name));
      files.push({
        kind,
        name: entry.name,
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
      });
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveCustomResource(
  kind: CustomResourceKind,
  filename: string,
  content: string,
  baseDir = getResourcesDir(),
): Promise<CustomResourceFile> {
  await ensureResourcesLayout(baseDir);
  const safeName = safeBasename(filename);
  const ext = path.extname(safeName).toLowerCase();
  if (kind === 'skill' && ext !== '.json') {
    throw new Error('Skill files must be .json');
  }
  if (kind === 'knowledge' && ext !== '.md' && ext !== '.txt') {
    throw new Error('Knowledge files must be .md or .txt');
  }
  if (kind === 'skill') {
    const parsed = JSON.parse(content) as PackSkillInput | PackSkillInput[] | { skills: PackSkillInput[] };
    const skills = Array.isArray(parsed)
      ? parsed
      : 'skills' in parsed && Array.isArray(parsed.skills)
        ? parsed.skills
        : [parsed as PackSkillInput];
    if (!skills.length || !skills[0]?.name) {
      throw new Error('Skill JSON must include at least one skill with a name');
    }
  }

  const dest = path.join(targetDir(kind, baseDir), safeName);
  await fs.writeFile(dest, content, 'utf8');
  const stat = await fs.stat(dest);
  return {
    kind,
    name: safeName,
    size: stat.size,
    updatedAt: stat.mtime.toISOString(),
  };
}

export async function deleteCustomResource(
  kind: CustomResourceKind,
  filename: string,
  baseDir = getResourcesDir(),
): Promise<void> {
  const safeName = safeBasename(filename);
  const dest = path.join(targetDir(kind, baseDir), safeName);
  await fs.unlink(dest);
}
