import { describe, expect, it } from 'vitest';
import { BILLING_PLANS } from './plans.js';

describe('BILLING_PLANS public accuracy', () => {
  it('enterprise plan does not claim third-party SOC2 certification', () => {
    const features = BILLING_PLANS.enterprise.features.join(' ');
    expect(features).not.toMatch(/SOC2 Type II attestation/i);
    expect(features).toMatch(/readiness export/i);
    expect(features).toMatch(/not a third-party audit/i);
  });
});
