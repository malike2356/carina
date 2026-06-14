import type { Request, Response } from 'express';
import { getUserProfile } from '../api/hosted-auth.js';
import { getPrimaryOrgForUser } from './org-service.js';
import { assertOrgId } from './scoped-query.js';
import type { OrgRole } from './org-types.js';

export interface OrgContext {
  userId: string;
  orgId: string;
  role: OrgRole;
  email: string;
}

type SessionRequest = Request & {
  session?: {
    hostedAccountId?: string;
    hostedOrgId?: string;
    hostedOrgRole?: OrgRole;
  };
};

export async function resolveOrgSession(req: SessionRequest): Promise<OrgContext | null> {
  const userId = req.session?.hostedAccountId;
  if (!userId) return null;

  let orgId = req.session?.hostedOrgId;
  let role = req.session?.hostedOrgRole;

  if (!orgId || !role) {
    const membership = await getPrimaryOrgForUser(userId);
    if (!membership) return null;
    orgId = membership.orgId;
    role = membership.role;
    req.session!.hostedOrgId = orgId;
    req.session!.hostedOrgRole = role;
  }

  const profile = await getUserProfile(userId);
  if (!profile) return null;

  return {
    userId,
    orgId,
    role,
    email: profile.email,
  };
}

export function getOrgContext(req: Request): OrgContext | null {
  const ctx = (req as Request & { orgContext?: OrgContext }).orgContext;
  return ctx ?? null;
}

export async function requireOrgContext(req: Request, res: Response): Promise<OrgContext | null> {
  const userId = (req as SessionRequest).session?.hostedAccountId;
  if (!userId) {
    res.status(401).json({ error: 'Not signed in' });
    return null;
  }

  const ctx = await resolveOrgSession(req as SessionRequest);
  if (!ctx) {
    res.status(400).json({
      error: 'Organization missing. Run: carina hosted backfill-orgs',
    });
    return null;
  }

  assertOrgId(ctx.orgId);
  (req as Request & { orgContext?: OrgContext }).orgContext = ctx;
  return ctx;
}

export { assertOrgId } from './scoped-query.js';

export function orgContext(req: Request): OrgContext {
  const ctx = getOrgContext(req);
  if (!ctx) {
    throw new Error('Org context missing; use requireOrgContext middleware first');
  }
  return ctx;
}
