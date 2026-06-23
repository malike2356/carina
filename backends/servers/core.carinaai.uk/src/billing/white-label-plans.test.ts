import { describe, expect, it } from 'vitest';
import {
  brandedPlanLabel,
  commercialTierForBillingPlan,
  commercialTierForWorkspacePlan,
  normalizeWhiteLabelTier,
  WHITE_LABEL_COMMERCIAL_PLANS,
  workspacePlanLabel,
} from './white-label-plans.js';

describe('white-label commercial plans', () => {
  it('defines starter, agency, and enterprise tiers', () => {
    expect(Object.keys(WHITE_LABEL_COMMERCIAL_PLANS).sort()).toEqual(['agency', 'enterprise', 'starter']);
    expect(WHITE_LABEL_COMMERCIAL_PLANS.agency.maxClientWorkspaces).toBeGreaterThan(
      WHITE_LABEL_COMMERCIAL_PLANS.starter.maxClientWorkspaces,
    );
  });

  it('maps billing and workspace plans to commercial tiers', () => {
    expect(commercialTierForBillingPlan('carina_ops_starter')).toBe('starter');
    expect(commercialTierForBillingPlan('carina_ops_team')).toBe('agency');
    expect(commercialTierForBillingPlan('enterprise')).toBe('enterprise');
    expect(commercialTierForWorkspacePlan('starter')).toBe('starter');
    expect(commercialTierForWorkspacePlan('team')).toBe('agency');
  });

  it('renders branded customer labels without hardcoding Carina', () => {
    expect(brandedPlanLabel('agency', 'Nova')).toBe('Nova Agency');
    expect(workspacePlanLabel('starter', 'Nova')).toBe('Nova Starter');
    expect(normalizeWhiteLabelTier('unknown')).toBe('starter');
  });
});
