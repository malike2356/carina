import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../config/index.js', () => ({
  config: { auth: { apiKey: 'test-scout-key' } },
}));

import { exportRouter } from '../export.js';

const VALID_KEY = 'test-scout-key';

function makeApp() {
  return import('../../middleware/auth.js').then(({ requireApiKey }) => {
    const app = express();
    app.use('/api/export', requireApiKey, exportRouter);
    return app;
  });
}

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    severity: 'critical',
    source: 'scout-api',
    event_type: 'injection_blocked',
    description: 'Blocked, with comma',
    metadata: {},
    ip_address: null,
    session_id: 's1',
    instance_id: 'carina-local',
    mitigated: false,
    created_at: new Date('2026-06-04T12:00:00Z'),
    acknowledged: true,
    acknowledged_at: null,
    acknowledged_note: null,
    ...overrides,
  };
}

describe('GET /api/export/events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
  });

  it('returns JSON attachment by default', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow()] } as never);
    const app = await makeApp();
    const res = await request(app)
      .get('/api/export/events')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="scout-audit-\d{4}-\d{2}-\d{2}\.json"/);
    expect(res.body.count).toBe(1);
    expect(res.body.events).toHaveLength(1);
    expect(res.body.exported_at).toBeTruthy();
  });

  it('returns CSV with RFC 4180 escaping', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow()] } as never);
    const app = await makeApp();
    const res = await request(app)
      .get('/api/export/events?format=csv')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.split('\n');
    expect(lines[0]).toBe(
      'id,severity,source,event_type,description,instance_id,session_id,ip_address,mitigated,acknowledged,created_at',
    );
    expect(lines[1]).toContain('"Blocked, with comma"');
  });

  it('passes severity filter to query', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const app = await makeApp();
    await request(app)
      .get('/api/export/events?severity=critical,breach')
      .set('X-Scout-Key', VALID_KEY);

    const sql = String(queryMock.mock.calls[0]![0]);
    const params = queryMock.mock.calls[0]![1] as unknown[];
    expect(sql).toContain('severity = ANY');
    expect(params).toContainEqual(['critical', 'breach']);
  });

  it('passes date range and instance filters', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const app = await makeApp();
    await request(app)
      .get('/api/export/events?since=2026-06-01&until=2026-06-03&instance_id=carina-local')
      .set('X-Scout-Key', VALID_KEY);

    const sql = String(queryMock.mock.calls[0]![0]);
    const params = queryMock.mock.calls[0]![1] as unknown[];
    expect(sql).toContain('instance_id =');
    expect(params[0]).toEqual(new Date('2026-06-01'));
    expect(params[1]).toEqual(new Date('2026-06-03'));
    expect(params).toContain('carina-local');
  });

  it('applies limit and caps at 50000', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] } as never);
    const app = await makeApp();
    await request(app)
      .get('/api/export/events?limit=999999')
      .set('X-Scout-Key', VALID_KEY);

    const params = queryMock.mock.calls[0]![1] as unknown[];
    expect(params[params.length - 1]).toBe(50_000);
  });

  it('returns 400 when since is not earlier than until', async () => {
    const app = await makeApp();
    const res = await request(app)
      .get('/api/export/events?since=2026-06-03&until=2026-06-01')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('since');
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('returns 401 without API key', async () => {
    const app = await makeApp();
    const res = await request(app).get('/api/export/events');
    expect(res.status).toBe(401);
  });
});
