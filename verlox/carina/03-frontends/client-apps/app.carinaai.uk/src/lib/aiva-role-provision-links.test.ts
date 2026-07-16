import { describe, expect, it } from 'vitest';
import {
  buildAivaProvisionPath,
  buildAivaProvisionRegisterPath,
  resolveHireaivaRoleDescription,
  resolveProvisionDescription,
} from './aiva-role-provision-links';

describe('aiva-role-provision-links', () => {
  it('maps hireaiva role slugs to wizard descriptions', () => {
    expect(resolveHireaivaRoleDescription('customer_service')).toContain('customer support');
    expect(resolveHireaivaRoleDescription('property')).toContain('property enquiries');
  });

  it('prefers explicit description over role slug', () => {
    expect(
      resolveProvisionDescription({
        role: 'sales',
        description: 'Custom sales workflow',
      }),
    ).toBe('Custom sales workflow');
  });

  it('builds provision paths with encoded descriptions', () => {
    const path = buildAivaProvisionPath({ role: 'booking' });
    expect(path.startsWith('/aiva/provision?description=')).toBe(true);
    expect(decodeURIComponent(path.split('=')[1] ?? '')).toContain('booking assistant');
  });

  it('builds register links with intent and role', () => {
    expect(buildAivaProvisionRegisterPath({ role: 'tech_support' })).toBe(
      '/register?intent=provision&role=tech_support',
    );
  });
});
