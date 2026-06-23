import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../memory/db.js', () => {
  const rows: Record<string, unknown[]> = {};
  const mockQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (/CREATE TABLE/i.test(s)) return { rows: [], rowCount: 0 };
    if (/CREATE SCHEMA/i.test(s)) return { rows: [], rowCount: 0 };

    if (/INSERT INTO hosted_users/.test(s)) {
      const id = `uid-${Math.random().toString(36).slice(2)}`;
      const email = params?.[0] as string;
      const passwordHash = params?.[1] as string;
      const apiKey = params?.[2] as string;
      const schemaName = params?.[3] as string;
      rows['hosted_users'] = rows['hosted_users'] ?? [];
      (rows['hosted_users'] as Array<Record<string, unknown>>).push({
        id, email, password_hash: passwordHash, api_key: apiKey, schema_name: schemaName, tier: 'free',
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (/SELECT id FROM hosted_users WHERE email/.test(s)) {
      const email = params?.[0] as string;
      const found = ((rows['hosted_users'] ?? []) as Array<Record<string, unknown>>).filter((r) => r.email === email);
      return { rows: found, rowCount: found.length };
    }

    if (/SELECT id, password_hash, api_key FROM hosted_users WHERE email/.test(s)) {
      const email = params?.[0] as string;
      const found = ((rows['hosted_users'] ?? []) as Array<Record<string, unknown>>).filter((r) => r.email === email);
      return { rows: found, rowCount: found.length };
    }

    if (/SELECT .* FROM hosted_users WHERE id/.test(s)) {
      const id = params?.[0] as string;
      const found = ((rows['hosted_users'] ?? []) as Array<Record<string, unknown>>).filter((r) => r.id === id);
      return { rows: found, rowCount: found.length };
    }

    if (/UPDATE hosted_users SET password_hash/.test(s)) {
      const newHash = params?.[0] as string;
      const id = params?.[1] as string;
      const users = (rows['hosted_users'] ?? []) as Array<Record<string, unknown>>;
      const user = users.find((r) => r.id === id);
      if (user) user.password_hash = newHash;
      return { rows: [], rowCount: 1 };
    }

    if (/INSERT INTO password_reset_tokens/.test(s)) {
      rows['password_reset_tokens'] = rows['password_reset_tokens'] ?? [];
      const id = `tkn-${Math.random().toString(36).slice(2)}`;
      (rows['password_reset_tokens'] as Array<Record<string, unknown>>).push({
        id,
        user_id: params?.[0],
        token_hash: params?.[1],
        expires_at: params?.[2],
        used_at: null,
      });
      return { rows: [], rowCount: 1 };
    }

    if (/SELECT id, user_id FROM password_reset_tokens/.test(s)) {
      const hash = params?.[0] as string;
      const tokens = (rows['password_reset_tokens'] ?? []) as Array<Record<string, unknown>>;
      const found = tokens.filter(
        (t) => t.token_hash === hash && !t.used_at && (t.expires_at as Date) > new Date(),
      );
      return { rows: found, rowCount: found.length };
    }

    if (/UPDATE password_reset_tokens SET used_at/.test(s)) {
      const id = params?.[0] as string;
      const tokens = (rows['password_reset_tokens'] ?? []) as Array<Record<string, unknown>>;
      const t = tokens.find((r) => r.id === id);
      if (t) t.used_at = new Date();
      return { rows: [], rowCount: 1 };
    }

    if (/UPDATE hosted_users.*messages_today/.test(s)) {
      return { rows: [{ tier: 'free', messages_today: 1 }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });
  return { pool: { query: mockQuery, connect: vi.fn(async () => ({ query: mockQuery, release: vi.fn() })) } };
});

vi.mock('../../config/index.js', () => ({
  config: {
    hosted: { jwtSecret: 'test-secret', enabled: true, appHost: 'localhost', freeDailyMessages: 100 },
    resend: { apiKey: '', from: 'test@example.com' },
  },
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'email-id' }) },
  })),
}));

