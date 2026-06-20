import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../memory/db.js', () => ({ pool: { query } }));

describe('tenant-scout', () => {
  beforeEach(() => {
    query.mockReset();
    process.env.LABYRINTH_URL = 'http://localhost:4444';
  });

  it('masks scout keys safely', async () => {
    const { maskScoutKey } = await import('../tenant-scout.js');
    expect(maskScoutKey('scout_live_abcdef0123456789abcdef012345678')).toBe('scout_live_a...5678');
    expect(maskScoutKey('short')).toBe('***');
  });

  it('returns credentials for active scout subscriptions', async () => {
    query.mockResolvedValueOnce({
      rows: [{ plan: 'scout_standard', status: 'active', scout_api_key: 'scout_live_abcdef0123456789abcdef012345678' }],
    });
    const { getTenantScoutCredentials } = await import('../tenant-scout.js');
    const creds = await getTenantScoutCredentials('tenant-1', 'user@example.com');
    expect(creds).toMatchObject({
      apiKey: 'scout_live_abcdef0123456789abcdef012345678',
      instanceId: 'hosted:tenant-1',
      plan: 'scout_standard',
    });
  });

  it('returns null for canceled subscriptions', async () => {
    query.mockResolvedValueOnce({
      rows: [{ plan: 'scout_standard', status: 'canceled', scout_api_key: 'scout_live_abcdef0123456789abcdef012345678' }],
    });
    const { getTenantScoutCredentials } = await import('../tenant-scout.js');
    await expect(getTenantScoutCredentials('tenant-1')).resolves.toBeNull();
  });
});
