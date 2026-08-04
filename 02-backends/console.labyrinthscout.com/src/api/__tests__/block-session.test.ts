import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { CONTROL_CHANNEL } from '../../lib/constants.js';

const queryMock = vi.fn();
const publishMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => ({ publish: publishMock }),
}));

vi.mock('../../api/sse.js', () => ({
  broadcastEvent: vi.fn(),
  refreshAndBroadcastStats: vi.fn(),
}));

vi.mock('../../config/index.js', () => ({
  config: { auth: { apiKey: 'test-scout-key' } },
}));

const VALID_KEY = 'test-scout-key';
const SESSION = 'test-session-001';
const BODY = { reason: 'Suspicious prompt injection', instance_id: 'carina-local' };

function makeApp() {
  return import('../../middleware/auth.js').then(({ requireApiKey }) =>
    import('../block-session.js').then(({ blockSessionRouter }) => {
      const app = express();
      app.use(express.json());
      app.use('/api/sessions', requireApiKey, blockSessionRouter);
      return app;
    }),
  );
}

function mockBlockQueries(reason: string, sessionId = SESSION) {
  queryMock
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({
      rows: [{
        id: 'evt-block-1',
        severity: 'critical',
        source: 'scout-api',
        event_type: 'session_blocked',
        description: `Session blocked by operator: ${reason}`,
        metadata: { reason, blocked_by: 'operator' },
        session_id: sessionId,
        instance_id: 'carina-local',
        created_at: new Date(),
      }],
    });
}

describe('POST /api/sessions/:sessionId/block', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
  });

  it('blocks session with valid API key', async () => {
    mockBlockQueries(BODY.reason);
    const app = await makeApp();
    const res = await request(app)
      .post(`/api/sessions/${SESSION}/block`)
      .set('X-Scout-Key', VALID_KEY)
      .send(BODY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      ok: true,
      session_id: SESSION,
      status: 'blocked',
      two_plane: null,
      two_plane_note: 'Pass account_id to enable two-plane verification',
    });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO blocked_sessions'),
      [SESSION, BODY.reason],
    );
    expect(publishMock).toHaveBeenCalledOnce();
    const [channel, payload] = publishMock.mock.calls[0] as [string, string];
    expect(channel).toBe(CONTROL_CHANNEL);
    expect(JSON.parse(payload)).toMatchObject({
      action: 'block_session',
      session_id: SESSION,
      instance_id: 'carina-local',
      reason: BODY.reason,
    });
  });

  it('returns 401 with wrong API key', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post(`/api/sessions/${SESSION}/block`)
      .set('X-Scout-Key', 'wrong-key')
      .send(BODY);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: 'Unauthorized' });
    expect(queryMock).not.toHaveBeenCalled();
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('is idempotent when re-blocking with a new reason', async () => {
    mockBlockQueries('first reason');
    mockBlockQueries('second reason');
    const app = await makeApp();

    const first = await request(app)
      .post(`/api/sessions/${SESSION}/block`)
      .set('X-Scout-Key', VALID_KEY)
      .send({ reason: 'first reason', instance_id: 'carina-local' });
    const second = await request(app)
      .post(`/api/sessions/${SESSION}/block`)
      .set('X-Scout-Key', VALID_KEY)
      .send({ reason: 'second reason', instance_id: 'carina-local' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const blockInserts = queryMock.mock.calls.filter((c) =>
      String(c[0]).includes('INSERT INTO blocked_sessions'),
    );
    expect(blockInserts).toHaveLength(2);
    expect(blockInserts[1]![1]).toEqual([SESSION, 'second reason']);
  });
});
