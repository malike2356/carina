import bcrypt from 'bcryptjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../db.js', () => ({ pool: { query } }));

describe('accounts provisioning', () => {
  beforeEach(() => query.mockReset());

  it('updateAccountPassword rejects wrong current password', async () => {
    const hash = await bcrypt.hash('oldpass123', 12);
    query.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    const { updateAccountPassword } = await import('../accounts.js');
    const result = await updateAccountPassword('acc-1', 'wrongpass', 'newpass123');
    expect(result).toEqual({ ok: false, reason: 'wrong_password' });
  });

  it('updateAccountPassword updates hash when current password matches', async () => {
    const hash = await bcrypt.hash('oldpass123', 12);
    query.mockResolvedValueOnce({ rows: [{ password_hash: hash }] });
    query.mockResolvedValueOnce({ rows: [] });
    const { updateAccountPassword } = await import('../accounts.js');
    const result = await updateAccountPassword('acc-1', 'oldpass123', 'newpass456');
    expect(result).toEqual({ ok: true });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('accepts scout_live license keys in findAccountByApiKey', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'acc-1',
        email: 'user@example.com',
        created_at: '2026-01-01T00:00:00Z',
        key_id: 'key-1',
        is_active: true,
      }],
    });
    query.mockResolvedValueOnce({ rows: [] });
    const { findAccountByApiKey } = await import('../accounts.js');
    const account = await findAccountByApiKey('scout_live_abcdef0123456789abcdef012345678');
    expect(account?.email).toBe('user@example.com');
  });

  it('verifyLogin rejects inactive accounts', async () => {
    const hash = await bcrypt.hash('pass123456', 12);
    query.mockResolvedValueOnce({
      rows: [{
        id: 'acc-1',
        email: 'user@example.com',
        password_hash: hash,
        created_at: '2026-01-01T00:00:00Z',
        is_active: false,
      }],
    });
    const { verifyLogin } = await import('../accounts.js');
    const account = await verifyLogin('user@example.com', 'pass123456');
    expect(account).toBeNull();
  });
});
