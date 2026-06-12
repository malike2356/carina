import { afterEach, describe, expect, it } from 'vitest';
import {
  applyPolicyPack,
  getAppliedPolicyPack,
  getPolicyPack,
  listPolicyPacks,
  resetPolicyPacksForTests,
  rollbackPolicyPack,
} from '../policy-packs.js';
import { resetShieldModesForTests, getShieldMode } from '../session-shield.js';

describe('PolicyPacks', () => {
  afterEach(() => {
    resetPolicyPacksForTests();
    resetShieldModesForTests();
  });

  it('lists available packs', () => {
    const packs = listPolicyPacks();
    expect(packs.length).toBeGreaterThanOrEqual(6);
    expect(packs.some((p) => p.id === 'prod')).toBe(true);
  });

  it('applies guard pack to session', async () => {
    const applied = await applyPolicyPack({
      packId: 'guard',
      sessionId: 'pack-1',
      appliedBy: 'operator',
    });
    expect(applied.packId).toBe('guard');
    const shield = await getShieldMode('pack-1');
    expect(shield.mode).toBe('guard');
  });

  it('tracks active pack', async () => {
    await applyPolicyPack({ packId: 'restrict', sessionId: 'pack-2', appliedBy: 'operator' });
    const active = getAppliedPolicyPack('pack-2');
    expect(active?.packId).toBe('restrict');
  });

  it('rolls back to previous pack', async () => {
    await applyPolicyPack({ packId: 'observe', sessionId: 'pack-3', appliedBy: 'operator' });
    await applyPolicyPack({ packId: 'restrict', sessionId: 'pack-3', appliedBy: 'operator' });
    const rolled = await rollbackPolicyPack('pack-3');
    expect(rolled?.packId).toBe('observe');
  });

  it('defines prod pack with strict settings', () => {
    const prod = getPolicyPack('prod');
    expect(prod.egressStrict).toBe(true);
    expect(prod.loggingDepth).toBe('verbose');
  });
});
