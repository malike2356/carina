import { describe, expect, it } from 'vitest';
import { effectivePlanTier, hasPlanTier, isTeamPlan } from './plan-tier.js';

describe('plan-tier', () => {
  it('treats growth as team tier for gating', () => {
    expect(hasPlanTier('growth', 'team')).toBe(true);
    expect(isTeamPlan('growth')).toBe(true);
  });

  it('blocks starter and inactive trial from team features', () => {
    expect(hasPlanTier('starter', 'team')).toBe(false);
    expect(hasPlanTier('trial', 'team')).toBe(false);
  });

  it('grants team features during an active trialing subscription', () => {
    expect(effectivePlanTier('trial', 'trialing')).toBe('growth');
    expect(hasPlanTier(effectivePlanTier('trial', 'trialing'), 'team')).toBe(true);
  });

  it('does not grant team features before trial starts', () => {
    expect(effectivePlanTier('trial', 'pending_channel')).toBe('trial');
    expect(hasPlanTier(effectivePlanTier('trial', 'pending_channel'), 'team')).toBe(false);
  });
});
