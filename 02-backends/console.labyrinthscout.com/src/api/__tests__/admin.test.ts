import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();
const publishMock = vi.fn();
const delMock = vi.fn();
const dispatchMock = vi.fn();
const broadcastMock = vi.fn();
const listAccountsMock = vi.fn();
const setAccountActiveMock = vi.fn();
const adminResetAccountPasswordMock = vi.fn();
const adminResetApiKeyMock = vi.fn();

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

vi.mock('../../lib/accounts.js', () => ({
  listAccounts: (...args: unknown[]) => listAccountsMock(...args),
  setAccountActive: (...args: unknown[]) => setAccountActiveMock(...args),
  adminResetAccountPassword: (...args: unknown[]) => adminResetAccountPasswordMock(...args),
  adminResetApiKey: (...args: unknown[]) => adminResetApiKeyMock(...args),
}));

import { adminRouter } from '../admin.js';

function makeApp(scoutAuth?: { kind: 'operator' } | { kind: 'account'; accountId: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (scoutAuth) {
      (req as { scoutAuth?: unknown }).scoutAuth = scoutAuth;
    }
    next();
  });
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
    listAccountsMock.mockReset();
    setAccountActiveMock.mockReset();
    adminResetAccountPasswordMock.mockReset();
    adminResetApiKeyMock.mockReset();
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

    const res = await request(makeApp({ kind: 'operator' }))
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

    const res = await request(makeApp({ kind: 'operator' }))
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

    const app = makeApp({ kind: 'operator' });
    const first = await request(app).post('/api/admin/alert-test').send({ severity: 'warning' });
    const second = await request(app).post('/api/admin/alert-test').send({ severity: 'warning' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(delMock).toHaveBeenCalledTimes(2);
    expect(dispatchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/admin/accounts', () => {
  beforeEach(() => {
    listAccountsMock.mockReset();
  });

  it('returns accounts for operator auth', async () => {
    listAccountsMock.mockResolvedValue([
      {
        id: 'acc-1',
        email: 'user@example.com',
        createdAt: '2026-01-01T00:00:00Z',
        isActive: true,
        subscriptionPlan: 'scout_pro',
        carinaTenantId: null,
        apiKeyCount: 1,
        activeApiKeyCount: 1,
      },
    ]);
    const res = await request(makeApp({ kind: 'operator' })).get('/api/admin/accounts');
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
    expect(res.body.accounts[0].email).toBe('user@example.com');
  });

  it('rejects subscriber account keys', async () => {
    const res = await request(makeApp({ kind: 'account', accountId: 'acc-1' })).get('/api/admin/accounts');
    expect(res.status).toBe(403);
    expect(listAccountsMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/accounts/:id/deactivate', () => {
  beforeEach(() => {
    setAccountActiveMock.mockReset();
  });

  it('deactivates account for operator auth', async () => {
    setAccountActiveMock.mockResolvedValue(true);
    const res = await request(makeApp({ kind: 'operator' }))
      .post('/api/admin/accounts/550e8400-e29b-41d4-a716-446655440000/deactivate');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(setAccountActiveMock).toHaveBeenCalledWith('550e8400-e29b-41d4-a716-446655440000', false);
  });
});
