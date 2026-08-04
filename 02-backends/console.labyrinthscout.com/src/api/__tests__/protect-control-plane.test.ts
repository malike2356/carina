import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => query(...args) },
}));

vi.mock('../../lib/pending-approvals.js', () => ({
  createPendingApproval: vi.fn().mockResolvedValue({
    id: 'approval-1',
    instance_id: 'protect:tenant',
    session_id: 's1',
    tool_name: 'protect.isolate_network',
    action_type: 'protect.isolate_network',
    content: 'host-1',
    params: {},
    risk_score: 95,
    policy_pack: null,
    regulatory_category: null,
    regulation: null,
    requested_at: new Date(),
    expires_at: new Date(Date.now() + 900_000),
    status: 'pending',
    decided_by: null,
    decided_at: null,
    rejection_reason: null,
  }),
}));

vi.mock('../../protect/protect-audit.js', () => ({
  recordProtectAuditEvent: vi.fn().mockResolvedValue({ id: 'sec-evt-1' }),
}));

vi.mock('../../api/sse.js', () => ({
  broadcastEvent: vi.fn(),
  refreshAndBroadcastStats: vi.fn(),
}));

import { protectRouter } from '../protect.js';
import { failClosedRouter } from '../fail-closed.js';
import { setFailClosedMode, getFailClosedMode, resolveUnreachableDecision } from '../../lib/fail-closed.js';
import { evaluateSoftWall, softWallToPolicyKind, policyKindToSoftWall } from '../../security/soft-wall.js';

function buildProtectApp(accountId = '11111111-1111-1111-1111-111111111111') {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as { scoutAuth?: { kind: 'account'; accountId: string } }).scoutAuth = {
      kind: 'account',
      accountId,
    };
    next();
  });
  app.use('/api/protect', protectRouter);
  app.use('/api/fail-closed', failClosedRouter);
  return app;
}

describe('Soft Wall contract', () => {
  it('maps deny↔block and quarantine↔quarantine_session', () => {
    expect(softWallToPolicyKind('deny')).toBe('block');
    expect(softWallToPolicyKind('quarantine')).toBe('quarantine_session');
    expect(policyKindToSoftWall('block')).toBe('deny');
    expect(policyKindToSoftWall('quarantine_session')).toBe('quarantine');
  });

  it('requires approval for CRITICAL protect isolate', async () => {
    const result = await evaluateSoftWall({
      actor: 'ops',
      actionClass: 'protect.isolate_network',
      targetResource: 'host-1',
      riskTier: 'critical',
      tenantId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.decision).toBe('require_approval');
    expect(result.approvalRequestId).toBe('approval-1');
  });

  it('allows CRITICAL only with break-glass', async () => {
    const result = await evaluateSoftWall({
      actor: 'ops',
      actionClass: 'protect.isolate_network',
      targetResource: 'host-1',
      riskTier: 'critical',
      tenantId: '11111111-1111-1111-1111-111111111111',
      breakGlass: true,
    });
    expect(result.decision).toBe('allow');
    expect(result.auditEventId).toMatch(/^breakglass:/);
  });
});

describe('fail-closed resolve', () => {
  it('blocks on fail_closed + block unreachable action', () => {
    expect(resolveUnreachableDecision('block', 'fail_closed')).toBe('block');
    expect(resolveUnreachableDecision('allow', 'fail_open')).toBe('allow');
    expect(resolveUnreachableDecision('block', 'dry_run')).toBe('dry_run');
  });
});

describe('protectRouter tenant isolation', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('returns 428 when contain needs Soft Wall approval', async () => {
    const app = buildProtectApp();
    const res = await request(app)
      .post('/api/protect/contain')
      .send({
        actionClass: 'protect.isolate_network',
        targetResource: '10.0.0.5',
      });
    expect(res.status).toBe(428);
    expect(res.body.decision).toBe('require_approval');
    expect(res.body.approvalRequestId).toBe('approval-1');
  });

  it('rejects foreign sensor on contain after approval', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // ownership check
    const app = buildProtectApp('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    const res = await request(app)
      .post('/api/protect/contain')
      .send({
        actionClass: 'protect.isolate_network',
        targetResource: '10.0.0.5',
        sensorId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        confirmed: true,
      });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/sensorId/i);
  });

  it('creates durable command when confirmed', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'sensor-1' }] }) // ownership
      .mockResolvedValueOnce({ rows: [{ id: 'cmd-1' }] }); // insert command
    const app = buildProtectApp();
    const res = await request(app)
      .post('/api/protect/contain')
      .send({
        actionClass: 'protect.isolate_network',
        targetResource: '10.0.0.5',
        sensorId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        confirmed: true,
      });
    expect(res.status).toBe(202);
    expect(res.body.durable).toBe(true);
    expect(res.body.commandId).toBe('cmd-1');
  });
});

describe('failClosedRouter', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('sets fail-closed mode for tenant', async () => {
    query.mockResolvedValue({ rows: [] });
    const app = buildProtectApp();
    const res = await request(app)
      .post('/api/fail-closed')
      .send({
        toolClass: 'protect.isolate_network',
        mode: 'fail_closed',
        unreachableAction: 'block',
      });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(query).toHaveBeenCalled();
  });
});

describe('fail-closed lib with mock pool', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('defaults to fail_open when no row', async () => {
    query.mockResolvedValue({ rows: [] });
    const mode = await getFailClosedMode('11111111-1111-1111-1111-111111111111', 'protect.isolate_network');
    expect(mode.mode).toBe('fail_open');
    expect(mode.unreachableAction).toBe('allow');
  });

  it('setFailClosedMode upserts', async () => {
    query.mockResolvedValue({ rows: [] });
    await setFailClosedMode(
      '11111111-1111-1111-1111-111111111111',
      'protect.isolate_network',
      'fail_closed',
      'block',
    );
    expect(query.mock.calls[0]![0]).toMatch(/INSERT INTO fail_closed_config/);
  });
});
