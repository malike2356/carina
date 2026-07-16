import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { eventsRouter } from '../events.js';

const delMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

vi.mock('../../redis.js', () => ({
  getRedis: vi.fn(() => ({ del: delMock })),
}));

import { pool } from '../../db.js';

const EVENT_ID = '550e8400-e29b-41d4-a716-446655440000';
const ACK_AT = new Date('2026-06-04T14:00:00.000Z');

function baseRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    severity: 'critical',
    source: 'test',
    event_type: 'injection_blocked',
    description: 'Blocked',
    metadata: {},
    ip_address: null,
    session_id: null,
    parent_session_id: null,
    root_session_id: null,
    instance_id: 'carina-local',
    mitigated: false,
    created_at: new Date('2026-06-04T12:00:00Z'),
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_note: null,
    ...overrides,
  };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/events', eventsRouter);
  return app;
}

describe('GET /api/events', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    delMock.mockReset();
  });

  it('returns recent events newest first', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [baseRow({
        severity: 'info',
        event_type: 'tool_call',
        description: 'Tool executed',
        metadata: { tool: 'web-search' },
        session_id: 's1',
      })],
    } as never);

    const res = await request(makeApp()).get('/api/events?limit=10');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].event_type).toBe('tool_call');
    expect(res.body.events[0].metadata).toEqual({ tool: 'web-search' });
    expect(res.body.events[0].acknowledged).toBe(false);
    expect(res.body.events[0].acknowledged_at).toBeNull();
    expect(res.body.events[0].acknowledged_note).toBeNull();
  });

  it('caps limit at 500', async () => {
    vi.mocked(pool.query).mockResolvedValue({ rows: [] } as never);
    await request(makeApp()).get('/api/events?limit=9999');
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('LIMIT'), [500]);
  });
});

describe('GET /api/events/:id', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('returns a single event with acknowledgement fields', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [baseRow({
        acknowledged: true,
        acknowledged_at: ACK_AT,
        acknowledged_note: 'checked',
      })],
    } as never);

    const res = await request(makeApp()).get(`/api/events/${EVENT_ID}`);
    expect(res.status).toBe(200);
    expect(res.body.event.acknowledged).toBe(true);
    expect(res.body.event.acknowledged_note).toBe('checked');
  });

  it('rejects invalid event id', async () => {
    const res = await request(makeApp()).get('/api/events/abc');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid event id');
  });
});

describe('POST /api/events/:id/acknowledge', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
    delMock.mockReset();
  });

  it('acknowledges an event and clears dedup key', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [{
        id: EVENT_ID,
        instance_id: 'carina-local',
        event_type: 'injection_blocked',
        acknowledged_at: ACK_AT,
      }],
    } as never);

    const res = await request(makeApp())
      .post(`/api/events/${EVENT_ID}/acknowledge`)
      .send({ note: 'checked' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.id).toBe(EVENT_ID);
    expect(delMock).toHaveBeenCalledWith('scout:alert-dedup:carina-local:injection_blocked');
  });

  it('is idempotent when already acknowledged', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({
        rows: [{
          id: EVENT_ID,
          acknowledged: true,
          acknowledged_at: ACK_AT,
        }],
      } as never);

    const res = await request(makeApp())
      .post(`/api/events/${EVENT_ID}/acknowledge`)
      .send({ note: 'checked' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, already: true, id: EVENT_ID });
    expect(delMock).not.toHaveBeenCalled();
  });

  it('rejects invalid event id', async () => {
    const res = await request(makeApp())
      .post('/api/events/abc/acknowledge')
      .send({ note: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid event id');
  });
});

describe('GET /api/events lineage fields', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('serializes parent_session_id and root_session_id on events', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [baseRow({
        session_id: 'child-sess',
        parent_session_id: 'parent-sess',
        root_session_id: 'root-sess',
      })],
    } as never);

    const res = await request(makeApp()).get('/api/events?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.events[0].parent_session_id).toBe('parent-sess');
    expect(res.body.events[0].root_session_id).toBe('root-sess');
  });

  it('sets lineage fields to null when absent', async () => {
    vi.mocked(pool.query).mockResolvedValue({
      rows: [baseRow()],
    } as never);

    const res = await request(makeApp()).get('/api/events?limit=1');
    expect(res.status).toBe(200);
    expect(res.body.events[0].parent_session_id).toBeNull();
    expect(res.body.events[0].root_session_id).toBeNull();
  });
});
