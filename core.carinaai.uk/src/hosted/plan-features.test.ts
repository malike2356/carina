import { describe, expect, it } from 'vitest';
import { normalizePlanId, PLAN_FEATURES } from './plan-features.js';

describe('plan-features', () => {
  it('normalizePlanId returns starter for carina_ops_starter', () => {
    expect(normalizePlanId('carina_ops_starter')).toBe('carina_ops_starter');
  });

  it('free tier has opsConsole false', () => {
    expect(PLAN_FEATURES.free.opsConsole).toBe(false);
  });

  it('starter tier has opsConsole true and maxMembers 3', () => {
    expect(PLAN_FEATURES.carina_ops_starter.opsConsole).toBe(true);
    expect(PLAN_FEATURES.carina_ops_starter.maxMembers).toBe(3);
    expect(PLAN_FEATURES.carina_ops_starter.monthlyTokenLimit).toBe(500_000);
  });
});
