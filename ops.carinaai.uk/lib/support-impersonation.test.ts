import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('./db.js', () => ({
  query: vi.fn(async (sql: string) => {
    if (/FROM organizations/.test(sql)) {
      return { rows: [{ id: 'org-1' }], rowCount: 1 };
    }
    return { rows: [], rowCount: 0 };
  }),
}));

vi.mock('./tenant-audit.js', () => ({
  writeOpsAudit: vi.fn(async () => undefined),
}));

import { writeOpsAudit } from './tenant-audit.js';
import {
  IMPERSONATION_TTL_MS,
  blockWritesDuringImpersonation,
  endImpersonation,
  getActiveImpersonation,
  resolveOrgIdForTenant,
  startImpersonation,
} from './support-impersonation.js';

function mockReq(session: Record<string, unknown> = {}): Request {
  return { session, method: 'POST', path: '/tenant-1/tier', headers: {} } as Request;
}

function mockRes() {
  const res = {
    statusCode: 200,
    body: null as unknown,
    redirectUrl: null as string | null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    redirect(url: string) {
      this.redirectUrl = url;
      return this;
    },
  };
  return res as Response & typeof res;
}

describe('support-impersonation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolveOrgIdForTenant reads organizations.owner_user_id', async () => {
    const orgId = await resolveOrgIdForTenant('tenant-1');
    expect(orgId).toBe('org-1');
  });

  it('startImpersonation stores session and audits', async () => {
    const req = mockReq();
    const session = await startImpersonation(req, 'tenant-1');
    expect(session.tenantId).toBe('tenant-1');
    expect(req.session.impersonation?.orgId).toBe('org-1');
    expect(writeOpsAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tenant.impersonate_start',
    }));
  });

  it('getActiveImpersonation clears expired sessions', () => {
    const req = mockReq({
      impersonation: {
        tenantId: 'tenant-1',
        orgId: 'org-1',
        startedAt: new Date(Date.now() - IMPERSONATION_TTL_MS - 1000).toISOString(),
        actor: 'ops-admin',
      },
    });
    expect(getActiveImpersonation(req)).toBeNull();
    expect(req.session.impersonation).toBeUndefined();
  });

  it('endImpersonation writes tenant.impersonate_end', async () => {
    const req = mockReq({
      impersonation: {
        tenantId: 'tenant-1',
        orgId: 'org-1',
        startedAt: new Date().toISOString(),
        actor: 'ops-admin',
      },
    });
    await endImpersonation(req);
    expect(writeOpsAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'tenant.impersonate_end',
    }));
    expect(req.session.impersonation).toBeUndefined();
  });

  it('blockWritesDuringImpersonation rejects POST writes', () => {
    const req = mockReq({
      impersonation: {
        tenantId: 'tenant-1',
        orgId: 'org-1',
        startedAt: new Date().toISOString(),
        actor: 'ops-admin',
      },
    });
    req.headers = { accept: 'application/json' };
    const res = mockRes();
    const next = vi.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('blockWritesDuringImpersonation allows impersonation end', () => {
    const req = mockReq({
      impersonation: {
        tenantId: 'tenant-1',
        orgId: 'org-1',
        startedAt: new Date().toISOString(),
        actor: 'ops-admin',
      },
    });
    req.path = '/impersonation/end';
    const res = mockRes();
    const next = vi.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
