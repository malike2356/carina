import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  isPublicDomain,
  normalizeDomain,
} from './workspace-sso';

describe('workspace-sso helpers', () => {
  const originalVault = process.env.VAULT_SECRET;

  beforeEach(() => {
    process.env.VAULT_SECRET = 'test-vault-secret-for-sso-encryption';
  });

  afterEach(() => {
    if (originalVault === undefined) delete process.env.VAULT_SECRET;
    else process.env.VAULT_SECRET = originalVault;
  });

  it('normalizes domains to lowercase without @ prefix', () => {
    expect(normalizeDomain('@Example.COM')).toBe('example.com');
    expect(normalizeDomain('  Acme.Co.Uk ')).toBe('acme.co.uk');
  });

  it('blocks public mailbox domains', () => {
    expect(isPublicDomain('gmail.com')).toBe(true);
    expect(isPublicDomain('outlook.com')).toBe(true);
    expect(isPublicDomain('acme.com')).toBe(false);
  });

  it('round-trips encrypted secrets', () => {
    const { enc, iv, tag } = encryptSecret('super-secret-value');
    expect(decryptSecret(enc, iv, tag)).toBe('super-secret-value');
  });
});
