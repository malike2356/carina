import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, maskSecret } from '../secret-crypto.js';

describe('secret-crypto', () => {
  const prev = process.env.SCOUT_CONFIG_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.SCOUT_CONFIG_ENCRYPTION_KEY = 'test-encryption-key-for-unit-tests';
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.SCOUT_CONFIG_ENCRYPTION_KEY;
    else process.env.SCOUT_CONFIG_ENCRYPTION_KEY = prev;
  });

  it('round-trips plaintext through encrypt and decrypt', () => {
    const plain = 're_abc123_secret_token';
    const stored = encryptSecret(plain);
    expect(stored.startsWith('enc:v1:')).toBe(true);
    expect(decryptSecret(stored)).toBe(plain);
  });

  it('returns legacy plaintext when not encrypted', () => {
    expect(decryptSecret('plain-token')).toBe('plain-token');
  });

  it('masks encrypted values for display', () => {
    const stored = encryptSecret('my-super-secret-key');
    expect(maskSecret(stored)).toBe('********');
  });
});
