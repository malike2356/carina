import { describe, expect, it } from 'vitest';
import { buildBrandedPlanOptions } from './billing-presentment';

describe('billing presentment', () => {
  it('renders branded plan labels for customer workspaces', () => {
    const plans = buildBrandedPlanOptions({ currentPlan: 'starter', productName: 'Nova Cloud' });
    expect(plans.find((plan) => plan.id === 'starter')?.name).toBe('Nova Cloud Starter');
    expect(plans.find((plan) => plan.id === 'starter')?.active).toBe(true);
    expect(plans.find((plan) => plan.id === 'free')?.name).toBe('Nova Cloud Free');
  });

  it('keeps default labels when no brand is configured', () => {
    const plans = buildBrandedPlanOptions({ currentPlan: 'free', productName: null });
    expect(plans[0]?.name).toBe('Free');
  });
});
