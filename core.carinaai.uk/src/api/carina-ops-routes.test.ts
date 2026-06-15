import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

process.env.CARINA_OPS_PRODUCT_ENABLED = 'true';
process.env.CARINA_OPS_TOKEN = 'test-admin-token';

vi.mock('../config/index.js', () => ({
  config: {
    carinaOps: { productEnabled: true },
    hosted: { freeDailyMessages: 100 },
  },
}));

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string) => {
      if (/COUNT\(\*\)/.test(sql)) return { rows: [{ count: '2' }], rowCount: 1 };
      if (/messages_today/.test(sql)) return { rows: [{ messages_today: 5 }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    }),
  },
}));

vi.mock('../hosted/org-service.js', () => ({
  getOrgProfile: vi.fn(async (orgId: string) => ({
    id: orgId,
    name: 'Test Org',
    plan: 'carina_ops_starter',
  })),
}));

vi.mock('../billing/usage-meter.js', () => ({
  UsageMeter: class {
    async getMonthlyUsageForOrg() {
      return 1200;
    }
  },
}));

vi.mock('../hosted/vault-service.js', () => ({
  orgHasByokKey: vi.fn(async () => false),
}));

vi.mock('../hosted/workbench-service.js', () => ({
  orgHasWorkbenchRun: vi.fn(async () => false),
}));

vi.mock('../hosted/usage-service.js', () => ({
  getTodayUsage: vi.fn(async () => ({ tokens: 5, cost: 0.01 })),
  getCreditsStatus: vi.fn(async () => ({
    unit: 'credits',
    monthlyLimit: 500_000,
    usedThisMonth: 1000,
    remaining: 499_000,
    percentUsed: 0,
    warning: false,
    creditsIncluded: 500_000,
    topups: 0,
    modelMix: [],
    allowedClasses: ['mini', 'balanced'],
    highestModelClass: 'balanced',
  })),
  getUsageSummary: vi.fn(async () => ({ totalTokens: 0, totalCost: 0, daily: [] })),
  getUsageByModel: vi.fn(async () => []),
  exportUsageCsv: vi.fn(async () => 'date,model,tokens_used,cost_estimate\n2026-01-01,openai/gpt-4o,100,0.01'),
}));

const estimateWorkbenchUsage = vi.hoisted(() => vi.fn(async () => ({
  modelClass: 'balanced',
  allowed: true,
  estimatedCredits: 42,
  estimatedProviderCostUsd: 0.0012,
  remainingCredits: 499_000,
  percentUsed: 0.2,
  byok: true,
})));

const resolveWorkbenchInferenceMode = vi.hoisted(() => vi.fn(async () => 'byok' as const));

vi.mock('../hosted/workbench-inference.js', () => ({
  resolveWorkbenchInferenceMode,
}));

vi.mock('../hosted/ai-platform-models.js', () => ({
  listModelsForOrg: vi.fn(async (orgId: string) => {
    if (orgId === 'org-other') return [{ id: 'm1', provider: 'openai', model: 'gpt-4o', tier: 'balanced', modelClass: 'balanced', isDefault: true, status: 'active', inputPrice: 1, outputPrice: 2, notes: null }];
    return [{ id: 'm1', provider: 'anthropic', model: 'claude-sonnet', tier: 'balanced', modelClass: 'balanced', isDefault: true, status: 'active', inputPrice: 3, outputPrice: 15, notes: null }];
  }),
}));

vi.mock('../billing/ops-metering-service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../billing/ops-metering-service.js')>();
  return {
    ...actual,
    estimateWorkbenchUsage,
    getOpsCreditUsageSummary: vi.fn(async () => null),
    getOpsModelMetering: vi.fn(async () => ({
      allowedClasses: ['mini', 'balanced'],
      rateCard: { balanced: { inputWeight: 0.000006, outputWeight: 0.000024, cacheWeight: 0.0000015 } },
    })),
  };
});

