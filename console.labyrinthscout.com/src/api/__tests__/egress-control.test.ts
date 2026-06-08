import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CONTROL_CHANNEL } from '../../lib/constants.js';
import { sanitiseDomain } from '../egress-control.js';

const queryMock = vi.fn();
const publishMock = vi.fn();

type RedisSet = Map<string, Set<string>>;

function createMockRedis() {
  const sets: RedisSet = new Map();
  return {
    sets,
    sadd: vi.fn(async (key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return 1;
    }),
    srem: vi.fn(async (key: string, member: string) => {
      sets.get(key)?.delete(member);
      return 1;
    }),
    smembers: vi.fn(async (key: string) => [...(sets.get(key) ?? [])]),
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
    import('../egress-control.js').then(({ egressControlRouter }) => {
      const app = express();
      app.use(express.json());
      app.use('/api/egress', requireApiKey, egressControlRouter);
      return app;
    }),
  );
}

function mockEventInsert() {
  queryMock.mockResolvedValueOnce({
    rows: [{
      id: 'evt-egress-1',
      severity: 'warning',
      source: 'scout-api',
      event_type: 'egress_domain_blocked',
      description: 'x',
      metadata: {},
      instance_id: INSTANCE,
      created_at: new Date(),
    }],
  });
}

describe('sanitiseDomain', () => {
  it('strips protocol path and query', () => {
    expect(sanitiseDomain('https://evil.com/path?q=1')).toEqual({ ok: true, domain: 'evil.com' });
  });

  it('rejects invalid domain', () => {
    expect(sanitiseDomain('not a domain!').ok).toBe(false);
  });
});

describe('POST /api/egress/block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
    mockRedis = createMockRedis();
  });

  it('blocks a domain', async () => {
    mockEventInsert();
    const app = await makeApp();
    const res = await request(app)
      .post('/api/egress/block')
      .set('X-Scout-Key', VALID_KEY)
      .send({ domain: 'evil.com', instance_id: INSTANCE, reason: 'data exfil attempt' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, domain: 'evil.com', instance_id: INSTANCE });

    const members = await mockRedis.smembers(`scout:egress:blocklist:${INSTANCE}`);
    expect(members).toEqual(['evil.com']);

    expect(publishMock).toHaveBeenCalledOnce();
    const [channel, payload] = publishMock.mock.calls[0] as [string, string];
    expect(channel).toBe(CONTROL_CHANNEL);
    expect(JSON.parse(payload)).toMatchObject({
      action: 'block_egress',
      domain: 'evil.com',
      instance_id: INSTANCE,
    });
  });

  it('sanitises protocol-prefixed input', async () => {
    mockEventInsert();
    const app = await makeApp();
    const res = await request(app)
      .post('/api/egress/block')
      .set('X-Scout-Key', VALID_KEY)
      .send({ domain: 'https://evil.com/path?q=1', instance_id: INSTANCE, reason: 'test' });

    expect(res.status).toBe(200);
    expect(res.body.domain).toBe('evil.com');
    const members = await mockRedis.smembers(`scout:egress:blocklist:${INSTANCE}`);
    expect(members).toEqual(['evil.com']);
  });

  it('rejects invalid domain', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/egress/block')
      .set('X-Scout-Key', VALID_KEY)
      .send({ domain: 'not a domain!', instance_id: INSTANCE, reason: 'x' });

    expect(res.status).toBe(400);
    expect(mockRedis.sadd).not.toHaveBeenCalled();
  });
});

describe('GET /api/egress/blocklist', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    mockRedis = createMockRedis();
  });

  it('lists blocked domains', async () => {
    mockEventInsert();
    const app = await makeApp();
    await request(app)
      .post('/api/egress/block')
      .set('X-Scout-Key', VALID_KEY)
      .send({ domain: 'evil.com', instance_id: INSTANCE, reason: 'test' });

    const res = await request(app)
      .get(`/api/egress/blocklist?instance_id=${INSTANCE}`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ blocked: ['evil.com'] });
  });
});

describe('DELETE /api/egress/block/:domain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
    mockRedis = createMockRedis();
  });

  it('unblocks a domain', async () => {
    mockEventInsert();
    queryMock.mockResolvedValueOnce({
      rows: [{
        id: 'evt-egress-2',
        severity: 'info',
        source: 'scout-api',
        event_type: 'egress_domain_unblocked',
        description: 'x',
        metadata: {},
        instance_id: INSTANCE,
        created_at: new Date(),
      }],
    });

    const app = await makeApp();
    await request(app)
      .post('/api/egress/block')
      .set('X-Scout-Key', VALID_KEY)
      .send({ domain: 'evil.com', instance_id: INSTANCE, reason: 'test' });

    const del = await request(app)
      .delete(`/api/egress/block/evil.com?instance_id=${INSTANCE}`)
      .set('X-Scout-Key', VALID_KEY);

    expect(del.status).toBe(200);
    expect(del.body).toEqual({
      ok: true,
      domain: 'evil.com',
      instance_id: INSTANCE,
      status: 'unblocked',
    });

    const list = await request(app)
      .get(`/api/egress/blocklist?instance_id=${INSTANCE}`)
      .set('X-Scout-Key', VALID_KEY);
    expect(list.body.blocked).toEqual([]);

    expect(publishMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(publishMock.mock.calls[1]![1] as string)).toMatchObject({
      action: 'unblock_egress',
      domain: 'evil.com',
      instance_id: INSTANCE,
    });
  });
});
