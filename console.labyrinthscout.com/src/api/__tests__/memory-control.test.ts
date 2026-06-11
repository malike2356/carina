import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();
const publishMock = vi.fn();

let mockRedis = { publish: publishMock };

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => mockRedis,
}));

vi.mock('../../config/index.js', () => ({
  config: {
    auth: { apiKey: 'test-scout-key' },
    carina: { apiUrl: '', opsToken: '' },
  },
}));

const VALID_KEY = 'test-scout-key';
const INSTANCE = 'carina-local';
const SESSION = 'abc123';

function makeApp() {
  return import('../../middleware/auth.js').then(({ requireApiKey }) =>
    import('../memory-control.js').then(({ memoryControlRouter }) => {
      const app = express();
      app.use(express.json());
      app.use('/api/memory', requireApiKey, memoryControlRouter);
      return app;
    }),
  );
}

describe('memory-control API', () => {
  beforeEach(() => {
    mockRedis = { publish: publishMock };
    queryMock.mockReset();
    publishMock.mockReset();
  });

  it('POST clear-session deletes rows, publishes control message, logs event', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rowCount: 3 })
      .mockResolvedValueOnce({ rows: [] });

    const app = await makeApp();
    const res = await request(app)
      .post('/api/memory/clear-session')
      .set('X-Scout-Key', VALID_KEY)
      .send({ session_id: SESSION, instance_id: INSTANCE, reason: 'test' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, session_id: SESSION, rows_deleted: 3 });

    expect(queryMock).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM episodic_memories WHERE session_id = $1',
      [SESSION],
    );

    expect(publishMock).toHaveBeenCalledWith(
      'labyrinth:control',
      JSON.stringify({
        action: 'clear_session_memory',
        session_id: SESSION,
        instance_id: INSTANCE,
        reason: 'test',
      }),
    );

    expect(queryMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('session_memory_cleared'),
      expect.arrayContaining([INSTANCE, expect.any(String), expect.any(String), SESSION]),
    );
  });

  it('POST clear-session is idempotent when no rows exist', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rowCount: 0 })
      .mockResolvedValueOnce({ rows: [] });

    const app = await makeApp();
    const res = await request(app)
      .post('/api/memory/clear-session')
      .set('X-Scout-Key', VALID_KEY)
      .send({ session_id: SESSION, instance_id: INSTANCE, reason: 'test' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, session_id: SESSION, rows_deleted: 0 });
  });

  it('POST clear-session rejects missing reason', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/memory/clear-session')
      .set('X-Scout-Key', VALID_KEY)
      .send({ session_id: SESSION, instance_id: INSTANCE });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reason/);
  });

  it('GET sessions returns grouped session list', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({
        rows: [
          {
            session_id: 'sess-a',
            turn_count: '5',
            last_active: '2026-06-04T10:00:00.000Z',
          },
          {
            session_id: 'sess-b',
            turn_count: '2',
            last_active: '2026-06-04T09:00:00.000Z',
          },
        ],
      });

    const app = await makeApp();
    const res = await request(app)
      .get('/api/memory/sessions')
      .query({ instance_id: INSTANCE })
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      sessions: [
        { session_id: 'sess-a', turn_count: 5, last_active: '2026-06-04T10:00:00.000Z' },
        { session_id: 'sess-b', turn_count: 2, last_active: '2026-06-04T09:00:00.000Z' },
      ],
      source: 'local',
      unavailable: false,
    });

    expect(queryMock).toHaveBeenCalledWith(expect.stringContaining('FROM episodic_memories'));
  });

  it('GET sessions returns empty array when no memory rows', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [{ exists: true }] })
      .mockResolvedValueOnce({ rows: [] });

    const app = await makeApp();
    const res = await request(app)
      .get('/api/memory/sessions')
      .query({ instance_id: INSTANCE })
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ sessions: [], source: 'local', unavailable: false });
  });

  it('GET sessions returns unavailable when episodic_memories table is missing', async () => {
    queryMock.mockResolvedValueOnce({ rows: [{ exists: false }] });

    const app = await makeApp();
    const res = await request(app)
      .get('/api/memory/sessions')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.unavailable).toBe(true);
    expect(res.body.sessions).toEqual([]);
    expect(res.body.message).toMatch(/episodic_memories/i);
  });
});
