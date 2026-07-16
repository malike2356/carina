import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSkillMdContent,
  buildTriggers,
  extractKnowledgeStepsBody,
  generatedSkillName,
  loadGeneratedBrainKnowledgeSkills,
  shouldGenerateBrainSkill,
  writeGeneratedBrainSkills,
} from './brain-knowledge-skills.js';
import { parseKnowledgeMarkdownMeta } from './brain-knowledge-meta.js';
import { parseSkillMd } from './skill-md-loader.js';

describe('brain-knowledge-skills', () => {
  const tmpRoots: string[] = [];

  afterEach(async () => {
    for (const root of tmpRoots) {
      await fs.rm(root, { recursive: true, force: true });
    }
    tmpRoots.length = 0;
  });

  async function makeKnowledgeFixture(name: string, body: string): Promise<string> {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'brain-skills-'));
    tmpRoots.push(root);
    await fs.writeFile(path.join(root, name), body, 'utf-8');
    return root;
  }

  it('round-trips 08-carina knowledge into generated SKILL.md', async () => {
    const body = `# Carina AI Assistant

**Feature flags:** \`carina_ai\` (standard chat + RAG), \`carina_agent\` (tool-calling multi-step mode, Professional+)

Carina is the embedded AI assistant inside Propreneur. She answers property questions with RAG and tools.

## Overview
Use this knowledge when users ask about in-app Carina capabilities, routes, or feature flags.
`;
    const dir = await makeKnowledgeFixture('08-carina.md', body);
    const meta = parseKnowledgeMarkdownMeta(body, '08-carina.md');
    expect(generatedSkillName(meta)).toBe('kb-carina');

    const count = await writeGeneratedBrainSkills(dir);
    expect(count).toBe(1);

    const skills = await loadGeneratedBrainKnowledgeSkills(dir);
    expect(skills).toHaveLength(1);
    expect(skills[0]?.name).toBe('kb-carina');
    expect(skills[0]?.trigger).toContain('carina');
  });

  it('skips template and readme knowledge files', async () => {
    const dir = await makeKnowledgeFixture('99-template-knowledge-entry.md', '# Template\n\nShort.');
    await fs.writeFile(path.join(dir, '00-README.md'), '# Readme\n\nIndex only.', 'utf-8');
    await fs.writeFile(
      path.join(dir, '10-real-module.md'),
      '# Real Module\n\n'.padEnd(200, 'x'),
      'utf-8',
    );
    const count = await writeGeneratedBrainSkills(dir);
    expect(count).toBe(1);
  });

  it('buildSkillMdContent parses via skill-md-loader', () => {
    const meta = parseKnowledgeMarkdownMeta('# Deal Engine\n\nLong module text.', '04-deals.md');
    const md = buildSkillMdContent(meta, extractKnowledgeStepsBody('# Deal Engine\n\nLong module text.'));
    const doc = parseSkillMd(md, 'kb-deals.skill.md');
    expect(doc?.name).toBe('kb-deals');
    expect(buildTriggers(meta).length).toBeGreaterThan(0);
  });

  it('respects skill: false frontmatter', () => {
    const content = `---
skill: false
---
# Hidden
${'x'.repeat(200)}
`;
    expect(shouldGenerateBrainSkill('hidden.md', content)).toBe(false);
  });
});

describe('isBrainKnowledgeSkillsEnabled', () => {
  it('defaults to disabled', async () => {
    const prev = process.env.BRAIN_KNOWLEDGE_SKILLS_ENABLED;
    delete process.env.BRAIN_KNOWLEDGE_SKILLS_ENABLED;
    const { isBrainKnowledgeSkillsEnabled } = await import('./brain-knowledge-skills.js');
    expect(isBrainKnowledgeSkillsEnabled()).toBe(false);
    if (prev) process.env.BRAIN_KNOWLEDGE_SKILLS_ENABLED = prev;
  });
});
