import { describe, expect, it } from 'vitest';
import { describeEnterpriseOffering, ENTERPRISE_SUPPORT_SLAS } from './kernel-support.js';

describe('enterprise kernel support', () => {
  it('describes MIT kernel with paid layers', () => {
    const offering = describeEnterpriseOffering();
    expect(offering.kernelLicense).toBe('MIT');
    expect(offering.paidLayers.length).toBeGreaterThanOrEqual(2);
    expect(ENTERPRISE_SUPPORT_SLAS.enterprise.contractRequired).toBe(true);
  });
});
