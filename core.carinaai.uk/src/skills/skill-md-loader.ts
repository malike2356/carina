import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import type { Skill } from '../types/index.js';

export interface SkillMdDocument {
  name: string;
  description: string;
  trigger: string[];
  steps: string;
  toolsUsed: string[];
  sourcePath: string;
}

const SKILL_MD_CACHE = new Map<string, SkillMdDocument>();

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    meta[key] = value;
  }
  return { meta, body: match[2].trim() };
}

function triggersFromMeta(meta: Record<string, string>, body: string): string[] {
  if (meta.triggers) {
    return meta.triggers.split(',').map((t) => t.trim()).filter(Boolean);
  }
  if (meta.trigger) {
    return meta.trigger.split(',').map((t) => t.trim()).filter(Boolean);
  }
  const firstLine = body.split('\n').find((l) => l.trim()) ?? '';
  return firstLine ? [firstLine.slice(0, 40).toLowerCase()] : [];
}

export function parseSkillMd(content: string, sourcePath: string): SkillMdDocument | null {
  const { meta, body } = parseFrontmatter(content);
  const name = meta.name ?? path.basename(sourcePath, '.md');
  if (!name || !body) return null;

  return {
    name,
    description: meta.description ?? `SKILL.md skill: ${name}`,
    trigger: triggersFromMeta(meta, body),
    steps: body,
    toolsUsed: meta.tools
      ? meta.tools.split(',').map((t) => t.trim()).filter(Boolean)
      : [],
    sourcePath,
  };
}

async function walkSkillDir(dir: string, found: SkillMdDocument[]): Promise<void> {
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
      await walkSkillDir(full, found);
      continue;
    }
    if (entry.toUpperCase() === 'SKILL.MD' || entry.endsWith('.skill.md')) {
      const content = await fs.readFile(full, 'utf8');
      const doc = parseSkillMd(content, full);
      if (doc) found.push(doc);
    }
  }
}

export function skillMdDirs(): string[] {
  const dirs = [
    path.join(os.homedir(), '.carina', 'skills'),
    process.env.CARINA_SKILLS_DIR ?? '',
    process.env.CARINA_RESOURCES_DIR ? path.join(process.env.CARINA_RESOURCES_DIR, 'skills') : '',
  ].filter(Boolean);
  return [...new Set(dirs)];
}

export async function loadSkillMdDocuments(): Promise<SkillMdDocument[]> {
  const found: SkillMdDocument[] = [];
  for (const dir of skillMdDirs()) {
    await walkSkillDir(dir, found);
  }
  SKILL_MD_CACHE.clear();
  for (const doc of found) {
    SKILL_MD_CACHE.set(doc.name, doc);
  }
  return found;
}

export function findSkillMdByKeywords(keywords: string[]): SkillMdDocument[] {
  if (keywords.length === 0) return [];
  const lower = keywords.map((k) => k.toLowerCase());
  const matches: Array<{ doc: SkillMdDocument; score: number }> = [];

  for (const doc of SKILL_MD_CACHE.values()) {
    let score = 0;
    for (const kw of lower) {
      if (doc.name.toLowerCase().includes(kw)) score += 2;
      for (const trigger of doc.trigger) {
        if (trigger.toLowerCase().includes(kw) || kw.includes(trigger.toLowerCase())) score += 1;
      }
      if (doc.description.toLowerCase().includes(kw)) score += 0.5;
    }
    if (score > 0) matches.push({ doc, score });
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((m) => m.doc);
}

export function skillMdToSkill(doc: SkillMdDocument): Skill {
  return {
    id: `skillmd:${doc.name}`,
    name: doc.name,
    description: doc.description,
    trigger: doc.trigger,
    steps: doc.steps,
    toolsUsed: doc.toolsUsed,
    createdAt: new Date(),
    usageCount: 0,
  };
}
