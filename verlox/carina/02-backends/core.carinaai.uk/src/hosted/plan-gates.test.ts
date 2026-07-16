import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import {
  checkFeature,
  getOrgPlan,
  hasOpsConsole,
  meetsMinPlan,
  requireOpsPlan,
} from './plan-gates.js';

vi.mock('../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (_sql: string, params?: unknown[]) => {
      const orgId = params?.[0];
      if (orgId === 'org-starter') {
        return { rows: [{ plan: 'carina_ops_starter', trial_ends_at: null }], rowCount: 1 };
      }
      if (orgId === 'org-team-trial') {
        return {
          rows: [{ plan: 'free', trial_ends_at: new Date(Date.now() + 86400000) }],
          rowCount: 1,
        };
      }
      if (orgId === 'org-trial-expired') {
        return {
          rows: [{ plan: 'free', trial_ends_at: new Date(Date.now() - 86400000) }],
          rowCount: 1,
        };
      }
      return { rows: [{ plan: 'free', trial_ends_at: null }], rowCount: 1 };
    }),
  },
}));

vi.mock('./org-context.js', () => ({
  requireOrgContext: vi.fn(async (req: Request, res: Response) => {
    if (!req.session?.hostedAccountId) {
      res.status(401).json({ error: 'Not signed in' });
      return null;
    }
    const ctx = {
      userId: req.session.hostedAccountId,
      orgId: req.session.hostedOrgId ?? 'org-free',
      role: req.session.hostedOrgRole ?? 'owner',
      email: 'user@test.com',
    };
    req.orgContext = ctx;
    return ctx;
  }),
}));

describe('plan-gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('meetsMinPlan orders free < starter < team', () => {
    expect(meetsMinPlan('free', 'carina_ops_starter')).toBe(false);
    expect(meetsMinPlan('carina_ops_starter', 'carina_ops_starter')).toBe(true);
    expect(meetsMinPlan('carina_ops_team', 'carina_ops_starter')).toBe(true);
  });

  it('hasOpsConsole is false for free', () => {
    expect(hasOpsConsole('free')).toBe(false);
    expect(hasOpsConsole('carina_ops_starter')).toBe(true);
  });

  it('checkFeature blocks deployments on starter', () => {
    expect(checkFeature('carina_ops_starter', 'deployments')).toBe(false);
    expect(checkFeature('carina_ops_team', 'deployments')).toBe(true);
  });

  it('getOrgPlan treats active trial as team', async () => {
    await expect(getOrgPlan('org-team-trial')).resolves.toBe('carina_ops_team');
    await expect(getOrgPlan('org-starter')).resolves.toBe('carina_ops_starter');
  });

  it('getOrgPlan returns free after trial expires', async () => {
    await expect(getOrgPlan('org-trial-expired')).resolves.toBe('free');
  });

  it('requireOpsPlan returns 402 for free tier', async () => {
    const middleware = requireOpsPlan('carina_ops_starter');
    const req = {
      session: { hostedAccountId: 'user-1', hostedOrgId: 'org-free', hostedOrgRole: 'owner' },
    } as Request;
    const res = {
      statusCode: 200,
      body: undefined as unknown,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: unknown) {
        this.body = payload;
        return this;
      },
    } as Response & { statusCode: number; body: unknown };
    let nextCalled = false;
    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(402);
    expect(res.body).toMatchObject({ error: 'upgrade_required', plan: 'carina_ops_starter' });
  });

  it('requireOpsPlan passes starter tier', async () => {
    const middleware = requireOpsPlan('carina_ops_starter');
    const req = {
      session: { hostedAccountId: 'user-2', hostedOrgId: 'org-starter', hostedOrgRole: 'owner' },
    } as Request;
    const res = {
      status: () => ({ json: () => undefined }),
      json: () => undefined,
    } as unknown as Response;
    let nextCalled = false;
    await middleware(req, res, (() => {
      nextCalled = true;
    }) as NextFunction);
    expect(nextCalled).toBe(true);
  });
});
