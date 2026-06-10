import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();
const publishMock = vi.fn();
const delMock = vi.fn();
const dispatchMock = vi.fn();
const broadcastMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: vi.fn(() => ({
    publish: publishMock,
    del: delMock,
  })),
}));

vi.mock('../../security/anomaly-detector.js', () => ({
  baselineLearner: { computeBaselines: vi.fn() },
}));

vi.mock('../../alerts/dispatcher.js', () => ({
  alertDispatcher: { dispatch: (...args: unknown[]) => dispatchMock(...args) },
  toSecurityEvent: (row: unknown) => row,
}));

vi.mock('../sse.js', () => ({
  broadcastEvent: (...args: unknown[]) => broadcastMock(...args),
}));

import { adminRouter } from '../admin.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  return app;
}

function mockInsertRow(severity: string, instanceId = 'carina-local') {
  return {
    id: 'evt-test-1',
    severity,
    source: 'labyrinth',
    event_type: 'alert_test',
    description: 'Alert test fired by operator',
    metadata: { test: true },
    ip_address: null,
    session_id: null,
    instance_id: instanceId,
    mitigated: false,
    created_at: new Date('2026-06-04T12:00:00Z'),
    acknowledged: false,
    acknowledged_at: null,
    acknowledged_note: null,
  };
}

describe('POST /api/admin/alert-test', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    publishMock.mockReset();
    delMock.mockReset();
    dispatchMock.mockReset();
    broadcastMock.mockReset();
    dispatchMock.mockResolvedValue(undefined);
  });

  it('fires test alert and returns channel count', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [mockInsertRow('critical')] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'ch-1',
            channel_type: 'telegram',
            severity_threshold: 'warning',
            enabled: true,
            config: {},
          },
          {
            id: 'ch-2',
            channel_type: 'slack',
            severity_threshold: 'warning',
            enabled: true,
            config: {},
          },
        ],
      } as never);

    const res = await request(makeApp())
      .post('/api/admin/alert-test')
      .send({ severity: 'critical', instance_id: 'carina-local' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.channels_notified).toBe(2);
    expect(typeof res.body.event_id).toBe('string');
    expect(publishMock).toHaveBeenCalledOnce();
    expect(broadcastMock).toHaveBeenCalledOnce();
    expect(delMock).toHaveBeenCalledWith('scout:alert-dedup:carina-local:alert_test');
    expect(dispatchMock).toHaveBeenCalledOnce();
  });

  it('defaults invalid severity to critical', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [mockInsertRow('critical')] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    const res = await request(makeApp())
      .post('/api/admin/alert-test')
      .send({ severity: 'ultra' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const insertArgs = queryMock.mock.calls[0]![1] as unknown[];
    expect(insertArgs[1]).toBe('critical');
  });

  it('allows successive tests by clearing dedup key each time', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [mockInsertRow('warning')] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'ch-1',
            channel_type: 'email',
            severity_threshold: 'warning',
            enabled: true,
            config: {},
          },
        ],
      } as never)
      .mockResolvedValueOnce({ rows: [mockInsertRow('warning')] } as never)
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'ch-1',
            channel_type: 'email',
            severity_threshold: 'warning',
            enabled: true,
            config: {},
          },
        ],
      } as never);

    const app = makeApp();
    const first = await request(app).post('/api/admin/alert-test').send({ severity: 'warning' });
    const second = await request(app).post('/api/admin/alert-test').send({ severity: 'warning' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(delMock).toHaveBeenCalledTimes(2);
    expect(dispatchMock).toHaveBeenCalledTimes(2);
  });
});
