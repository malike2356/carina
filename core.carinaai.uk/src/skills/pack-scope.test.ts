import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('pack scope helpers', () => {
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

  it('blocks builtin pack skills when no pack is active', async () => {
    delete process.env.ACTIVE_SKILL_PACKS;
    const { isSkillAllowedForActivePacks } = await import('./index.js');
    expect(isSkillAllowedForActivePacks('brr-analysis')).toBe(false);
    expect(isSkillAllowedForActivePacks('my-custom-skill')).toBe(true);
  });

  it('allows skills only from active packs', async () => {
    process.env.ACTIVE_SKILL_PACKS = 'property-uk';
    const { isSkillAllowedForActivePacks } = await import('./index.js');
    expect(isSkillAllowedForActivePacks('brr-analysis')).toBe(true);
    expect(isSkillAllowedForActivePacks('delegate-coding-task')).toBe(false);
  });

  it('limits RAG to user resources when no pack is active', async () => {
    delete process.env.ACTIVE_SKILL_PACKS;
    const { isRagPackAllowed } = await import('./index.js');
    expect(isRagPackAllowed('user-resources')).toBe(true);
    expect(isRagPackAllowed('property-uk')).toBe(false);
  });
});
