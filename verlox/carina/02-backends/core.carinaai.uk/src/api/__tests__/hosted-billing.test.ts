import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';

const mockConfig = {
  hosted: { freeDailyMessages: 100, jwtSecret: 'test', enabled: true, appHost: 'localhost' },
};

vi.mock('../../config/index.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../config/index.js')>();
  return {
    ...original,
    config: {
      ...original.config,
      hosted: {
        ...original.config.hosted,
        ...mockConfig.hosted,
      },
    },
  };
});

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [{ messages_today: 12 }] })),
  },
}));

vi.mock('../../hosted/scoped-query.js', () => ({
  resolveOrgIdFromUser: vi.fn(async (userId: string) => {
    if (userId === 'user-a') return 'org-a';
    if (userId === 'user-b') return 'org-b';
    return null;
  }),
  orgOrTenantWhere: vi.fn(() => '(org_id = $1 OR (org_id IS NULL AND tenant_id = $2))'),
  queryForOrg: vi.fn(async (orgId: string, _sql: string, params: unknown[] = []) => ({
    rows: [{ total: orgId === 'org-a' ? '1000' : '9000' }],
    rowCount: 1,
  })),
}));

vi.mock('../hosted-auth.js', () => ({
  getUserProfile: vi.fn(async (userId: string) => ({
    id: userId,
    email: `${userId}@test.com`,
    tier: 'free',
    schemaName: `tenant_${userId}`,
  })),
}));

vi.mock('../../billing/subscription-manager.js', () => ({
  SubscriptionManager: class {
    async getSubscriptionForOrg(_orgId: string, tenantId: string) {
      return tenantId === 'user-b'
        ? { plan: 'scout_pro', status: 'active', current_period_start: null, current_period_end: null }
        : null;
    }
  },
}));

vi.mock('../../billing/usage-meter.js', () => ({
  UsageMeter: class {
    async statusForOrg(orgId: string) {
      return {
        tokensUsed: orgId === 'org-a' ? 1000 : 9000,
        limit: 100_000,
      };
    }
  },
}));

async function withServer(app: express.Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0);
  try {
    const address = server.address() as AddressInfo;
    await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe('hosted billing /usage', () => {
  beforeEach(() => {
    mockConfig.hosted.freeDailyMessages = 100;
  });

  it('returns freeDailyLimit from config.hosted.freeDailyMessages for free tier', async () => {
    const { mountHostedBillingRoutes } = await import('../hosted-billing.js');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { session?: { hostedAccountId?: string; hostedOrgId?: string } }).session = {
        hostedAccountId: 'user-1',
        hostedOrgId: 'org-a',
      };
      next();
    });
    mountHostedBillingRoutes(app);

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/app/auth/billing/usage`);
      expect(res.status).toBe(200);
      const body = await res.json() as { freeDailyLimit: number; messagesToday: number };
      expect(body.freeDailyLimit).toBe(100);
      expect(body.messagesToday).toBe(12);
    });
  });

  it('returns null freeDailyLimit for paid plans', async () => {
    const { getUserProfile } = await import('../hosted-auth.js');
    vi.mocked(getUserProfile).mockResolvedValueOnce({
      id: 'user-2',
      email: 'pro@test.com',
      tier: 'pro',
      schemaName: 'tenant_b',
    });

    const { mountHostedBillingRoutes } = await import('../hosted-billing.js');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { session?: { hostedAccountId?: string; hostedOrgId?: string } }).session = {
        hostedAccountId: 'user-2',
        hostedOrgId: 'org-b',
      };
      next();
    });
    mountHostedBillingRoutes(app);

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/app/auth/billing/usage`);
      expect(res.status).toBe(200);
      const body = await res.json() as { freeDailyLimit: number | null };
      expect(body.freeDailyLimit).toBeNull();
    });
  });

  it('org A cannot read org B usage via orgId query bypass', async () => {
    const { mountHostedBillingRoutes } = await import('../hosted-billing.js');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { session?: { hostedAccountId?: string; hostedOrgId?: string } }).session = {
        hostedAccountId: 'user-a',
        hostedOrgId: 'org-a',
      };
      next();
    });
    mountHostedBillingRoutes(app);

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/app/auth/billing/usage?orgId=org-b`);
      expect(res.status).toBe(403);
    });
  });

  it('returns org-scoped usage totals for signed-in org', async () => {
    const { mountHostedBillingRoutes } = await import('../hosted-billing.js');
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as express.Request & { session?: { hostedAccountId?: string; hostedOrgId?: string } }).session = {
        hostedAccountId: 'user-a',
        hostedOrgId: 'org-a',
      };
      next();
    });
    mountHostedBillingRoutes(app);

    await withServer(app, async (baseUrl) => {
      const res = await fetch(`${baseUrl}/app/auth/billing/usage`);
      expect(res.status).toBe(200);
      const body = await res.json() as { orgId: string; usage: { tokensUsed: number } };
      expect(body.orgId).toBe('org-a');
      expect(body.usage.tokensUsed).toBe(1000);
    });
  });
});
