import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();
const publishMock = vi.fn();
const dispatchMock = vi.fn();

function createMockRedis() {
  const kv = new Map<string, { value: string; ttl?: number }>();
  return {
    kv,
    set: vi.fn(async (key: string, value: string, _ex: string, ttl: number) => {
      kv.set(key, { value, ttl });
      return 'OK';
    }),
    get: vi.fn(async (key: string) => kv.get(key)?.value ?? null),
    del: vi.fn(async (key: string) => {
      const had = kv.has(key);
      kv.delete(key);
      return had ? 1 : 0;
    }),
    incr: vi.fn(async (key: string) => {
      const next = Number(kv.get(key)?.value ?? '0') + 1;
      kv.set(key, { value: String(next) });
      return next;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      const existing = kv.get(key);
      if (existing) kv.set(key, { ...existing, ttl });
      return 1;
    }),
    publish: publishMock,
  };
}

let mockRedis = createMockRedis();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => mockRedis,
}));

vi.mock('../../alerts/dispatcher.js', () => ({
  alertDispatcher: { dispatch: (...args: unknown[]) => dispatchMock(...args) },
}));

vi.mock('../../config/index.js', () => ({
  config: { auth: { apiKey: 'test-scout-key', ipWhitelist: [], totpSecret: null } },
}));

const VALID_KEY = 'test-scout-key';
const INSTANCE = 'carina-local';
const SESSION = 'abc123';

function makeApp() {
  return import('../../middleware/auth.js').then(({ requireApiKey }) =>
    import('../rate-control.js').then(({ rateControlRouter }) => {
      const app = express();
      app.use(express.json());
      app.use('/api/rate-limit', requireApiKey, rateControlRouter);
      return app;
    }),
  );
}

describe('rate-control API', () => {
  beforeEach(() => {
    mockRedis = createMockRedis();
    queryMock.mockReset();
    publishMock.mockReset();
    dispatchMock.mockReset();
    dispatchMock.mockResolvedValue(undefined);
    queryMock.mockResolvedValue({ rows: [] });
    delete process.env.SCOUT_RATE_LIMIT_MINUTE;
  });

  it('POST sets Redis key, publishes control message, logs event', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/rate-limit')
      .set('X-Scout-Key', VALID_KEY)
      .send({
        session_id: SESSION,
        instance_id: INSTANCE,
        calls_per_minute: 3,
        reason: 'test',
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      session_id: SESSION,
      calls_per_minute: 3,
      expires_in_minutes: 60,
    });

    expect(mockRedis.kv.get(`scout:ratelimit:${INSTANCE}:${SESSION}`)).toEqual({
      value: '3',
      ttl: 3600,
    });

    expect(publishMock).toHaveBeenCalledWith(
      'labyrinth:control',
      JSON.stringify({
        action: 'set_rate_limit',
        session_id: SESSION,
        instance_id: INSTANCE,
        calls_per_minute: 3,
        reason: 'test',
      }),
    );

    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('rate_limit_adjusted'),
      expect.arrayContaining([INSTANCE, expect.any(String), expect.any(String), SESSION]),
    );
  });

  it('POST rejects invalid calls_per_minute', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/rate-limit')
      .set('X-Scout-Key', VALID_KEY)
      .send({
        session_id: SESSION,
        instance_id: INSTANCE,
        calls_per_minute: 0,
        reason: 'test',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/calls_per_minute/);
  });

  it('GET returns override when Redis key exists', async () => {
    mockRedis.kv.set(`scout:ratelimit:${INSTANCE}:${SESSION}`, { value: '3' });
    const app = await makeApp();

    const res = await request(app)
      .get('/api/rate-limit')
      .query({ instance_id: INSTANCE, session_id: SESSION })
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      session_id: SESSION,
      instance_id: INSTANCE,
      calls_per_minute: 3,
      source: 'override',
    });
  });

  it('GET returns default when no override', async () => {
    const app = await makeApp();

    const res = await request(app)
      .get('/api/rate-limit')
      .query({ instance_id: INSTANCE, session_id: 'unknown-session' })
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      session_id: 'unknown-session',
      instance_id: INSTANCE,
      calls_per_minute: 15,
      source: 'default',
    });
  });

  it('DELETE removes key and publishes clear_rate_limit', async () => {
    mockRedis.kv.set(`scout:ratelimit:${INSTANCE}:${SESSION}`, { value: '3' });
    const app = await makeApp();

    const res = await request(app)
      .delete('/api/rate-limit')
      .query({ instance_id: INSTANCE, session_id: SESSION })
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, session_id: SESSION, instance_id: INSTANCE });
    expect(mockRedis.kv.has(`scout:ratelimit:${INSTANCE}:${SESSION}`)).toBe(false);
    expect(publishMock).toHaveBeenCalledWith(
      'labyrinth:control',
      JSON.stringify({
        action: 'clear_rate_limit',
        session_id: SESSION,
        instance_id: INSTANCE,
      }),
    );
  });

  it('progressively escalates rate-limit violations at 5, 10, and 20', async () => {
    const { recordRateLimitViolation } = await import('../rate-control.js');

    let escalation = { violationCount: 0, cooldownSeconds: 0, alertSeverity: null as string | null };
    for (let i = 0; i < 5; i += 1) {
      escalation = await recordRateLimitViolation(INSTANCE, SESSION);
    }
    expect(escalation).toMatchObject({ violationCount: 5, cooldownSeconds: 60 });
    expect(dispatchMock).not.toHaveBeenCalled();

    for (let i = 5; i < 10; i += 1) {
      escalation = await recordRateLimitViolation(INSTANCE, SESSION);
    }
    expect(escalation).toMatchObject({ violationCount: 10, cooldownSeconds: 300, alertSeverity: 'info' });
    expect(dispatchMock).toHaveBeenCalledTimes(1);

    for (let i = 10; i < 20; i += 1) {
      escalation = await recordRateLimitViolation(INSTANCE, SESSION);
    }
    expect(escalation).toMatchObject({ violationCount: 20, cooldownSeconds: 1800, alertSeverity: 'critical' });
    expect(dispatchMock).toHaveBeenCalledTimes(2);
  });
});