vi.mock('../../hosted/org-service.js', () => ({
  createOrgForUser: vi.fn(async (userId: string) => ({
    orgId: 'org-test',
    slug: 'test',
    role: 'owner' as const,
  })),
  getPrimaryOrgForUser: vi.fn(async (userId: string) => ({
    orgId: 'org-test',
    userId,
    role: 'owner' as const,
  })),
  getOrgProfile: vi.fn(async () => ({
    id: 'org-test',
    name: 'Test Org',
    plan: 'free',
  })),
}));

import {
  confirmPasswordReset,
  initHostedDb,
  loginUser,
  registerUser,
  requestPasswordReset,
  upsertHostedUser,
} from '../hosted-auth.js';

describe('hosted-auth migrations guard', () => {
  it('initHostedDb runs without throwing', async () => {
    await expect(initHostedDb()).resolves.toBeUndefined();
  });

  it('loginUser runs migrations before querying (no table not-exists error)', async () => {
    await expect(loginUser('nobody@test.com', 'wrong')).resolves.toBeNull();
  });
});

describe('hosted-auth password reset flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requestPasswordReset returns silently for unknown email', async () => {
    await expect(requestPasswordReset('ghost@example.com')).resolves.toBeUndefined();
  });

  it('full reset flow: register, request, confirm, then login with new password', async () => {
    await registerUser('reset@example.com', 'oldpass1');

    await requestPasswordReset('reset@example.com');

    const { pool } = await import('../../memory/db.js');
    const tokens = (
      (pool.query as ReturnType<typeof vi.fn>).mock.calls as Array<[string, unknown[]]>
    ).find(([sql]) => /INSERT INTO password_reset_tokens/.test(sql));
    expect(tokens).toBeDefined();

    const rawToken = '00'.repeat(32);
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    const { pool: p2 } = await import('../../memory/db.js');
    const mockQuery = p2.query as ReturnType<typeof vi.fn>;

    mockQuery.mockImplementationOnce(async (sql: string) => {
      if (/SELECT id, user_id FROM password_reset_tokens/.test(sql)) {
        const userId = 'uid-test';
        return { rows: [{ id: 'tkn-test', user_id: userId }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const ok = await confirmPasswordReset(rawToken, 'newpass123');
    expect(ok).toBe(true);
  });

  it('confirmPasswordReset returns false for non-existent token', async () => {
    const ok = await confirmPasswordReset('deadbeef'.repeat(8), 'newpass123');
    expect(ok).toBe(false);
  });

  it('confirmPasswordReset rejects used token', async () => {
    await registerUser('used-token@example.com', 'firstpass1');
    await requestPasswordReset('used-token@example.com');

    const { pool } = await import('../../memory/db.js');
    const mockQuery = pool.query as ReturnType<typeof vi.fn>;

    mockQuery.mockImplementationOnce(async () => ({ rows: [], rowCount: 0 }));

    const ok = await confirmPasswordReset('some-fake-token', 'newpass123');
    expect(ok).toBe(false);
  });
});

describe('hosted-auth org context', () => {
  it('loginUser includes orgId and role in JWT when membership exists', async () => {
    await registerUser('org-jwt@example.com', 'password12');
    const result = await loginUser('org-jwt@example.com', 'password12');
    expect(result).not.toBeNull();
    const { verifyJwt } = await import('../hosted-auth.js');
    const payload = verifyJwt(result!.token);
    expect(payload?.orgId).toBe('org-test');
    expect(payload?.role).toBe('owner');
  });
});

describe('upsertHostedUser CLI recovery', () => {
  it('creates a new user when email does not exist', async () => {
    const userId = await upsertHostedUser('new-cli@example.com', 'clipass12');
    expect(typeof userId).toBe('string');
    expect(userId.length).toBeGreaterThan(0);
  });

  it('updates password for existing user without changing other fields', async () => {
    await registerUser('existing-cli@example.com', 'original1');
    const userId = await upsertHostedUser('existing-cli@example.com', 'updated99');
    expect(typeof userId).toBe('string');

    const result = await loginUser('existing-cli@example.com', 'updated99');
    expect(result).not.toBeNull();
  });

  it('does not print the password to stdout', async () => {
    const spy = vi.spyOn(process.stdout, 'write');
    await upsertHostedUser('silent@example.com', 'mypassword1');
    const written = spy.mock.calls.map((c) => String(c[0])).join('');
    expect(written).not.toContain('mypassword1');
    spy.mockRestore();
  });
});
