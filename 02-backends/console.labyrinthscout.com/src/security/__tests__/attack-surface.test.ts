import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/instance-control.js', () => ({
  publishControlMessage: vi.fn().mockResolvedValue(undefined),
}));

import {
  applySurfaceRestriction,
  isSurfaceRestricted,
  listSurfaceRestrictions,
  releaseSurfaceRestriction,
  resetSurfaceRestrictionsForTests,
  restrictionBlocksTool,
} from '../attack-surface.js';
import { handleRiskTransition, resetRiskTransitionRules } from '../risk-transitions.js';
import { resetShieldModesForTests, getShieldMode } from '../session-shield.js';

describe('AttackSurface', () => {
  afterEach(() => {
    resetSurfaceRestrictionsForTests();
    resetShieldModesForTests();
    resetRiskTransitionRules();
  });

  it('applies and checks shell restriction', async () => {
    await applySurfaceRestriction({
      instanceId: 'inst-1',
      sessionId: 'sess-1',
      restriction: 'shell',
      reason: 'suspicious activity',
      appliedBy: 'operator',
    });
    const state = await isSurfaceRestricted('inst-1', 'shell', 'sess-1');
    expect(state).not.toBeNull();
    expect(state?.reason).toBe('suspicious activity');
  });

  it('blocks shell tools when restricted', () => {
    expect(restrictionBlocksTool('shell', 'shell-exec')).toBe(true);
    expect(restrictionBlocksTool('shell', 'web-search')).toBe(false);
  });

  it('releases restrictions', async () => {
    await applySurfaceRestriction({
      instanceId: 'inst-2',
      restriction: 'external_http',
      reason: 'investigation',
      appliedBy: 'operator',
    });
    const released = await releaseSurfaceRestriction('inst-2', 'external_http');
    expect(released).toBe(true);
    const state = await isSurfaceRestricted('inst-2', 'external_http');
    expect(state).toBeNull();
  });

  it('lists active restrictions', async () => {
    await applySurfaceRestriction({
      instanceId: 'inst-3',
      restriction: 'skill_write',
      reason: 'freeze during review',
      appliedBy: 'operator',
    });
    const list = await listSurfaceRestrictions('inst-3');
    expect(list.some((r) => r.restriction === 'skill_write')).toBe(true);
  });

  it('auto-applies restrict mode on repeated injection', async () => {
    const result = await handleRiskTransition({
      trigger: 'repeated_injection',
      sessionId: 'sess-risk',
      instanceId: 'inst-1',
      reason: '3 injection attempts in 5 minutes',
    });
    expect(result.applied).toBe(true);
    expect(result.actions).toContain('shield_mode_restrict');
    const shield = await getShieldMode('sess-risk');
    expect(shield.mode).toBe('restrict');
  });

  it('recommends only for unknown tool when autoApply is false', async () => {
    const result = await handleRiskTransition({
      trigger: 'unknown_tool',
      sessionId: 'sess-unknown',
      instanceId: 'inst-1',
      reason: 'unrecognized tool pattern',
    });
    expect(result.applied).toBe(false);
    expect(result.recommendedOnly).toBe(true);
    expect(result.actions).toContain('recommend_shield_guard');
  });
});
