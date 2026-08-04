import { describe, expect, it } from 'vitest';
import {
  effectiveAivaPlanTier,
  hasAivaPlanTier,
  resolveAivaFeaturePlanTier,
} from './aiva-plan-tier';

describe('aiva-plan-tier', () => {
  it('maps active trial to growth for feature gating', () => {
    expect(effectiveAivaPlanTier('trial', 'trialing')).toBe('growth');
    expect(hasAivaPlanTier('growth', 'team')).toBe(true);
  });

  it('resolveAivaFeaturePlanTier prefers featurePlanTier from billing status', () => {
    expect(
      resolveAivaFeaturePlanTier({
        planTier: 'trial',
        subscriptionStatus: 'trialing',
        featurePlanTier: 'growth',
      }),
    ).toBe('growth');
  });
});
