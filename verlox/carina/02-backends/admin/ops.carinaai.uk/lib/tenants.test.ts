import { describe, expect, it } from 'vitest';
import { provisioningLabel, tenantDisplayName } from './tenants.js';

describe('tenants helpers', () => {
  it('prefers display name over email', () => {
    expect(tenantDisplayName({
      displayName: 'Acme',
      companyName: null,
      email: 'a@example.com',
    })).toBe('Acme');
  });

  it('labels manual provisioning distinctly from SaaS', () => {
    expect(provisioningLabel('manual', 'manual')).toBe('Manual/direct');
    expect(provisioningLabel('saas', 'saas')).toBe('SaaS subscription');
  });
});
