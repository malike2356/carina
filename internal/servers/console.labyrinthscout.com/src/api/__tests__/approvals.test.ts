import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const queryMock = vi.fn();
const broadcastRequestMock = vi.fn();
const broadcastDecisionMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../api/sse.js', () => ({
  broadcastApprovalRequest: (...args: unknown[]) => broadcastRequestMock(...args),
  broadcastApprovalDecision: (...args: unknown[]) => broadcastDecisionMock(...args),
}));

vi.mock('../../config/index.js', () => ({
  config: {
    auth: {
      apiKey: 'test-scout-key',
      sessionTimeoutMs: 86_400_000,
    },
  },
}));

const VALID_KEY = 'test-scout-key';
const APPROVAL_ID = '11111111-1111-1111-1111-111111111111';

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVAL_ID,
    instance_id: 'carina-local',
    session_id: 'sess-1',
    tool_name: 'email-send',
    action_type: 'email',
    content: null,
    params: null,
    risk_score: 72,
    policy_pack: null,
    regulatory_category: 'Financial promotion',
    regulation: null,
    requested_at: new Date('2026-06-13T16:00:00Z'),
    expires_at: new Date(Date.now() + 900_000),
    status: 'pending',
    decided_by: null,
    decided_at: null,
    rejection_reason: null,
    ...overrides,
  };
}

async function makeApp() {
  const { requireApiKey } = await import('../../middleware/auth.js');
  const { approvalsRouter } = await import('../approvals.js');
  const app = express();
  app.use(express.json());
  app.use('/api/approvals', approvalsRouter);
  return app;
}

describe('approvalsRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    broadcastRequestMock.mockReset();
    broadcastDecisionMock.mockReset();
  });

  it('POST /api/approvals/request creates pending approval', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow()] });
    const app = await makeApp();
    const res = await request(app)
      .post('/api/approvals/request')
      .set('X-Scout-Key', VALID_KEY)
      .send({
        instance_id: 'carina-local',
        session_id: 'sess-1',
        tool_name: 'email-send',
        action_type: 'email',
        risk_score: 72,
      });

    expect(res.status).toBe(201);
    expect(res.body.approval_id).toBe(APPROVAL_ID);
    expect(res.body.status).toBe('pending');
    expect(broadcastRequestMock).toHaveBeenCalledOnce();
  });

  it('POST /api/approvals/request requires instance_id', async () => {
    const app = await makeApp();
    const res = await request(app)
      .post('/api/approvals/request')
      .set('X-Scout-Key', VALID_KEY)
      .send({ session_id: 'sess-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('instance_id');
  });

  it('GET /api/approvals/:id/status returns pending for new request', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow()] });
    const app = await makeApp();
    const res = await request(app)
      .get(`/api/approvals/${APPROVAL_ID}/status`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('pending');
    expect(res.body.approval_id).toBe(APPROVAL_ID);
  });

  it('POST /api/approvals/:id/approve sets status to approved', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sampleRow()] })
      .mockResolvedValueOnce({ rows: [sampleRow({ status: 'approved', decided_by: 'operator', decided_at: new Date() })] });
    const app = await makeApp();
    const res = await request(app)
      .post(`/api/approvals/${APPROVAL_ID}/approve`)
      .set('X-Scout-Key', VALID_KEY)
      .send({ decided_by: 'operator' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, approval_id: APPROVAL_ID, status: 'approved' });
    expect(broadcastDecisionMock).toHaveBeenCalledOnce();
  });

  it('POST /api/approvals/:id/reject sets status to rejected with reason', async () => {
    queryMock
      .mockResolvedValueOnce({ rows: [sampleRow()] })
      .mockResolvedValueOnce({ rows: [sampleRow({ status: 'rejected', decided_by: 'operator', decided_at: new Date(), rejection_reason: 'too risky' })] });
    const app = await makeApp();
    const res = await request(app)
      .post(`/api/approvals/${APPROVAL_ID}/reject`)
      .set('X-Scout-Key', VALID_KEY)
      .send({ reason: 'too risky' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
  });

  it('GET /api/approvals/:id/status returns approved after approval', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [sampleRow({ status: 'approved', decided_by: 'operator', decided_at: new Date() })],
    });
    const app = await makeApp();
    const res = await request(app)
      .get(`/api/approvals/${APPROVAL_ID}/status`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');
  });

  it('POST /api/approvals/:id/approve returns 409 if already decided', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [sampleRow({ status: 'approved', decided_by: 'operator', decided_at: new Date() })],
    });
    const app = await makeApp();
    const res = await request(app)
      .post(`/api/approvals/${APPROVAL_ID}/approve`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(409);
  });

  it('GET /api/approvals/pending returns empty array when none pending', async () => {
    queryMock.mockResolvedValueOnce({ rows: [] });
    const app = await makeApp();
    const res = await request(app)
      .get('/api/approvals/pending')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('GET /api/approvals/pending returns pending approvals after request', async () => {
    queryMock.mockResolvedValueOnce({ rows: [sampleRow()] });
    const app = await makeApp();
    const res = await request(app)
      .get('/api/approvals/pending')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(APPROVAL_ID);
  });

  it('Expired approval: status becomes expired when past expires_at', async () => {
    queryMock
      .mockResolvedValueOnce({
        rows: [sampleRow({ expires_at: new Date(Date.now() - 60_000) })],
      })
      .mockResolvedValueOnce({
        rows: [sampleRow({ status: 'expired', expires_at: new Date(Date.now() - 60_000) })],
      });
    const app = await makeApp();
    const res = await request(app)
      .get(`/api/approvals/${APPROVAL_ID}/status`)
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('expired');
  });

  it('GET /api/approvals/history returns decided approvals', async () => {
    queryMock.mockResolvedValueOnce({
      rows: [sampleRow({ status: 'approved', decided_by: 'operator', decided_at: new Date() })],
    });
    const app = await makeApp();
    const res = await request(app)
      .get('/api/approvals/history')
      .set('X-Scout-Key', VALID_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].status).toBe('approved');
  });
});

describe('policyEvaluateRouter require_approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
  });

  it('POST /api/policy/evaluate with require_approval returns approval_id in response', async () => {
    const { policyEvaluateRouter } = await import('../policy-evaluate.js');
    const { resetPolicyGatewayDeps, setPolicyGatewayDeps } = await import('../../security/policy-gateway.js');
    const { resetShieldModesForTests } = await import('../../security/session-shield.js');

    resetPolicyGatewayDeps();
    resetShieldModesForTests();
    setPolicyGatewayDeps({
      logDecision: vi.fn().mockResolvedValue(undefined),
      isSessionBlocked: async () => false,
      isToolQuarantined: async () => false,
    });

    queryMock.mockResolvedValueOnce({ rows: [sampleRow()] });

    const app = express();
    app.use(express.json());
    app.use('/api/policy', policyEvaluateRouter);

    const res = await request(app)
      .post('/api/policy/evaluate')
      .send({
        session_id: 'sess-3',
        tool_name: 'file-write',
        params: { path: '/tmp/test.txt' },
      });

    expect(res.status).toBe(200);
    expect(res.body.decision).toBe('require_approval');
    expect(res.body.approval_id).toBe(APPROVAL_ID);
    expect(res.body.poll_url).toBe(`/api/approvals/${APPROVAL_ID}/status`);
  });
});
