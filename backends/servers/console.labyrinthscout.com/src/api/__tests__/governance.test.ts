import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import session from 'express-session';

const queryMock = vi.fn();

vi.mock('../../db.js', () => ({
  pool: { query: (...args: unknown[]) => queryMock(...args) },
}));

vi.mock('../../redis.js', () => ({
  getRedis: () => null,
}));

vi.mock('../../config/index.js', () => ({
  config: {
    auth: {
      apiKey: 'test-scout-key',
      sessionTimeoutMs: 86_400_000,
    },
    alerts: {
      telegram: { botToken: '', chatId: '' },
      email: { resendApiKey: '', to: '' },
      slack: { webhookUrl: '' },
      discord: { webhookUrl: '' },
    },
  },
}));

vi.mock('../../trust/build-public-trust.js', () => ({
  buildPublicTrustFromDb: vi.fn().mockResolvedValue({
    generated_at: new Date().toISOString(),
    risk_score: 18,
    risk_tier: 'low',
    risk_tier_label: 'Low risk',
    verification: null,
    identity: null,
    monitoring: {
      scout_active: true,
      agents_protected: 1,
      agents_active: 1,
      agents_suspended: 0,
      last_scan_at: new Date().toISOString(),
      last_scan_relative: '1m ago',
      last_heartbeat_at: new Date().toISOString(),
    },
    metrics: {
      injection_blocks_24h: 0,
      runtime_incidents_30d: 0,
      events_today: 2,
      threats_24h: 0,
      blocked_24h: 0,
    },
    attestations: [],
    chain: {
      erc8004_status: 'live',
      erc8004_label: 'Live on Base',
      erc8126_status: 'planned',
      erc8126_label: 'Planned',
      wallet_configured: true,
    },
    data_freshness: { stale: false, stale_reason: null, max_age_minutes: 60 },
    source: 'labyrinth-scout',
  }),
}));

vi.mock('../../lib/platform-settings.js', () => ({
  loadPlatformSecuritySettings: vi.fn().mockResolvedValue({
    egress_filter_enabled: true,
    egress_filter_source: 'env',
    sandbox_enabled: false,
    sandbox_source: 'env',
  }),
}));

vi.mock('../../killswitch/global-kill-switch.js', () => ({
  globalKillSwitch: {
    getStatus: () => ({
      armed: true,
      triggered: false,
      triggered_by: null,
      reason: null,
      agents_active: 1,
    }),
  },
}));

vi.mock('../../lib/pending-approvals.js', () => ({
  fetchApprovalStats: vi.fn().mockResolvedValue({
    workflow_active: true,
    pending_count: 0,
    approved_30d: 2,
    rejected_30d: 0,
    expired_30d: 0,
    avg_decision_secs: 45,
  }),
}));

vi.mock('../../lib/industry-template-store.js', () => ({
  getActiveIndustryTemplateSummary: vi.fn().mockResolvedValue(null),
}));

function defaultQueryMock() {
  queryMock.mockImplementation((sql: string) => {
    const text = String(sql);
    if (text.includes('FROM carina_instances')) {
      return Promise.resolve({
        rows: [{
          id: 'carina-local',
          name: 'Carina Local',
          status: 'active',
          suspension_reason: null,
          last_heartbeat: new Date(),
        }],
      });
    }
    if (text.includes('COUNT(*)') && text.includes('7 days')) {
      return Promise.resolve({ rows: [{ count: '5' }] });
    }
    if (text.includes('COUNT(*)') && text.includes('24 hours')) {
      return Promise.resolve({ rows: [{ count: '3' }] });
    }
    if (text.includes('MIN(created_at)')) {
      return Promise.resolve({ rows: [{ days: '10' }] });
    }
    if (text.includes('trust_attestations')) {
      return Promise.resolve({
        rows: [{
          submitted_at: new Date(),
          chain_id: 8453,
          tx_hash: '0xabc123',
          score: 18,
        }],
      });
    }
    if (text.includes('kill_switch')) {
      return Promise.resolve({ rows: [] });
    }
    if (text.includes('severity IN')) {
      return Promise.resolve({ rows: [] });
    }
    if (text.includes('information_schema.tables') && text.includes('pending_approvals')) {
      return Promise.resolve({ rows: [{ exists: true }] });
    }
    return Promise.resolve({ rows: [] });
  });
}

async function makeApp(withSession: boolean, withApiKey = false) {
  const { governanceRouter } = await import('../governance.js');
  const { requireOperatorAuth } = await import('../../middleware/operator-auth.js');
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));
  if (withSession) {
    app.use((req, _res, next) => {
      req.session.accountId = 'test-account-id';
      req.session.lastSeenAt = Date.now();
      next();
    });
  }
  app.use('/api/governance', requireOperatorAuth, governanceRouter);
  return { app, withApiKey };
}

describe('governanceRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryMock.mockReset();
    defaultQueryMock();
  });

  it('GET /api/governance/posture returns 401 without session or API key', async () => {
    const { app } = await makeApp(false);
    const res = await request(app).get('/api/governance/posture');
    expect(res.status).toBe(401);
  });

  it('GET /api/governance/posture returns 200 with valid session', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    expect(res.status).toBe(200);
  });

  it('GET /api/governance/posture returns 200 with operator API key', async () => {
    const { app } = await makeApp(false);
    const res = await request(app)
      .get('/api/governance/posture')
      .set('X-Scout-Key', 'test-scout-key');
    expect(res.status).toBe(200);
  });

  it('posture response has all required top-level keys', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    expect(res.body).toMatchObject({
      generated_at: expect.any(String),
      eu_ai_act: expect.any(Object),
      uk_dsit: expect.any(Object),
      frameworks: expect.any(Object),
      governance_score: expect.any(Number),
      governance_label: expect.any(String),
      attestations: expect.any(Array),
      action_items: expect.any(Array),
      agents: expect.any(Object),
      human_oversight: expect.any(Object),
      active_industry_template: null,
    });
  });

  it('governance_score is a number 0-100', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    expect(res.body.governance_score).toBeGreaterThanOrEqual(0);
    expect(res.body.governance_score).toBeLessThanOrEqual(100);
  });

  it('governance_label is one of Compliant / At Risk / Non-Compliant', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    expect(['Compliant', 'At Risk', 'Non-Compliant']).toContain(res.body.governance_label);
  });

  it('framework scores are all 0-100', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    for (const value of Object.values(res.body.frameworks)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });

  it('action_items each have priority, label, framework, article', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    for (const item of res.body.action_items) {
      expect(item).toMatchObject({
        priority: expect.stringMatching(/critical|high|medium/),
        label: expect.any(String),
        framework: expect.any(String),
        article: expect.any(String),
      });
    }
  });

  it('attestations array exists (empty is valid)', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/posture');
    expect(Array.isArray(res.body.attestations)).toBe(true);
  });

  it('GET /api/governance/board-report returns PDF content-type', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/board-report?format=pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.slice(0, 4).toString()).toBe('%PDF');
  });

  it('GET /api/governance/board-report?format=json returns governance data', async () => {
    const { app } = await makeApp(true);
    const res = await request(app).get('/api/governance/board-report?format=json');
    expect(res.status).toBe(200);
    expect(res.body.governance_score).toBeDefined();
    expect(Array.isArray(res.body.report_sections)).toBe(true);
  });
});
