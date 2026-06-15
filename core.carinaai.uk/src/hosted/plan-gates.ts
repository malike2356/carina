import type { NextFunction, Request, Response } from 'express';
import { pool } from '../memory/db.js';
import { isHostedRequest } from '../gateway/hosted-domain.js';
import { requireOrgContext } from './org-context.js';
import { writeProductAudit } from './product-audit.js';
import {
  normalizePlanId,
  PLAN_FEATURES,
  type PlanFeatureLimits,
  type PlanTier,
} from './plan-features.js';

const PLAN_ORDER: PlanTier[] = ['free', 'carina_ops_starter', 'carina_ops_team'];

export function planRank(plan: PlanTier): number {
  return PLAN_ORDER.indexOf(plan);
}

export function meetsMinPlan(current: PlanTier, minPlan: PlanTier): boolean {
  return planRank(current) >= planRank(minPlan);
}

export async function getOrgPlan(orgId: string): Promise<PlanTier> {
  const result = await pool.query<{ plan: string; trial_ends_at: Date | null }>(
    `SELECT o.plan, s.trial_ends_at
     FROM organizations o
     LEFT JOIN subscriptions s ON s.org_id = o.id
     WHERE o.id = $1
     LIMIT 1`,
    [orgId],
  );
  if ((result.rowCount ?? 0) === 0) return 'free';
  const row = result.rows[0];
  if (row.trial_ends_at && new Date(row.trial_ends_at) > new Date()) {
    return 'carina_ops_team';
  }
  return normalizePlanId(String(row.plan));
}

async function maybeAuditTrialExpired(orgId: string): Promise<void> {
  const result = await pool.query<{ trial_ends_at: Date | null; plan: string }>(
    `SELECT s.trial_ends_at, o.plan
     FROM organizations o
     LEFT JOIN subscriptions s ON s.org_id = o.id
     WHERE o.id = $1
     LIMIT 1`,
    [orgId],
  );
  const row = result.rows[0];
  if (!row?.trial_ends_at) return;
  if (new Date(row.trial_ends_at) > new Date()) return;
  if (normalizePlanId(String(row.plan)) !== 'free') return;

  const existing = await pool.query(
    `SELECT 1 FROM product_audit_log
     WHERE org_id = $1 AND action = 'billing.trial_expired'
     LIMIT 1`,
    [orgId],
  );
  if ((existing.rowCount ?? 0) > 0) return;

  await writeProductAudit({
    orgId,
    action: 'billing.trial_expired',
    details: { trialEndsAt: new Date(row.trial_ends_at).toISOString() },
  });
}

export function hasOpsConsole(plan: PlanTier): boolean {
  return PLAN_FEATURES[plan].opsConsole;
}

export function checkFeature(plan: PlanTier, feature: keyof PlanFeatureLimits): boolean {
  const value = PLAN_FEATURES[plan][feature];
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return Boolean(value);
}

export function requireOpsPlan(minPlan: PlanTier) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ctx = await requireOrgContext(req, res);
    if (!ctx) return;
    req.orgContext = ctx;
    const plan = await getOrgPlan(ctx.orgId);
    (req as Request & { orgPlan?: PlanTier }).orgPlan = plan;
    if (!meetsMinPlan(plan, minPlan)) {
      await maybeAuditTrialExpired(ctx.orgId);
      res.status(402).json({
        error: 'upgrade_required',
        plan: minPlan,
        upgradeUrl: '/ops/billing',
      });
      return;
    }
    next();
  };
}

export function requireFeature(feature: keyof PlanFeatureLimits) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.orgContext) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }
    const plan = (req as Request & { orgPlan?: PlanTier }).orgPlan ?? await getOrgPlan(req.orgContext.orgId);
    if (!checkFeature(plan, feature)) {
      res.status(402).json({
        error: 'upgrade_required',
        feature,
        upgradeUrl: '/ops/billing',
      });
      return;
    }
    next();
  };
}

export async function requireOpsPlanGate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isHostedRequest(req.hostname)) {
    res.status(404).send('Not found');
    return;
  }

  const ctx = await requireOrgContext(req, res);
  if (!ctx) return;
  req.orgContext = ctx;
  const plan = await getOrgPlan(ctx.orgId);
  (req as Request & { orgPlan?: PlanTier }).orgPlan = plan;

  const page = String(req.params.page ?? '').trim();
  const path = req.path.replace(/\/+$/, '') || '/';
  const isBilling = page === 'billing' || path === '/ops/billing';
  const isUpgrade = page === 'upgrade' || path === '/ops/upgrade';
  const isOnboarding = page === 'onboarding' || path === '/ops/onboarding';

  if (!hasOpsConsole(plan) && !isBilling && !isUpgrade && !isOnboarding) {
    res.redirect('/ops/upgrade');
    return;
  }
  next();
}

export const OPS_PAGE_FILES: Record<string, string> = {
  workbench: 'workbench.html',
  files: 'files.html',
  skills: 'skills.html',
  batches: 'batches.html',
  agents: 'agents.html',
  sessions: 'sessions.html',
  deployments: 'deployments.html',
  environments: 'environments.html',
  vault: 'vault.html',
  memory: 'memory.html',
  analytics: 'analytics.html',
  credits: 'credits.html',
  usage: 'usage.html',
  audit: 'audit.html',
  settings: 'settings.html',
  billing: 'billing.html',
  upgrade: 'upgrade.html',
  onboarding: 'onboarding.html',
};
