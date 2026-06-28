import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import type { PackSkillInput } from './pack-types.js';
import {
  parseKnowledgeMarkdownMeta,
  type KnowledgeSkillMeta,
} from './brain-knowledge-meta.js';
import { parseSkillMd } from './skill-md-loader.js';

const GENERATED_DIR = '.generated-skills';
const MAX_STEPS_CHARS = 2_500;
const SKIP_FILES = new Set([
  '00-readme.md',
  '99-template-knowledge-entry.md',
]);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE_PACKAGE_ROOT = path.resolve(__dirname, '../../..');

export function isBrainKnowledgeSkillsEnabled(): boolean {
  return process.env.BRAIN_KNOWLEDGE_SKILLS_ENABLED === 'true';
}

export function defaultBrainKnowledgeDir(): string {
  const override = process.env.BRAIN_KNOWLEDGE_PATH?.trim();
  if (override) return override;
  return path.join(
    CORE_PACKAGE_ROOT,
    'brain/uk_property_knowldge_from_propreneur/knowledge',
  );
}

export function generatedSkillsDir(knowledgeDir: string): string {
  return path.join(knowledgeDir, GENERATED_DIR);
}

export function generatedSkillName(meta: KnowledgeSkillMeta): string {
  const base = meta.skillName.startsWith('kb-') ? meta.skillName : `kb-${meta.skillName}`;
  return base.slice(0, 64);
}

function stripFrontmatter(content: string): string {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/);
  return (match?.[1] ?? content).trim();
}

export function extractKnowledgeStepsBody(content: string): string {
  const body = stripFrontmatter(content);
  const overview = body.match(/## Overview\s*\n([\s\S]*?)(?=\n## |\n# |$)/i);
  const excerpt = (overview?.[1] ?? body).trim();
  if (excerpt.length <= MAX_STEPS_CHARS) return excerpt;
  return `${excerpt.slice(0, MAX_STEPS_CHARS).trim()}\n\n[Truncated; see source knowledge file for full detail.]`;
}

export function buildTriggers(meta: KnowledgeSkillMeta): string[] {
  const triggers = new Set<string>();
  for (const tag of meta.tags) {
    if (tag.length >= 2) triggers.add(tag);
  }
  for (const word of meta.title.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length >= 3) triggers.add(word);
  }
  triggers.add(meta.skillName);
  return [...triggers].slice(0, 12);
}

export function shouldGenerateBrainSkill(
  filename: string,
  rawContent: string,
): boolean {
  const lower = filename.toLowerCase();
  if (SKIP_FILES.has(lower)) return false;
  if (lower.startsWith('_')) return false;

  const { meta, body } = (() => {
    const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
    if (!match) return { meta: {} as Record<string, string>, body: rawContent };
    const parsed: Record<string, string> = {};
    for (const line of match[1].split('\n')) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      parsed[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return { meta: parsed, body: match[2] };
  })();

  if (meta.skill === 'false' || meta.generate_skill === 'false') return false;
  if (meta.skill === 'true' || meta.generate_skill === 'true') return true;

  const text = stripFrontmatter(rawContent);
  return text.length >= 120;
}

export function buildSkillMdContent(meta: KnowledgeSkillMeta, stepsBody: string): string {
  const name = generatedSkillName(meta);
  const triggers = buildTriggers(meta);
  return `---
name: ${name}
description: ${meta.description.replace(/\n/g, ' ')}
triggers: ${triggers.join(', ')}
tools: file-read, web-search
source: ${meta.sourceFile}
pack: property-uk
---

# ${meta.title}

${stepsBody}
`;
}

async function walkKnowledgeMarkdown(knowledgeDir: string): Promise<string[]> {
  const files: string[] = [];
  let entries;
  try {
    entries = await fs.readdir(knowledgeDir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of entries) {
    if (entry.name === GENERATED_DIR || entry.name.startsWith('.')) continue;
    const full = path.join(knowledgeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkKnowledgeMarkdown(full));
    } else if (entry.name.endsWith('.md')) {
      files.push(full);
    }
  }
  return files;
}

export async function writeGeneratedBrainSkills(knowledgeDir: string): Promise<number> {
  const outDir = generatedSkillsDir(knowledgeDir);
  await fs.mkdir(outDir, { recursive: true });

  const files = await walkKnowledgeMarkdown(knowledgeDir);
  const written = new Set<string>();
  let count = 0;

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    const filename = path.basename(file);
    if (!shouldGenerateBrainSkill(filename, content)) continue;

    const meta = parseKnowledgeMarkdownMeta(content, filename);
    const skillName = generatedSkillName(meta);
    const outPath = path.join(outDir, `${skillName}.skill.md`);
    const skillMd = buildSkillMdContent(meta, extractKnowledgeStepsBody(content));
    await fs.writeFile(outPath, skillMd, 'utf-8');
    written.add(`${skillName}.skill.md`);
    count += 1;
  }

  const existing = await fs.readdir(outDir).catch(() => [] as string[]);
  for (const entry of existing) {
    if (!entry.endsWith('.skill.md')) continue;
    if (!written.has(entry)) {
      await fs.unlink(path.join(outDir, entry)).catch(() => {});
    }
  }

  return count;
}

export async function loadGeneratedBrainKnowledgeSkills(
  knowledgeDir = defaultBrainKnowledgeDir(),
): Promise<PackSkillInput[]> {
  const outDir = generatedSkillsDir(knowledgeDir);
  let entries: string[];
  try {
    entries = await fs.readdir(outDir);
  } catch {
    return [];
  }

  const skills: PackSkillInput[] = [];
  for (const entry of entries) {
    if (!entry.endsWith('.skill.md')) continue;
    const full = path.join(outDir, entry);
    const content = await fs.readFile(full, 'utf-8');
    const doc = parseSkillMd(content, full);
    if (!doc) continue;
    skills.push({
      name: doc.name,
      description: doc.description,
      trigger: doc.trigger,
      steps: doc.steps,
      toolsUsed: doc.toolsUsed,
    });
  }
  return skills;
}

export async function loadBrainKnowledgeSkillsIntoStore(
  knowledgeDir = defaultBrainKnowledgeDir(),
): Promise<number> {
  if (!isBrainKnowledgeSkillsEnabled()) return 0;

  const { saveSkill, skillExistsByName, updateSkill } = await import('./store.js');
  const skills = await loadGeneratedBrainKnowledgeSkills(knowledgeDir);
  let loaded = 0;

  for (const skill of skills) {
    if (await skillExistsByName(skill.name)) {
      await updateSkill(skill.name, {
        description: skill.description,
        trigger: skill.trigger,
        steps: skill.steps,
        toolsUsed: skill.toolsUsed,
      });
    } else {
      await saveSkill(skill);
      loaded += 1;
    }
  }
  return loaded;
}
