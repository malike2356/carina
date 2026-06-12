import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'net';

const mockConfig = {
  hosted: { freeDailyMessages: 100, jwtSecret: 'test', enabled: true, appHost: 'localhost' },
};

vi.mock('../../config/index.js', () => ({
  config: mockConfig,
}));

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async () => ({ rows: [{ messages_today: 12 }] })),
  },
}));

vi.mock('../hosted-auth.js', () => ({
  getUserProfile: vi.fn(async () => ({
    id: 'user-1',
    email: 'a@test.com',
    tier: 'free',
    schemaName: 'tenant_a',
  })),
}));

vi.mock('../../billing/subscription-manager.js', () => ({
  SubscriptionManager: class {
    async getSubscription() {
      return null;
    }
  },
}));

vi.mock('../../billing/usage-meter.js', () => ({
  UsageMeter: class {
    async status() {
      return { tokensUsed: 0, tokensRemaining: 100_000, periodStart: null, periodEnd: null };
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
      (req as express.Request & { session?: { hostedAccountId?: string } }).session = {
        hostedAccountId: 'user-1',
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
      (req as express.Request & { session?: { hostedAccountId?: string } }).session = {
        hostedAccountId: 'user-2',
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
});
