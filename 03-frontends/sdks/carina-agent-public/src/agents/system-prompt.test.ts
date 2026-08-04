import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('system-prompt', () => {
  const originalPacks = process.env.ACTIVE_SKILL_PACKS;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalPacks === undefined) {
      delete process.env.ACTIVE_SKILL_PACKS;
    } else {
      process.env.ACTIVE_SKILL_PACKS = originalPacks;
    }
  });

  it('always describes Carina as general-purpose', async () => {
    delete process.env.ACTIVE_SKILL_PACKS;
    const { CARINA_BASE_SYSTEM_PROMPT } = await import('./system-prompt.js');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('general-purpose');
    expect(CARINA_BASE_SYSTEM_PROMPT).toContain('horizontal agent platform');
  });

  it('adds optional pack context only when packs are enabled', async () => {
    process.env.ACTIVE_SKILL_PACKS = 'property-uk';
    const { buildSystemPromptParts } = await import('./system-prompt.js');
    const parts = buildSystemPromptParts();
    expect(parts[0]).toContain('general-purpose');
    expect(parts.join('\n')).toContain('Optional skill packs enabled');
    expect(parts.join('\n')).toContain('property-uk');
  });

  it('omits pack context with no active packs', async () => {
    delete process.env.ACTIVE_SKILL_PACKS;
    const { buildOptionalPackContext } = await import('./system-prompt.js');
    expect(buildOptionalPackContext()).toBe('');
  });
});