vi.mock('../billing/margin-report.js', () => ({
  getPlatformMarginSummary: vi.fn(async () => ({
    floor: 0.65,
    month: '2026-06',
    orgs: [{
      orgId: 'org-starter',
      orgName: 'Test Org',
      planId: 'carina_ops_starter',
      creditsBilled: 1000,
      providerCostUsd: 0.2,
      creditRevenueUsd: 0.05,
      grossMargin: 0.75,
      belowFloor: false,
      byokCostOnly: false,
    }],
    totals: {
      creditsBilled: 1000,
      providerCostUsd: 0.2,
      creditRevenueUsd: 0.05,
      grossMargin: 0.75,
    },
  })),
}));

vi.mock('../gateway/web-auth.js', () => ({
  requireHostedSession: vi.fn(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.hostedAccountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    req.orgContext = {
      userId: req.session.hostedAccountId,
      orgId: req.session.hostedOrgId ?? 'org-free',
      role: req.session.hostedOrgRole ?? 'owner',
      email: 'user@test.com',
    };
    next();
  }),
  requireOrgMember: () => async (_req: Request, _res: Response, next: NextFunction) => {
    next();
  },
}));

vi.mock('../hosted/plan-gates.js', () => ({
  getOrgPlan: vi.fn(async (orgId: string) => (
    orgId === 'org-team' ? 'carina_ops_team' : 'carina_ops_starter'
  )),
  requireOpsPlan: () => async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.orgContext?.orgId ?? req.session?.hostedOrgId;
    if (orgId === 'org-free') {
      res.status(402).json({
        error: 'upgrade_required',
        plan: 'carina_ops_starter',
        upgradeUrl: '/ops/billing',
      });
      return;
    }
    next();
  },
  requireFeature: (feature: string) => async (req: Request, res: Response, next: NextFunction) => {
    const orgId = req.orgContext?.orgId ?? req.session?.hostedOrgId;
    if (feature === 'exports' && orgId !== 'org-team') {
      res.status(402).json({ error: 'upgrade_required', feature: 'exports', upgradeUrl: '/ops/billing' });
      return;
    }
    next();
  },
}));

vi.mock('../hosted/onboarding-service.js', () => ({
  getOnboardingChecklist: vi.fn(async () => ({
    steps: [{ id: 'register', label: 'Create account', done: true }],
    completedCount: 1,
    totalCount: 7,
    percentComplete: 14,
    dismissed: false,
  })),
  dismissOnboardingWizard: vi.fn(async () => undefined),
  markUsageViewed: vi.fn(async () => undefined),
}));

vi.mock('../hosted/product-audit.js', () => ({
  listProductAuditForPlan: vi.fn(async () => ({ events: [], nextCursor: undefined })),
  exportProductAuditCsv: vi.fn(async () => 'id,action\naudit-1,test.event'),
  writeProductAudit: vi.fn(async () => undefined),
}));

const controlPlaneSummary = vi.hoisted(() => vi.fn(async () => ({
  files: 1,
  batches: 0,
  agents: 2,
  sessions: 3,
  memoryStores: 1,
  workbenchRuns: 4,
  deployments: 0,
  environments: 0,
  skillPacksInstalled: 1,
})));

