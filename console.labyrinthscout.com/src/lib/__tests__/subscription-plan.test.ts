import { describe, expect, it } from 'vitest';
import { isScoutProPlan, normalizeScoutPlan } from '../subscription-plan.js';

describe('subscription-plan', () => {
  it('normalizes legacy standard to pro', () => {
    expect(normalizeScoutPlan('scout_standard')).toBe('scout_standard');
    expect(normalizeScoutPlan('scout_monitor')).toBe('scout_monitor');
    expect(normalizeScoutPlan('unknown')).toBe('scout_pro');
  });

  it('gates pro-only features', () => {
    expect(isScoutProPlan('scout_monitor')).toBe(false);
    expect(isScoutProPlan('scout_pro')).toBe(true);
    expect(isScoutProPlan('enterprise')).toBe(true);
  });
});
