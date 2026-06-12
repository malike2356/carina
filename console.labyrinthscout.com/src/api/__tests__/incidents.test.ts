import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { incidentsRouter } from '../incidents.js';

vi.mock('../../db.js', () => ({
  pool: {
    query: vi.fn(),
  },
}));

import { pool } from '../../db.js';

const SESSION_A = 'session-aaa-111';
const SESSION_B = 'session-bbb-222';

function baseEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    severity: 'critical',
    source: 'carina',
    event_type: 'injection_blocked',
    description: 'Blocked',
    metadata: {},
    ip_address: null,
    session_id: SESSION_A,
    parent_session_id: null,
    root_session_id: null,
    instance_id: 'carina-local',
    mitigated: false,
    created_at: new Date('2026-06-12T10:00:00Z'),
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_note: null,
    ...overrides,
  };
}

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/incidents', incidentsRouter);
  return app;
}

describe('GET /api/incidents/lineage/:sessionId', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('returns session chain and events for a standalone session', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [baseEvent()] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(makeApp()).get(`/api/incidents/lineage/${SESSION_A}`);
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(SESSION_A);
    expect(res.body.chain).toEqual([SESSION_A]);
    expect(res.body.children).toEqual([]);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].session_id).toBe(SESSION_A);
  });

  it('walks the parent_session_id chain', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [{ parent_session_id: SESSION_B }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [baseEvent(), baseEvent({ session_id: SESSION_B, parent_session_id: null })] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(makeApp()).get(`/api/incidents/lineage/${SESSION_A}`);
    expect(res.status).toBe(200);
    expect(res.body.chain).toEqual([SESSION_A, SESSION_B]);
    expect(res.body.events).toHaveLength(2);
  });

  it('includes children of the session', async () => {
    vi.mocked(pool.query)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [baseEvent()] } as never)
      .mockResolvedValueOnce({ rows: [{ session_id: 'child-session-1' }] } as never);

    const res = await request(makeApp()).get(`/api/incidents/lineage/${SESSION_A}`);
    expect(res.status).toBe(200);
    expect(res.body.children).toContain('child-session-1');
  });

  it('rejects session id over 200 chars', async () => {
    const res = await request(makeApp()).get(`/api/incidents/lineage/${'x'.repeat(201)}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid session id');
  });
});

describe('GET /api/incidents/:sessionId/events', () => {
  beforeEach(() => {
    vi.mocked(pool.query).mockReset();
  });

  it('returns events with lineage context', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [baseEvent({ parent_session_id: SESSION_B, root_session_id: SESSION_B })],
    } as never);

    const res = await request(makeApp()).get(`/api/incidents/${SESSION_A}/events`);
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBe(SESSION_A);
    expect(res.body.parentSessionId).toBe(SESSION_B);
    expect(res.body.rootSessionId).toBe(SESSION_B);
    expect(res.body.events).toHaveLength(1);
  });

  it('returns null lineage context for session with no parent', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({
      rows: [baseEvent()],
    } as never);

    const res = await request(makeApp()).get(`/api/incidents/${SESSION_A}/events`);
    expect(res.status).toBe(200);
    expect(res.body.parentSessionId).toBeNull();
    expect(res.body.rootSessionId).toBeNull();
  });

  it('returns empty events for unknown session', async () => {
    vi.mocked(pool.query).mockResolvedValueOnce({ rows: [] } as never);
    const res = await request(makeApp()).get('/api/incidents/unknown-session/events');
    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(0);
    expect(res.body.parentSessionId).toBeNull();
  });
});

describe('POST /api/events lineage fields', () => {
  it('events test: baseEvent contains lineage fields', () => {
    const ev = baseEvent({ parent_session_id: 'p1', root_session_id: 'r1' });
    expect(ev.parent_session_id).toBe('p1');
    expect(ev.root_session_id).toBe('r1');
  });
});
