import { describe, expect, it } from 'vitest';
import { isLegalExemptApiPath } from '@/lib/legal/legal-gate-paths';

describe('legal gate paths', () => {
  it('exempts vault google webhook and oauth callback', () => {
    expect(isLegalExemptApiPath('/api/vault/google/webhook')).toBe(true);
    expect(isLegalExemptApiPath('/api/vault/google/oauth/callback')).toBe(true);
    expect(isLegalExemptApiPath('/api/vault/items')).toBe(false);
  });
});
