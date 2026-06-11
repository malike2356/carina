import { describe, expect, it } from 'vitest';
import {
  generateTempPassword,
  hashPassword,
  normalizeEmail,
  validateCreateTenantInput,
} from './tenant-provisioning.js';

describe('tenant-provisioning', () => {
  it('normalizes email addresses', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com');
  });

  it('generates passwords with sufficient length', () => {
    expect(generateTempPassword().length).toBeGreaterThanOrEqual(8);
  });

  it('hashes and verifies password format', () => {
    const hash = hashPassword('test-password-123');
    expect(hash).toContain(':');
    expect(hash.split(':')[0].length).toBe(32);
  });

  it('rejects invalid create input', () => {
    expect(validateCreateTenantInput({
      email: 'bad',
      password: 'short',
      plan: 'free',
      provisioningType: 'manual',
      accessStatus: 'active',
      skillPacks: [],
    })).toMatch(/email/i);

    expect(validateCreateTenantInput({
      email: 'user@example.com',
      password: 'validpass',
      plan: 'free',
      provisioningType: 'manual',
      accessStatus: 'active',
      skillPacks: [],
    })).toMatch(/name/i);
  });

  it('accepts valid create input', () => {
    expect(validateCreateTenantInput({
      email: 'user@example.com',
      password: 'validpass',
      displayName: 'Acme Corp',
      plan: 'scout_pro',
      provisioningType: 'manual',
      accessStatus: 'active',
      skillPacks: ['property-uk'],
    })).toBeNull();
  });
});
