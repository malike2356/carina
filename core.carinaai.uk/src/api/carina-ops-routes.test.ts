import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

process.env.CARINA_OPS_PRODUCT_ENABLED = 'true';

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
    monthlyLimit: 500_000,
    usedThisMonth: 1000,
    remaining: 499_000,
    percentUsed: 0,
    warning: false,
  })),
  getUsageSummary: vi.fn(async () => ({ totalTokens: 0, totalCost: 0, daily: [] })),
  getUsageByModel: vi.fn(async () => []),
  exportUsageCsv: vi.fn(async () => 'date,model,tokens_used,cost_estimate\n2026-01-01,openai/gpt-4o,100,0.01'),
}));

vi.mock('../hosted/ai-platform-models.js', () => ({
  listModelsForOrg: vi.fn(async (orgId: string) => {
    if (orgId === 'org-other') return [{ id: 'm1', provider: 'openai', model: 'gpt-4o', tier: 'balanced', isDefault: true, status: 'active', inputPrice: 1, outputPrice: 2, notes: null }];
    return [{ id: 'm1', provider: 'anthropic', model: 'claude-sonnet', tier: 'balanced', isDefault: true, status: 'active', inputPrice: 3, outputPrice: 15, notes: null }];
  }),
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
});