vi.mock('../hosted/control-plane-service.js', () => ({
  ControlPlaneValidationError: class extends Error {
    statusCode = 400;
  },
  createAgentForOrg: vi.fn(async () => ({ id: 'agent-1', name: 'Support', slug: 'support', status: 'active', provider: '', model: '' })),
  createBatchForOrg: vi.fn(async () => ({ id: 'batch-1', name: 'Batch', status: 'queued', batchInputCount: 1, batchOutputCount: 0 })),
  createFileForOrg: vi.fn(async () => ({ id: 'file-1', name: 'doc.pdf', status: 'ready', mimeType: 'application/pdf' })),
  createMemoryStoreForOrg: vi.fn(async () => ({ id: 'mem-1', name: 'Episodic', slug: 'episodic', storeType: 'episodic', status: 'active', recordCount: 0 })),
  createSessionForOrg: vi.fn(async () => ({ id: 'sess-1', title: 'Chat', channel: 'workbench', status: 'open', messageCount: 0 })),
  getAnalyticsForOrg: vi.fn(async () => ({
    days: 30,
    totals: { tokensIn: 10, tokensOut: 20, creditsBilled: 1, costEstimate: 0.01, requestCount: 2 },
    daily: [{ usageDate: '2026-06-15', tokensIn: 10, tokensOut: 20, creditsBilled: 1, costEstimate: 0.01, requestCount: 2 }],
    workbenchRuns: 2,
  })),
  getControlPlaneSummary: controlPlaneSummary,
  listAgentsForOrg: vi.fn(async () => [{ id: 'agent-1', name: 'Support', slug: 'support', status: 'active', provider: 'anthropic', model: 'claude' }]),
  listBatchesForOrg: vi.fn(async () => []),
  listFilesForOrg: vi.fn(async () => [{ id: 'file-1', name: 'doc.pdf', status: 'ready', mimeType: 'application/pdf', sizeBytes: 100 }]),
  listMemoryStoresForOrg: vi.fn(async () => []),
  listSessionsForOrg: vi.fn(async () => []),
  listSkillPacksForTenant: vi.fn(async () => [{ name: 'core', version: '1.0.0', skillCount: 3, installed: true, status: 'active' }]),
}));

import { mountCarinaOpsRoutes } from './carina-ops-routes.js';

function makeApp(session?: { hostedAccountId?: string; hostedOrgId?: string; hostedOrgRole?: string }) {
  const app = express();
  app.use((req, _res, next) => {
    if (session) req.session = session as never;
    next();
  });
  mountCarinaOpsRoutes(app);
  return app;
}

async function request(app: express.Express, path: string, init?: RequestInit) {
  return new Promise<{ status: number; body: unknown; contentType: string | null }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('no address'));
        return;
      }
      fetch(`http://127.0.0.1:${address.port}${path}`, init)
        .then(async (res) => {
          const contentType = res.headers.get('content-type');
          const body = contentType?.includes('text/csv')
            ? await res.text()
            : await res.json().catch(() => ({}));
          server.close(() => resolve({ status: res.status, body, contentType }));
        })
        .catch((err) => {
          server.close(() => reject(err));
        });
    });
  });
}

