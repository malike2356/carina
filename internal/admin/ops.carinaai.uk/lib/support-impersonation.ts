import type { NextFunction, Request, Response } from 'express';
import { query } from './db.js';
import { writeOpsAudit } from './tenant-audit.js';

export const IMPERSONATION_TTL_MS = 15 * 60 * 1000;

export interface ImpersonationSession {
  tenantId: string;
  orgId: string | null;
  startedAt: string;
  actor: string;
}

export async function resolveOrgIdForTenant(tenantId: string): Promise<string | null> {
  const ownerResult = await query<{ id: string }>(
    `SELECT id FROM organizations WHERE owner_user_id = $1 LIMIT 1`,
    [tenantId],
  );
  if (ownerResult.rows[0]?.id) {
    return String(ownerResult.rows[0].id);
  }

  const memberResult = await query<{ org_id: string }>(
    `SELECT org_id FROM org_memberships WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1`,
    [tenantId],
  );
  if (memberResult.rows[0]?.org_id) {
    return String(memberResult.rows[0].org_id);
  }

  const subResult = await query<{ org_id: string }>(
    `SELECT org_id FROM subscriptions WHERE tenant_id = $1 LIMIT 1`,
    [tenantId],
  );
  if (subResult.rows[0]?.org_id) {
    return String(subResult.rows[0].org_id);
  }

  return null;
}

export function getActiveImpersonation(req: Request): ImpersonationSession | null {
  const raw = req.session?.impersonation;
  if (!raw) return null;
  const startedAt = new Date(raw.startedAt);
  if (Number.isNaN(startedAt.getTime())) {
    delete req.session.impersonation;
    return null;
  }
  if (Date.now() - startedAt.getTime() > IMPERSONATION_TTL_MS) {
    delete req.session.impersonation;
    return null;
  }
  return raw;
}

export async function startImpersonation(req: Request, tenantId: string): Promise<ImpersonationSession> {
  const orgId = await resolveOrgIdForTenant(tenantId);
  const session: ImpersonationSession = {
    tenantId,
    orgId,
    startedAt: new Date().toISOString(),
    actor: 'ops-admin',
  };
  req.session.impersonation = session;
  await writeOpsAudit({
    tenantId,
    orgId: orgId ?? undefined,
    action: 'tenant.impersonate_start',
    details: { readOnly: true },
  });
  return session;
}

export async function endImpersonation(req: Request): Promise<void> {
  const active = getActiveImpersonation(req);
  if (!active) return;
  await writeOpsAudit({
    tenantId: active.tenantId,
    orgId: active.orgId ?? undefined,
    action: 'tenant.impersonate_end',
    details: { readOnly: true },
  });
  delete req.session.impersonation;
}

export function blockWritesDuringImpersonation(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (req.method !== 'POST') {
    next();
    return;
  }

  const path = req.path.replace(/\/+$/, '') || '/';
  if (path === '/impersonation/end') {
    next();
    return;
  }
  if (/^\/[^/]+\/impersonate$/.test(path) && !getActiveImpersonation(req)) {
    next();
    return;
  }

  const active = getActiveImpersonation(req);
  if (!active) {
    next();
    return;
  }

  const wantsJson = req.headers.accept?.includes('application/json');
  if (wantsJson) {
    res.status(403).json({ error: 'Impersonation is read-only' });
    return;
  }
  res.redirect(`/tenants/${active.tenantId}?err=${encodeURIComponent('Impersonation is read-only')}`);
}
