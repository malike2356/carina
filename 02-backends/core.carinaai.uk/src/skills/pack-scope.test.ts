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
    const { warmPackSkillIndex, isSkillAllowedForActivePacks } = await import('./index.js');
    await warmPackSkillIndex();
    expect(isSkillAllowedForActivePacks('brr-analysis')).toBe(false);
    expect(isSkillAllowedForActivePacks('my-custom-skill')).toBe(true);
  });

  it('allows skills only from active packs', async () => {
    process.env.ACTIVE_SKILL_PACKS = 'property-uk';
    const { setOperatorActivePacks } = await import('./operator-pack-store.js');
    setOperatorActivePacks(['property-uk']);
    const { warmPackSkillIndex, primeActivePackSkillCache, isSkillAllowedForActivePacks } = await import('./index.js');
    await warmPackSkillIndex();
    await primeActivePackSkillCache();
    expect(isSkillAllowedForActivePacks('brr-analysis')).toBe(true);
    expect(isSkillAllowedForActivePacks('delegate-coding-task')).toBe(false);
  });

  it('allows platform self-knowledge and workspace upload packs always', async () => {
    delete process.env.ACTIVE_SKILL_PACKS;
    const { isRagPackAllowed } = await import('./index.js');
    expect(isRagPackAllowed('user-resources')).toBe(true);
    expect(isRagPackAllowed('custom')).toBe(true);
    expect(isRagPackAllowed('carina-rag')).toBe(true);
    expect(isRagPackAllowed('product-docs')).toBe(true);
    expect(isRagPackAllowed('property-uk')).toBe(false);
  });

  it('allows active skill-pack RAG plus always-allowed packs', async () => {
    process.env.ACTIVE_SKILL_PACKS = 'property-uk';
    const { setOperatorActivePacks } = await import('./operator-pack-store.js');
    setOperatorActivePacks(['property-uk']);
    const { isRagPackAllowed } = await import('./index.js');
    expect(isRagPackAllowed('property-uk')).toBe(true);
    expect(isRagPackAllowed('carina-rag')).toBe(true);
    expect(isRagPackAllowed('custom')).toBe(true);
    expect(isRagPackAllowed('other-pack')).toBe(false);
  });

  it('limits skill-pack-only RAG when no pack is active', async () => {
    delete process.env.ACTIVE_SKILL_PACKS;
    const { isRagPackAllowed } = await import('./index.js');
    expect(isRagPackAllowed('user-resources')).toBe(true);
    expect(isRagPackAllowed('property-uk')).toBe(false);
  });
});
