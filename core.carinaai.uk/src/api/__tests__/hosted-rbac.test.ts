/**
 * Role matrix (v1):
 * owner: full access including billing.write
 * admin: settings, invites, vault write; no billing.write
 * operator: workbench.run, usage/audit read
 * auditor: usage/audit/billing read; no vault.write
 * viewer: read-only usage/audit/deployments
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { canPerform } from '../../hosted/rbac.js';
import type { OrgRole } from '../../hosted/org-types.js';

vi.mock('../../config/index.js', () => ({
  config: {
    hosted: { enabled: true, appHost: 'app.test', jwtSecret: 'secret', freeDailyMessages: 100 },
    resend: { apiKey: '', from: 'test@example.com' },
    database: { url: 'postgresql://localhost/test' },
    product: {
      domain: 'carinaai.uk',
      appUrl: 'https://app.carinaai.uk',
      coreUrl: 'https://core.carinaai.uk',
      marketingUrl: 'https://carinaai.uk',
      opsUrl: 'https://ops.carinaai.uk',
    },
  },
}));

vi.mock('../../memory/db.js', () => ({
  pool: { query: vi.fn(async () => ({ rows: [], rowCount: 0 })) },
}));

vi.mock('../../api/hosted-auth.js', () => ({
  getUserProfile: vi.fn(async (userId: string) => ({
    email: `${userId}@example.com`,
    apiKey: 'key',
    tier: 'free',
  })),
}));

vi.mock('../../hosted/org-invites.js', () => ({
  createInvite: vi.fn(async () => ({ inviteId: 'inv-1', token: 'token' })),
  listPendingInvites: vi.fn(async () => []),
  revokeInvite: vi.fn(async () => undefined),
  acceptInvite: vi.fn(async () => ({ orgId: 'org-1', role: 'operator' as OrgRole })),
}));

vi.mock('../../hosted/org-context.js', () => ({
  requireOrgContext: vi.fn(async (req: Request, res: Response) => {
    const userId = req.session?.hostedAccountId;
    const orgId = req.session?.hostedOrgId;
    const role = req.session?.hostedOrgRole;
    if (!userId || !orgId || !role) {
      res.status(401).json({ error: 'Not signed in' });
      return null;
    }
    if (req.headers['x-test-org-mismatch'] === 'true') {
      res.status(403).json({ error: 'Forbidden' });
      return null;
    }
    const ctx = {
      userId,
      orgId,
      role: role as OrgRole,
      email: `${userId}@example.com`,
    };
    req.orgContext = ctx;
    return ctx;
  }),
}));

import { requireOrgMember } from '../../gateway/web-auth.js';
import { createInvite } from '../../hosted/org-invites.js';

function mockReq(role?: OrgRole, extras?: Partial<Request>): Request {
  return {
    session: role
      ? { hostedAccountId: `${role}-user`, hostedOrgId: 'org-1', hostedOrgRole: role }
      : {},
    body: {},
    headers: {},
    ...extras,
  } as Request;
}

function mockRes() {
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
  };
  return res as Response & { statusCode: number; body: unknown };
}

async function runMiddleware(
  action: Parameters<typeof requireOrgMember>[0],
  req: Request,
): Promise<{ statusCode: number; body: unknown; nextCalled: boolean }> {
  const res = mockRes();
  let nextCalled = false;
  const middleware = requireOrgMember(action);
  await middleware(req, res, (() => {
    nextCalled = true;
  }) as NextFunction);
  return { statusCode: res.statusCode, body: res.body, nextCalled };
}

describe('hosted RBAC integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('owner can POST invites via org.members.invite', async () => {
    const req = mockReq('owner');
    req.body = { email: 'new@example.com', role: 'operator' };
    const result = await runMiddleware('org.members.invite', req);
    expect(result.nextCalled).toBe(true);
  });

  it('viewer cannot POST invites', async () => {
    const result = await runMiddleware('org.members.invite', mockReq('viewer'));
    expect(result.statusCode).toBe(403);
  });

  it('admin can invite users', async () => {
    const result = await runMiddleware('org.members.invite', mockReq('admin'));
    expect(result.nextCalled).toBe(true);
  });

  it('operator cannot invite users', async () => {
    const result = await runMiddleware('org.members.invite', mockReq('operator'));
    expect(result.statusCode).toBe(403);
  });

  it('owner can access billing.write', async () => {
    const result = await runMiddleware('billing.write', mockReq('owner'));
    expect(result.nextCalled).toBe(true);
  });

  it('admin cannot access billing.write', async () => {
    const result = await runMiddleware('billing.write', mockReq('admin'));
    expect(result.statusCode).toBe(403);
  });

  it('operator can access workbench.run', async () => {
    const result = await runMiddleware('workbench.run', mockReq('operator'));
    expect(result.nextCalled).toBe(true);
  });

  it('viewer cannot access workbench.run', async () => {
    const result = await runMiddleware('workbench.run', mockReq('viewer'));
    expect(result.statusCode).toBe(403);
  });

  it('auditor can read usage', async () => {
    const result = await runMiddleware('usage.read', mockReq('auditor'));
    expect(result.nextCalled).toBe(true);
  });

  it('auditor cannot write vault', async () => {
    const result = await runMiddleware('vault.write', mockReq('auditor'));
    expect(result.statusCode).toBe(403);
  });

  it('unauthenticated requests return 401', async () => {
    const result = await runMiddleware('org.members.invite', mockReq());
    expect(result.statusCode).toBe(401);
  });

  it('wrong org context returns 403', async () => {
    const req = mockReq('owner', { headers: { 'x-test-org-mismatch': 'true' } });
    const result = await runMiddleware('org.members.invite', req);
    expect(result.statusCode).toBe(403);
  });

  it('canPerform aligns with middleware outcomes', () => {
    expect(canPerform('owner', 'billing.write')).toBe(true);
    expect(canPerform('admin', 'billing.write')).toBe(false);
    expect(createInvite).toBeDefined();
  });
});
