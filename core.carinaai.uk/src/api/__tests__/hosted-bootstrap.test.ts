import { describe, it, expect, vi, beforeEach } from 'vitest';

// Each test suite in this file uses its own config mock via vi.doMock so we
// can vary bootstrapEmail/bootstrapPassword per suite.

// Shared in-memory store so the pool mock tracks state across calls.
const users: Array<Record<string, unknown>> = [];

vi.mock('../../memory/db.js', () => {
  const mockQuery = vi.fn(async (sql: string, params?: unknown[]) => {
    const s = sql.replace(/\s+/g, ' ').trim();
    if (/CREATE TABLE/i.test(s) || /CREATE SCHEMA/i.test(s)) return { rows: [], rowCount: 0 };

    if (/INSERT INTO hosted_users/.test(s)) {
      const id = `uid-${Math.random().toString(36).slice(2)}`;
      users.push({
        id,
        email: params?.[0],
        password_hash: params?.[1],
        api_key: params?.[2],
        schema_name: params?.[3],
        tier: 'free',
      });
      return { rows: [{ id }], rowCount: 1 };
    }

    if (/SELECT id FROM hosted_users WHERE email/.test(s)) {
      const email = params?.[0] as string;
      const found = users.filter((u) => u.email === email);
      return { rows: found, rowCount: found.length };
    }

    if (/SELECT id, password_hash, api_key FROM hosted_users WHERE email/.test(s)) {
      const email = params?.[0] as string;
      const found = users.filter((u) => u.email === email);
      return { rows: found, rowCount: found.length };
    }

    if (/UPDATE hosted_users SET password_hash/.test(s)) {
      const newHash = params?.[0] as string;
      const id = params?.[1] as string;
      const u = users.find((r) => r.id === id);
      if (u) u.password_hash = newHash;
      return { rows: [], rowCount: 1 };
    }

    if (/INSERT INTO password_reset_tokens/.test(s)) return { rows: [], rowCount: 0 };

    return { rows: [], rowCount: 0 };
  });
  return {
    pool: {
      query: mockQuery,
      connect: vi.fn(async () => ({ query: mockQuery, release: vi.fn() })),
      end: vi.fn(),
    },
  };
});

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: vi.fn().mockResolvedValue({ id: 'x' }) },
  })),
}));

describe('maybeBootstrapHostedAccount - no env vars set', () => {
  beforeEach(() => {
    users.length = 0;
    vi.resetModules();
  });

  it('does nothing when bootstrapEmail is empty', async () => {
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100, bootstrapEmail: '', bootstrapPassword: '',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount } = await import('../hosted-auth.js');
    await maybeBootstrapHostedAccount();
    expect(users.length).toBe(0);
  });

  it('warns and skips when password is too short', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100, bootstrapEmail: 'admin@test.com', bootstrapPassword: 'short',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount } = await import('../hosted-auth.js');
    await maybeBootstrapHostedAccount();
    expect(users.length).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('8+ chars'));
    warn.mockRestore();
  });
});

describe('maybeBootstrapHostedAccount - creates account on first run', () => {
  beforeEach(() => {
    users.length = 0;
    vi.resetModules();
  });

  it('creates the bootstrap account when it does not exist', async () => {
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100,
          bootstrapEmail: 'bootstrap@example.com',
          bootstrapPassword: 'bootstrappass1',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount, loginUser } = await import('../hosted-auth.js');
    await maybeBootstrapHostedAccount();
    expect(users.some((u) => u.email === 'bootstrap@example.com')).toBe(true);

    const result = await loginUser('bootstrap@example.com', 'bootstrappass1');
    expect(result).not.toBeNull();
    expect(result?.token).toBeTruthy();
  });

  it('logs account creation without printing the password', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100,
          bootstrapEmail: 'boot2@example.com',
          bootstrapPassword: 'supersecret99',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount } = await import('../hosted-auth.js');
    await maybeBootstrapHostedAccount();
    const logged = log.mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).toContain('boot2@example.com');
    expect(logged).not.toContain('supersecret99');
    log.mockRestore();
  });
});

describe('maybeBootstrapHostedAccount - no overwrite without --reset', () => {
  beforeEach(() => {
    users.length = 0;
    vi.resetModules();
  });

  it('leaves existing account unchanged when forceReset is false', async () => {
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100,
          bootstrapEmail: 'existing@example.com',
          bootstrapPassword: 'newpassword1',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount, registerUser, loginUser } = await import('../hosted-auth.js');

    await registerUser('existing@example.com', 'originalpass1');
    const originalHash = users.find((u) => u.email === 'existing@example.com')?.password_hash;

    await maybeBootstrapHostedAccount(false); // no force

    const currentHash = users.find((u) => u.email === 'existing@example.com')?.password_hash;
    expect(currentHash).toBe(originalHash); // unchanged

    const result = await loginUser('existing@example.com', 'originalpass1');
    expect(result).not.toBeNull();
  });

  it('resets password when forceReset is true', async () => {
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100,
          bootstrapEmail: 'force@example.com',
          bootstrapPassword: 'forcedpassword1',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount, registerUser, loginUser } = await import('../hosted-auth.js');

    await registerUser('force@example.com', 'oldpassword99');

    await maybeBootstrapHostedAccount(true); // force reset

    const result = await loginUser('force@example.com', 'forcedpassword1');
    expect(result).not.toBeNull();

    const oldResult = await loginUser('force@example.com', 'oldpassword99');
    expect(oldResult).toBeNull();
  });
});

describe('maybeBootstrapHostedAccount - missing hosted_users table', () => {
  beforeEach(() => {
    users.length = 0;
    vi.resetModules();
  });

  it('auto-runs migrations and then creates the account', async () => {
    vi.doMock('../../config/index.js', () => ({
      config: {
        hosted: {
          jwtSecret: 'test-secret', enabled: true, appHost: 'localhost',
          freeDailyMessages: 100,
          bootstrapEmail: 'migtest@example.com',
          bootstrapPassword: 'migrationpass1',
        },
        resend: { apiKey: '', from: 'x@x.com' },
      },
    }));
    const { maybeBootstrapHostedAccount } = await import('../hosted-auth.js');

    // The mock handles CREATE TABLE as a no-op, simulating a fresh DB.
    await expect(maybeBootstrapHostedAccount()).resolves.toBeUndefined();
    expect(users.some((u) => u.email === 'migtest@example.com')).toBe(true);
  });
});