describe('carina-ops-routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('health endpoint is public and returns product id', async () => {
    const app = makeApp();
    const result = await request(app, '/api/carina-ops/health');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ ok: true, product: 'carina-ops' });
  });

  it('overview returns 401 without session', async () => {
    const app = makeApp();
    const result = await request(app, '/api/carina-ops/overview');
    expect(result.status).toBe(401);
  });

  it('overview returns 402 for free plan', async () => {
    const app = makeApp({
      hostedAccountId: 'user-1',
      hostedOrgId: 'org-free',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/overview');
    expect(result.status).toBe(402);
    expect(result.body).toMatchObject({ error: 'upgrade_required' });
  });

  it('overview returns 200 for starter org', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/overview');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      org: { id: 'org-starter', name: 'Test Org' },
      members: 2,
    });
  });

  it('models endpoint returns org-scoped catalog', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/models');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      models: [{ provider: 'anthropic', isDefault: true }],
    });
  });

  it('onboarding endpoint returns checklist', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/onboarding');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ totalCount: 7, dismissed: false });
  });

  it('audit export returns 402 for starter plan', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/audit/export?format=csv');
    expect(result.status).toBe(402);
    expect(result.body).toMatchObject({ error: 'upgrade_required', feature: 'exports' });
  });

  it('audit export returns csv for team plan', async () => {
    const app = makeApp({
      hostedAccountId: 'user-3',
      hostedOrgId: 'org-team',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/audit/export?format=csv');
    expect(result.status).toBe(200);
    expect(result.contentType).toContain('text/csv');
    expect(String(result.body)).toContain('id,action');
  });

  it('workbench estimate returns usage preview', async () => {
    resolveWorkbenchInferenceMode.mockResolvedValueOnce('byok');
    estimateWorkbenchUsage.mockResolvedValueOnce({
      modelClass: 'balanced',
      allowed: true,
      estimatedCredits: 42,
      estimatedProviderCostUsd: 0.0012,
      remainingCredits: 499_000,
      percentUsed: 0.2,
      byok: true,
    });
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/workbench/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hello',
        provider: 'anthropic',
        model: 'claude-sonnet',
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      modelClass: 'balanced',
      allowed: true,
      estimatedCredits: 42,
      remainingCredits: 499_000,
      byok: true,
      inferenceMode: 'byok',
    });
    expect(estimateWorkbenchUsage).toHaveBeenCalledWith(
      expect.objectContaining({ byok: true }),
    );
  });

  it('workbench estimate returns 400 when no inference path exists', async () => {
    resolveWorkbenchInferenceMode.mockResolvedValueOnce(null);
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/workbench/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hello',
        provider: 'anthropic',
        model: 'claude-sonnet',
      }),
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ inferenceMode: null });
    expect(estimateWorkbenchUsage).not.toHaveBeenCalled();
  });

  it('workbench estimate returns blocked class', async () => {
    resolveWorkbenchInferenceMode.mockResolvedValueOnce('byok');
    estimateWorkbenchUsage.mockResolvedValueOnce({
      modelClass: 'frontier',
      allowed: false,
      gateReason: 'model class not available on your plan',
      estimatedCredits: 0,
      estimatedProviderCostUsd: 0,
      remainingCredits: 0,
      percentUsed: null,
      byok: true,
    });
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/workbench/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hello',
        provider: 'openai',
        model: 'gpt-5-preview',
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      allowed: false,
      modelClass: 'frontier',
      gateReason: expect.stringContaining('not available'),
    });
  });

  it('workbench estimate returns over-limit preview for managed path', async () => {
    resolveWorkbenchInferenceMode.mockResolvedValueOnce('managed');
    estimateWorkbenchUsage.mockResolvedValueOnce({
      modelClass: 'mini',
      allowed: false,
      gateReason: 'monthly credit allowance exhausted',
      estimatedCredits: 120,
      estimatedProviderCostUsd: 0.0005,
      remainingCredits: 0,
      percentUsed: 100,
      byok: false,
    });
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/workbench/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Long prompt',
        provider: 'openai',
        model: 'gpt-4o-mini',
      }),
    });
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      allowed: false,
      remainingCredits: 0,
      byok: false,
      inferenceMode: 'managed',
    });
    expect(estimateWorkbenchUsage).toHaveBeenCalledWith(
      expect.objectContaining({ byok: false }),
    );
  });

  it('workbench estimate requires provider and model', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/workbench/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Hello' }),
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({ error: expect.stringContaining('required') });
  });

  it('admin margins requires ops bearer token', async () => {
    const app = makeApp();
    const denied = await request(app, '/api/carina-ops/admin/margins');
    expect(denied.status).toBe(401);
    const ok = await request(app, '/api/carina-ops/admin/margins', {
      headers: { Authorization: 'Bearer test-admin-token' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({
      floor: 0.65,
      orgs: expect.arrayContaining([
        expect.objectContaining({ orgName: 'Test Org', belowFloor: false }),
      ]),
    });
  });

  it('platform summary returns control-plane counts', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/platform/summary');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      summary: { files: 1, agents: 2, sessions: 3 },
    });
    expect(controlPlaneSummary).toHaveBeenCalledWith('org-starter', 'user-2');
  });

  it('files list and create endpoints work', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const list = await request(app, '/api/carina-ops/files');
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ files: [{ name: 'doc.pdf' }] });
    const created = await request(app, '/api/carina-ops/files', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'new.pdf' }),
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ file: { name: 'doc.pdf' } });
  });

  it('skills endpoint returns pack catalog', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/skills');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      packs: [{ name: 'core', installed: true }],
    });
  });

  it('analytics endpoint returns daily ledger', async () => {
    const app = makeApp({
      hostedAccountId: 'user-2',
      hostedOrgId: 'org-starter',
      hostedOrgRole: 'owner',
    });
    const result = await request(app, '/api/carina-ops/analytics?days=30');
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
      totals: { requestCount: 2 },
      daily: expect.arrayContaining([
        expect.objectContaining({ usageDate: '2026-06-15' }),
      ]),
    });
  });
});
