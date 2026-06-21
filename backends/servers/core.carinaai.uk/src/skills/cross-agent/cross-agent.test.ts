import { describe, expect, it } from 'vitest';
import { detectFormatFromSignatures } from './detector.js';
import { cursorRulesConverter, genericSkillMdConverter, plainInstructionsConverter } from './converters/index.js';
import { serializeCarinaSkill, parseCarinaSkillMarkdown } from './serialize.js';
import { getConverter, listConverterIds } from './converter-router.js';

describe('cross-agent detector', () => {
  it('detects cursor rules', () => {
    const content = 'You are an expert in Rust development.\n\nAlways use cargo clippy.';
    const result = detectFormatFromSignatures(content, 'rust-expert.cursorrules');
    expect(result.format).toBe('cursor-rules');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('detects generic skill md', () => {
    const content = '---\nname: test-skill\ndescription: A test\n---\n\nDo the thing.';
    const result = detectFormatFromSignatures(content, 'SKILL.md');
    expect(result.format).toBe('generic-skill-md');
  });

  it('routes unknown formats to llm fallback', () => {
    const result = detectFormatFromSignatures('random text without structure', 'foo.txt');
    expect(result.converter).toBe('llm-fallback');
  });
});

describe('cross-agent converters', () => {
  it('converts cursor rules to canonical skill', () => {
    const content = '# Rust Expert\n\nYou are an expert in Rust.\n\nAlways use cargo clippy.';
    const skill = cursorRulesConverter(content, {
      fileName: 'rust-expert.cursorrules',
      sourceUrl: 'https://example.com/rust-expert.cursorrules',
      originalFormat: 'cursor-rules',
      content,
    });
    expect(skill.name).toBe('rust-expert');
    expect(skill.category).toBe('imported-cursor');
    expect(skill.content).toContain('Rust');
  });

  it('converts generic skill md', () => {
    const content = '---\nname: nmap-scanner\ndescription: Network scanner\n---\n\nRun nmap safely.';
    const skill = genericSkillMdConverter(content, {
      fileName: 'SKILL.md',
      sourceUrl: 'local/SKILL.md',
      originalFormat: 'generic-skill-md',
      content,
    });
    expect(skill.name).toBe('nmap-scanner');
    expect(skill.description).toContain('Network scanner');
  });

  it('registers all priority converters', () => {
    expect(listConverterIds().length).toBeGreaterThanOrEqual(10);
    expect(getConverter('cursor-rules')).toBeDefined();
    expect(getConverter('plain-instructions')).toBeDefined();
  });
});

describe('cross-agent serialize', () => {
  it('round-trips canonical skill markdown', () => {
    const skill = plainInstructionsConverter('# Demo\n\nAlways be concise.', {
      fileName: 'demo.md',
      sourceUrl: 'demo.md',
      originalFormat: 'plain-instructions',
      content: '# Demo\n\nAlways be concise.',
    });
    const raw = serializeCarinaSkill(skill);
    const parsed = parseCarinaSkillMarkdown(raw);
    expect(parsed?.name).toBe(skill.name);
    expect(parsed?.description).toBe(skill.description);
    expect(parsed?.content).toContain('Always be concise');
  });
});
