import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';
import { parseKnowledgeMarkdownMeta } from './brain-knowledge-meta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePath = path.resolve(
  __dirname,
  '../../../../../propreneur/propreneur-v2/brain/knowledge/08-carina.md',
);

describe('parseKnowledgeMarkdownMeta', () => {
  it('maps Propreneur 08-carina.md to skill metadata', () => {
    let content: string;
    try {
      content = readFileSync(samplePath, 'utf-8');
    } catch {
      content = `# Carina AI Assistant

**Feature flag:** \`carina_ai\` (standard chat + RAG), \`carina_agent\` (tool-calling multi-step mode, Professional+)

Carina is the embedded AI assistant inside Propreneur.
`;
    }

    const meta = parseKnowledgeMarkdownMeta(content, '08-carina.md');
    expect(meta.title).toBe('Carina AI Assistant');
    expect(meta.skillName).toBe('carina');
    expect(meta.tags).toContain('carina');
    expect(meta.tags).toContain('carina_ai');
    expect(meta.description.length).toBeGreaterThan(10);
  });

  it('honours YAML frontmatter when present', () => {
    const content = `---
name: custom-skill-slug
title: Custom Title
description: Custom description for SKILL bridge
tags: property,compliance
---

# Ignored H1
`;
    const meta = parseKnowledgeMarkdownMeta(content, '12-example.md');
    expect(meta.skillName).toBe('custom-skill-slug');
    expect(meta.title).toBe('Custom Title');
    expect(meta.description).toBe('Custom description for SKILL bridge');
    expect(meta.tags).toEqual(expect.arrayContaining(['property', 'compliance']));
  });
});
