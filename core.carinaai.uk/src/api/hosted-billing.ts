import express, { type Express, type Request, type Response } from 'express';
import { config } from '../config/index.js';
import { pool } from '../memory/db.js';
import { getUserProfile } from './hosted-auth.js';
import {
  BILLING_PLANS,
  normalizePlanId,
  planTier,
  type BillingPlanId,
} from '../billing/plans.js';
import { SubscriptionManager } from '../billing/subscription-manager.js';
import { UsageMeter } from '../billing/usage-meter.js';
import { getMonthlyBalance } from '../billing/credit-ledger.js';
import { getOrgPlan } from '../hosted/plan-gates.js';
import { PLAN_FEATURES, type PlanTier } from '../hosted/plan-features.js';
import { orgOrTenantWhere, queryForOrg, resolveOrgIdFromUser } from '../hosted/scoped-query.js';
import { writeProductAudit } from '../hosted/product-audit.js';

function asPlan(value: unknown, tier: string): BillingPlanId {
  const plan = normalizePlanId(value);
  if (plan !== 'free') return plan;
  return tier === 'pro' ? 'scout_pro' : 'free';
}

export interface OrgUsageQuota {
  allowed: boolean;
  warning: boolean;
  used: number;
  limit: number;
}

export async function getOrgMonthlyTokenUsage(orgId: string, tenantId: string): Promise<number> {
  const result = await queryForOrg<{ total: string }>(
    orgId,
    `SELECT COALESCE(SUM(tokens_used), 0)::TEXT AS total
     FROM usage_records
     WHERE ${orgOrTenantWhere()}
       AND date >= date_trunc('month', CURRENT_DATE)::DATE`,
    [tenantId],
  );
  return Number(result.rows[0]?.total ?? 0);
}

export async function checkOrgUsageQuota(
  orgId: string,
  tenantId: string,
  plan?: PlanTier,
): Promise<OrgUsageQuota> {
  const effectivePlan = plan ?? await getOrgPlan(orgId);
  const billingPlanId: BillingPlanId = effectivePlan === 'free'
    ? 'free'
    : effectivePlan;
  const planMeta = BILLING_PLANS[billingPlanId];

  if (planMeta.includedCredits !== null) {
    const balance = await getMonthlyBalance(orgId, billingPlanId);
    const effectiveLimit = planMeta.includedCredits + balance.topups;
    const used = balance.used;
    const hardCap = planMeta.includedCredits + (planMeta.maxTopupCredits ?? 0);
    const warning = effectiveLimit > 0 && used >= effectiveLimit * 0.8 && used < effectiveLimit;
    return {
      allowed: used < effectiveLimit && used < hardCap,
      warning,
      used,
      limit: effectiveLimit,
    };
  }

  const limit = PLAN_FEATURES[effectivePlan].monthlyTokenLimit;
  const used = await getOrgMonthlyTokenUsage(orgId, tenantId);
  const warning = limit > 0 && used >= limit * 0.8 && used < limit;
  return {
    allowed: limit === 0 ? false : used < limit,
    warning,
    used,
    limit,
  };
}

async function maybeAuditQuotaWarning(orgId: string, tenantId: string, quota: OrgUsageQuota): Promise<void> {
  if (!quota.warning) return;
  const existing = await queryForOrg(
    orgId,
    `SELECT 1 FROM product_audit_log
     WHERE org_id = $1 AND action = 'usage.quota_warning'
       AND created_at >= CURRENT_DATE
     LIMIT 1`,
  );
  if ((existing.rowCount ?? 0) > 0) return;
  await writeProductAudit({
    orgId,
    actorUserId: tenantId,
    action: 'usage.quota_warning',
    details: { used: quota.used, limit: quota.limit },
  });
}

export function mountHostedBillingRoutes(app: Express): void {
  const router = express.Router();
  const usageMeter = new UsageMeter();
  const subscriptions = new SubscriptionManager();

  router.get('/usage', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const orgId = req.session?.hostedOrgId ?? (await resolveOrgIdFromUser(accountId));
    if (!orgId) {
      res.status(400).json({ error: 'Organization missing. Run: carina hosted backfill-orgs' });
      return;
    }

    const requestedOrgId = String(req.query.orgId ?? '').trim();
    if (requestedOrgId && requestedOrgId !== orgId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const profile = await getUserProfile(accountId);
    if (!profile) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }

    const sub = await subscriptions.getSubscriptionForOrg(orgId, accountId);
    const plan = asPlan(sub?.plan, profile.tier);
    const usage = await usageMeter.statusForOrg(orgId, accountId, plan);
    const planMeta = BILLING_PLANS[plan];
    const quota = await checkOrgUsageQuota(orgId, accountId);
    await maybeAuditQuotaWarning(orgId, accountId, quota);

    const daily = await pool.query<{ messages_today: number }>(
      'SELECT messages_today FROM hosted_users WHERE id = $1',
      [accountId],
    );
    const messagesToday = Number(daily.rows[0]?.messages_today ?? 0);

    res.json({
      usage,
      quota,
      orgId,
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            current_period_start: sub.current_period_start,
            current_period_end: sub.current_period_end,
            trial_ends_at: sub.trial_ends_at ?? null,
          }
        : { plan, status: 'active', current_period_start: null, current_period_end: null, trial_ends_at: null },
      tier: profile.tier,
      planName: planMeta.name,
      tokenLimit: planMeta.tokenLimit,
      monthlyPriceGbp: planMeta.monthlyPriceGbp,
      messagesToday,
      freeDailyLimit: planTier(plan) === 'free' ? config.hosted.freeDailyMessages : null,
    });
  });

  app.use('/app/auth/billing', router);
}
