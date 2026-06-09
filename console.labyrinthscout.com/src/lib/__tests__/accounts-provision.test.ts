import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../db.js', () => ({ pool: { query } }));

describe('accounts provisioning', () => {
  beforeEach(() => query.mockReset());

  it('accepts scout_live license keys in findAccountByApiKey', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'acc-1',
        email: 'user@example.com',
        created_at: '2026-01-01T00:00:00Z',
        key_id: 'key-1',
      }],
    });
    query.mockResolvedValueOnce({ rows: [] });
    const { findAccountByApiKey } = await import('../accounts.js');
    const account = await findAccountByApiKey('scout_live_abcdef0123456789abcdef012345678');
    expect(account?.email).toBe('user@example.com');
  });
});
