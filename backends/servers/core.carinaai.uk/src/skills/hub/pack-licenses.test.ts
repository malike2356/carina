import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./migrations.js', () => ({
  hubPool: {
    query: vi.fn(),
  },
}));

import { hubPool } from './migrations.js';
import {
  generateLicenseToken,
  grantPackLicense,
  packRequiresLicense,
  validatePackLicense,
} from './pack-licenses.js';

describe('pack-licenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('packRequiresLicense is true only for premium with price', () => {
    expect(packRequiresLicense('free', 0)).toBe(false);
    expect(packRequiresLicense('certified', 0)).toBe(false);
    expect(packRequiresLicense('premium', 1999)).toBe(true);
    expect(packRequiresLicense('premium', 0)).toBe(false);
  });

  it('grantPackLicense is idempotent for same stripe session', async () => {
    vi.mocked(hubPool.query)
      .mockResolvedValueOnce({
        rows: [{ license_token: 'pack_existing', created_at: '2026-06-14T00:00:00.000Z' }],
        rowCount: 1,
      } as never);

    const result = await grantPackLicense({
      packName: 'premium-demo',
      email: 'buyer@example.com',
      stripeSessionId: 'cs_test_123',
    });

    expect(result.token).toBe('pack_existing');
    expect(hubPool.query).toHaveBeenCalledTimes(1);
  });

  it('grantPackLicense inserts new license token', async () => {
    vi.mocked(hubPool.query)
      .mockResolvedValueOnce({ rows: [], rowCount: 0 } as never)
      .mockResolvedValueOnce({ rows: [], rowCount: 1 } as never);

    const result = await grantPackLicense({
      packName: 'premium-demo',
      email: 'buyer@example.com',
      stripeSessionId: 'cs_test_new',
    });

    expect(result.token).toMatch(/^pack_/);
    expect(result.email).toBe('buyer@example.com');
    expect(hubPool.query).toHaveBeenCalledTimes(2);
  });

  it('validatePackLicense checks database row', async () => {
    vi.mocked(hubPool.query).mockResolvedValueOnce({ rows: [{ count: '1' }], rowCount: 1 } as never);
    await expect(validatePackLicense('premium-demo', 'pack_abc')).resolves.toBe(true);
  });

  it('validatePackLicense returns false for empty token', async () => {
    await expect(validatePackLicense('x', '')).resolves.toBe(false);
    expect(hubPool.query).not.toHaveBeenCalled();
  });

  it('generateLicenseToken returns prefixed token', () => {
    expect(generateLicenseToken()).toMatch(/^pack_[a-f0-9]{48}$/);
  });
});
