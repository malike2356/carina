import fs from 'fs/promises';
import path from 'path';
import { resolveCarinaHome } from '../../config/paths.js';
import type { CarinaSkill } from './types.js';
import { serializeCarinaSkill, parseCarinaSkillMarkdown } from './serialize.js';
import { slugify } from './utils.js';

export function importedSkillsRoot(): string {
  return path.join(resolveCarinaHome(), 'skills', 'imported');
}

export function importedSkillPath(hub: string, name: string): string {
  return path.join(importedSkillsRoot(), slugify(hub), `${slugify(name)}.md`);
}

export async function writeImportedSkill(skill: CarinaSkill): Promise<string> {
  const filePath = importedSkillPath(skill.source.hub, skill.name);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeCarinaSkill(skill), 'utf8');
  return filePath;
}

export async function listImportedSkills(): Promise<Array<{ skill: CarinaSkill; filePath: string }>> {
  const root = importedSkillsRoot();
  const results: Array<{ skill: CarinaSkill; filePath: string }> = [];

  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = await fs.stat(full).catch(() => null);
      if (!stat) continue;
      if (stat.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.endsWith('.md')) continue;
      const raw = await fs.readFile(full, 'utf8');
      const skill = parseCarinaSkillMarkdown(raw, full);
      if (skill) results.push({ skill, filePath: full });
    }
  }

  await walk(root);
  return results;
}

export async function readImportedSkill(hub: string, name: string): Promise<CarinaSkill | null> {
  const filePath = importedSkillPath(hub, name);
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return parseCarinaSkillMarkdown(raw, filePath);
  } catch {
    return null;
  }
}

export function importedSkillDirs(): string[] {
  return [importedSkillsRoot()];
}
