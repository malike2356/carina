import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CONTROL_CHANNEL } from '../../lib/constants.js';

const queryMock = vi.fn();
const publishMock = vi.fn();

type RedisStore = Map<string, { value: string; expiresAt: number }>;

function createMockRedis() {
  const store: RedisStore = new Map();
  return {
    store,
    set: vi.fn(async (key: string, value: string, _mode: string, ttl: number) => {
      store.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
    }),
    get: vi.fn(async (key: string) => store.get(key)?.value ?? null),
    ttl: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return -2;
      const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }),
    keys: vi.fn(async (pattern: string) => {
      const prefix = pattern.replace('*', '');
      const now = Date.now();
      return [...store.keys()].filter((k) => k.startsWith(prefix) && (store.get(k)?.expiresAt ?? 0) > now);
    }),
    del: vi.fn(async (key: string) => {
      store.delete(key);
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

vi.mock('../../api/sse.js', () => ({
  broadcastEvent: vi.fn(),
  refreshAndBroadcastStats: vi.fn(),
}));

vi.mock('../../config/index.js', () => ({
  config: { auth: { apiKey: 'test-scout-key' } },
}));

const VALID_KEY = 'test-scout-key';
const INSTANCE = 'carina-local';

function makeApp() {
  return import('../../middleware/auth.js').then(({ requireApiKey }) =>
    import('../quarantine.js').then(({ quarantineRouter }) => {
      const app = express();
      app.use(express.json());
      app.use('/api/quarantine', requireApiKey, quarantineRouter);
      return app;
    }),
  );
}

function mockEventInsert() {
  queryMock.mockResolvedValueOnce({
    rows: [{
      id: 'evt-q1',
      severity: 'warning',
      source: 'scout-api',
      event_type: 'tool_quarantined',
      description: 'x',
      metadata: {},
      instance_id: INSTANCE,
      created_at: new Date(),
    }],
  });
}

describe('POST /api/quarantine/tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
    mockRedis = createMockRedis();
  });

  it('quarantines a valid tool', async () => {
    mockEventInsert();
    const app = await makeApp();
    const body = {
      tool: 'shell-exec',
      instance_id: INSTANCE,
      reason: 'test',
      duration_minutes: 30,
    };
    const res = await request(app)
      .post('/api/quarantine/tools')
      .set('X-Scout-Key', VALID_KEY)
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.tool).toBe('shell-exec');
    expect(res.body.instance_id).toBe(INSTANCE);
    expect(typeof res.body.expires_at).toBe('string');

    const key = `scout:quarantine:${INSTANCE}:shell-exec`;
    expect(mockRedis.store.has(key)).toBe(true);
    const ttl = await mockRedis.ttl(key);
    expect(ttl).toBeGreaterThan(1700);
    expect(ttl).toBeLessThanOrEqual(1800);

    expect(publishMock).toHaveBeenCalledOnce();
    const [channel, payload] = publishMock.mock.calls[0] as [string, string];
    expect(channel).toBe(CONTROL_CHANNEL);
    expect(JSON.parse(payload)).toMatchObject({
      action: 'quarantine_tool',
      tool: 'shell-exec',
      instance_id: INSTANCE,
      reason: 'test',
      duration_minutes: 30,
    });
  });

  it('rejects invalid tool name', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/quarantine/tools')
      .set('X-Scout-Key', VALID_KEY)
      .send({ tool: 'rm-rf', instance_id: INSTANCE, reason: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeTruthy();
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/quarantine/tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    mockRedis = createMockRedis();
  });

  it('lists active quarantines with TTL', async () => {
    mockEventInsert();
    const app = await makeApp();
    await request(app)
      .post('/api/quarantine/tools')
      .set('X-Scout-Key', VALID_KEY)
      .send({ tool: 'shell-exec', instance_id: INSTANCE, reason: 'test', duration_minutes: 30 });

    const res = await request(app)
      .get(`/api/quarantine/tools?instance_id=${INSTANCE}`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.quarantined).toHaveLength(1);
    expect(res.body.quarantined[0]).toMatchObject({
      tool: 'shell-exec',
      reason: 'test',
    });
    expect(res.body.quarantined[0].ttl_seconds).toBeGreaterThan(0);
  });

  it('returns empty list when quarantine expired', async () => {
    const key = `scout:quarantine:${INSTANCE}:shell-exec`;
    mockRedis.store.set(key, { value: 'test', expiresAt: Date.now() - 1000 });

    const app = await makeApp();
    const res = await request(app)
      .get(`/api/quarantine/tools?instance_id=${INSTANCE}`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.quarantined).toEqual([]);
  });
});

describe('GET /api/quarantine/list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
    mockRedis = createMockRedis();
    queryMock.mockResolvedValue({ rows: [{ count: '2' }] });
  });

  it('lists active tool and session quarantines', async () => {
    const now = Date.now();
    mockRedis.store.set(`scout:quarantine:${INSTANCE}:shell-exec`, {
      value: 'suspicious output',
      expiresAt: now + 60_000,
    });
    mockRedis.store.set('scout:shield:sess-1', {
      value: JSON.stringify({
        sessionId: 'sess-1',
        mode: 'quarantine',
        reason: 'repeated injection',
        changedAt: '2026-06-22T10:00:00.000Z',
        changedBy: 'auto-remediation',
      }),
      expiresAt: now + 60_000,
    });

    const app = await makeApp();
    const res = await request(app)
      .get('/api/quarantine/list')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.released_7d).toBe(2);
    expect(res.body.quarantined).toHaveLength(2);
    expect(res.body.quarantined.some((entry: { type: string }) => entry.type === 'tool')).toBe(true);
    expect(res.body.quarantined.some((entry: { type: string }) => entry.type === 'session')).toBe(true);
  });
});

describe('POST /api/quarantine/release', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
    mockRedis = createMockRedis();
    queryMock.mockResolvedValue({ rows: [] });
  });

  it('releases a tool quarantine by id', async () => {
    const now = Date.now();
    mockRedis.store.set(`scout:quarantine:${INSTANCE}:shell-exec`, {
      value: 'test',
      expiresAt: now + 60_000,
    });

    const app = await makeApp();
    const res = await request(app)
      .post('/api/quarantine/release')
      .set('X-Scout-Key', VALID_KEY)
      .send({ id: `tool:${INSTANCE}:shell-exec` });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(mockRedis.store.has(`scout:quarantine:${INSTANCE}:shell-exec`)).toBe(false);
  });
});
