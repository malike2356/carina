import fs from 'fs/promises';
import path from 'path';
import { validatePackDir } from './validate.js';
import { lintPackSkills } from '../skill-lint.js';
import type { PackSkillInput } from '../pack-types.js';

export type DomainPackScaffold = {
  dir: string;
  name: string;
  files: string[];
};

const PACK_JSON_TEMPLATE = (input: {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
}) => JSON.stringify({
  name: input.name,
  version: input.version,
  description: input.description,
  author: input.author,
  category: input.category,
  license: 'MIT',
  minCarinaVersion: '0.2.0',
  skillCount: 1,
}, null, 2);

const SKILLS_JSON_TEMPLATE = (packName: string): PackSkillInput[] => [
  {
    name: `${packName}-hello`,
    description: `Starter skill for the ${packName} domain pack.`,
    trigger: [`${packName}`, 'getting started'],
    steps: `1. Greet the operator and confirm the ${packName} pack is active.\n2. List available knowledge files in the pack.\n3. Offer one concrete next action for this domain.`,
    toolsUsed: ['file-read'],
  },
];

const KNOWLEDGE_TEMPLATE = (packName: string, author: string) => `# ${packName} domain knowledge

Author: ${author}

Replace this file with domain-specific procedures, regulations, and reference material.
Do not embed API keys or credentials in knowledge files; the hub validator rejects them.
`;

const MARKETPLACE_TEMPLATE = (input: {
  name: string;
  version: string;
  description: string;
  author: string;
  category: string;
}) => ({
  kind: 'pack',
  slug: input.name,
  name: `${input.name} pack`,
  version: input.version,
  description: input.description,
  author: input.author,
  category: input.category,
  tags: [input.category, 'domain-pack', 'third-party'],
  trust: {
    publisher: 'community',
    featured: false,
    verified: false,
    validation: 'pending',
    risk: 'low',
    evalRequired: true,
  },
  install: {
    source: 'hub',
    ref: input.name,
  },
});

export async function initDomainPackDirectory(input: {
  targetDir: string;
  name: string;
  author: string;
  description: string;
  category?: string;
  version?: string;
}): Promise<DomainPackScaffold> {
  const name = input.name.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (!/^[a-z][a-z0-9-]{1,62}$/.test(name)) {
    throw new Error('Pack name must be lowercase kebab-case');
  }
  const dir = path.resolve(input.targetDir);
  await fs.mkdir(dir, { recursive: true });
  const category = input.category ?? 'general';
  const version = input.version ?? '0.1.0';
  const meta = {
    name,
    version,
    description: input.description,
    author: input.author,
    category,
  };

  const files: string[] = [];
  const packJson = path.join(dir, 'pack.json');
  await fs.writeFile(packJson, PACK_JSON_TEMPLATE(meta), 'utf8');
  files.push('pack.json');

  const skillsJson = path.join(dir, 'skills.json');
  const skills = SKILLS_JSON_TEMPLATE(name);
  await fs.writeFile(skillsJson, JSON.stringify(skills, null, 2), 'utf8');
  files.push('skills.json');

  const knowledgeDir = path.join(dir, 'knowledge');
  await fs.mkdir(knowledgeDir, { recursive: true });
  const knowledgeFile = path.join(knowledgeDir, '00-overview.md');
  await fs.writeFile(knowledgeFile, KNOWLEDGE_TEMPLATE(name, input.author), 'utf8');
  files.push('knowledge/00-overview.md');

  const marketplaceFile = path.join(dir, 'marketplace.json');
  await fs.writeFile(marketplaceFile, JSON.stringify(MARKETPLACE_TEMPLATE(meta), null, 2), 'utf8');
  files.push('marketplace.json');

  const readme = path.join(dir, 'README.md');
  await fs.writeFile(readme, `# ${name} (Carina domain pack)\n\n${input.description}\n\nPublish: \`carina hub publish ${dir}\`\n`, 'utf8');
  files.push('README.md');

  return { dir, name, files };
}

export async function validateDomainPackForPublish(packDir: string): Promise<{
  ok: boolean;
  manifest: Awaited<ReturnType<typeof validatePackDir>>;
  skillLint: ReturnType<typeof lintPackSkills>;
  issues: string[];
}> {
  const resolved = path.resolve(packDir);
  const manifest = await validatePackDir(resolved);
  const skillsPath = path.join(resolved, 'skills.json');
  let skills: PackSkillInput[] = [];
  try {
    skills = JSON.parse(await fs.readFile(skillsPath, 'utf-8')) as PackSkillInput[];
  } catch {
    // skills.ts packs validated separately at publish time
  }
  const skillLint = lintPackSkills(skills, manifest.name);
  const issues: string[] = [];
  if (!skillLint.ok) {
    issues.push(...skillLint.issues.filter((i) => i.level === 'error').map((i) => i.message));
  }
  if (!manifest.author?.trim()) {
    issues.push('pack.json author is required for third-party ecosystem listing');
  }
  return {
    ok: issues.length === 0,
    manifest,
    skillLint,
    issues,
  };
}
