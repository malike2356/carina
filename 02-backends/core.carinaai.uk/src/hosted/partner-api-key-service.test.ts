import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    default: {
      ...actual,
      randomBytes: vi.fn(() => Buffer.from('aabbccdd112233445566778899aabbcc', 'hex')),
    },
  };
});

describe('partner-api-key-service', () => {
  beforeEach(() => {
    query.mockReset();
  });

  describe('createPartnerApiKey', () => {
    it('inserts a hashed key and returns rawKey once', async () => {
      const fakeRow = {
        id: 'key-id-1',
        partner_id: 'partner-1',
        label: 'Test key',
        key_prefix: 'cpk_test_qruzMd0S',
        key_hash: 'somehash',
        scopes: ['session', 'memory', 'skills'],
        rate_limit_rpm: 60,
        monthly_cap_events: 100000,
        revenue_share_bps: 50,
        status: 'active',
        last_used_at: null,
        created_at: '2026-06-26T00:00:00.000Z',
      };
      query.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 });

      const { createPartnerApiKey } = await import('./partner-api-key-service.js');
      const result = await createPartnerApiKey({ partnerId: 'partner-1', label: 'Test key' });

      expect(result.rawKey).toMatch(/^cpk_(live|test)_/);
      expect(result.revenueShareBps).toBe(50);
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('INSERT INTO partner_api_keys');
      expect(params[0]).toBe('partner-1');
      expect(params[1]).toBe('Test key');
      // key_hash (param index 3) must not equal the raw key
      expect(params[3]).not.toEqual(result.rawKey);
      expect(typeof params[3]).toBe('string');
      expect((params[3] as string).length).toBe(64); // SHA-256 hex
    });
  });

  describe('resolvePartnerApiKey', () => {
    it('returns null when no active key matches', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { resolvePartnerApiKey } = await import('./partner-api-key-service.js');
      const result = await resolvePartnerApiKey('cpk_test_nonexistent');
      expect(result).toBeNull();
    });

    it('returns mapped key and fires async last_used_at update', async () => {
      const fakeRow = {
        id: 'key-id-2',
        partner_id: 'partner-2',
        label: 'Live key',
        key_prefix: 'cpk_live_XXXXXXXX',
        key_hash: 'doesnotmatter',
        scopes: ['analytics'],
        rate_limit_rpm: 120,
        monthly_cap_events: 500000,
        revenue_share_bps: 75,
        status: 'active',
        last_used_at: null,
        created_at: '2026-06-26T00:00:00.000Z',
      };
      query.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 });
      query.mockResolvedValueOnce({ rowCount: 1 }); // last_used_at update

      const { resolvePartnerApiKey } = await import('./partner-api-key-service.js');
      const result = await resolvePartnerApiKey('cpk_live_somevalidkey');

      expect(result).not.toBeNull();
      expect(result?.scopes).toEqual(['analytics']);
      expect(result?.rateLimitRpm).toBe(120);
      // key_hash must not be returned in the mapped result
      expect(Object.keys(result!)).not.toContain('keyHash');
    });
  });

  describe('revokePartnerApiKey', () => {
    it('returns true when a row was updated', async () => {
      query.mockResolvedValueOnce({ rowCount: 1 });
      const { revokePartnerApiKey } = await import('./partner-api-key-service.js');
      const ok = await revokePartnerApiKey('key-id-1', 'partner-1');
      expect(ok).toBe(true);
      const [sql] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain("status = 'revoked'");
      expect(sql).not.toContain('DELETE');
    });

    it('returns false when key is not found or already revoked', async () => {
      query.mockResolvedValueOnce({ rowCount: 0 });
      const { revokePartnerApiKey } = await import('./partner-api-key-service.js');
      const ok = await revokePartnerApiKey('missing-key', 'partner-1');
      expect(ok).toBe(false);
    });
  });

  describe('listPartnerApiKeys', () => {
    it('returns rows without key_hash', async () => {
      const fakeRow = {
        id: 'key-id-3',
        partner_id: 'partner-3',
        label: 'Analytics key',
        key_prefix: 'cpk_test_AAAAAAAA',
        key_hash: 'secret-hash-must-not-appear',
        scopes: ['analytics'],
        rate_limit_rpm: 30,
        monthly_cap_events: 50000,
        revenue_share_bps: 25,
        status: 'active',
        last_used_at: null,
        created_at: '2026-06-26T00:00:00.000Z',
      };
      query.mockResolvedValueOnce({ rows: [fakeRow], rowCount: 1 });

      const { listPartnerApiKeys } = await import('./partner-api-key-service.js');
      const keys = await listPartnerApiKeys('partner-3');

      expect(keys).toHaveLength(1);
      const key = keys[0];
      expect(key.revenueShareBps).toBe(25);
      expect(Object.keys(key)).not.toContain('keyHash');
      expect(Object.keys(key)).not.toContain('key_hash');
    });
  });
});
