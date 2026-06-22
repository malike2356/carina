import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query } = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../memory/db.js', () => ({
  pool: { query },
}));

import { IdentityResolver } from './identity-resolver.js';

describe('IdentityResolver', () => {
  const resolver = new IdentityResolver();

  beforeEach(() => {
    query.mockReset();
  });

  it('returns existing canonical user id and updates last_seen', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ user_id: 'usr_existing' }] })
      .mockResolvedValueOnce({ rows: [] });

    const userId = await resolver.resolve('telegram', '123', 'Alice');
    expect(userId).toBe('usr_existing');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('creates a new identity when none exists', async () => {
    query
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ user_id: 'usr_new' }] });

    const userId = await resolver.resolve('web', 'browser-1');
    expect(userId).toMatch(/^usr_/);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('links an additional channel identity', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await resolver.link('usr_main', 'discord', 'dc-9', 'Bob');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO identity_links'),
      expect.arrayContaining(['usr_main', 'discord', 'dc-9', 'Bob']),
    );
  });
});
