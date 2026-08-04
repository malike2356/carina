import crypto from 'crypto';
import type Stripe from 'stripe';
import { pool } from '../memory/db.js';
import {
  BILLING_PLANS,
  isCarinaOpsPlan,
  isScoutPlan,
  normalizePlanId,
  planFromStripePriceIdAsync,
  planTier,
  type BillingPlanId,
} from './plans.js';
import { refreshBillingConfigCache } from './billing-config.js';
import { StripeService } from './stripe-service.js';
import { provisionScoutTenant, syncScoutTenantPlan } from './scout-provisioning.js';
import { sendScoutWelcomeEmail } from './scout-welcome-email.js';
import { resolveOrgIdFromUser } from '../hosted/scoped-query.js';
import { normalizePlanId as normalizeOrgPlanId, type PlanTier } from '../hosted/plan-features.js';
import { writeProductAudit } from '../hosted/product-audit.js';

export interface SubscriptionSnapshot {
  tenant_id: string;
  plan: BillingPlanId;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  scout_api_key: string | null;
  trial_ends_at?: Date | null;
}

function billingPlan(value: unknown): BillingPlanId {
  return normalizePlanId(value);
}

function toOrgPlanTier(plan: BillingPlanId): PlanTier {
  if (plan === 'carina_ops_starter' || plan === 'carina_ops_team') return plan;
  return 'free';
}

function dateFromUnix(value: number | null | undefined): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

async function resolvePlanFromSubscription(subscription: Stripe.Subscription): Promise<BillingPlanId> {
  await refreshBillingConfigCache();
  const metaPlan = billingPlan(subscription.metadata?.plan);
  if (metaPlan !== 'free') return metaPlan;
  const priceId = subscription.items.data[0]?.price?.id;
  if (priceId) {
    const mapped = await planFromStripePriceIdAsync(priceId);
    if (mapped) return mapped;
  }
  return 'free';
}

export function issueScoutApiKey(): string {
  return `scout_live_${crypto.randomBytes(24).toString('hex')}`;
}

export class SubscriptionManager {
  constructor(private readonly stripeService = new StripeService()) {}

  async getSubscription(tenantId: string): Promise<SubscriptionSnapshot | null> {
    const result = await pool.query<SubscriptionSnapshot>(
      `SELECT tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
              current_period_start, current_period_end, scout_api_key, trial_ends_at
       FROM subscriptions
       WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async getSubscriptionForOrg(orgId: string, tenantId: string): Promise<SubscriptionSnapshot | null> {
    const result = await pool.query<SubscriptionSnapshot>(
      `SELECT tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
              current_period_start, current_period_end, scout_api_key, trial_ends_at
       FROM subscriptions
       WHERE org_id = $1 OR (org_id IS NULL AND tenant_id = $2)
       ORDER BY CASE WHEN org_id = $1 THEN 0 ELSE 1 END
       LIMIT 1`,
      [orgId, tenantId],
    );
    return result.rows[0] ?? null;
  }

  async syncOrgPlan(
    orgId: string,
    plan: BillingPlanId,
    opts?: { clearTrial?: boolean; auditFrom?: PlanTier; actorUserId?: string },
  ): Promise<void> {
    const orgPlan = toOrgPlanTier(plan);
    await pool.query(
      `UPDATE organizations SET plan = $2, updated_at = NOW() WHERE id = $1`,
      [orgId, orgPlan],
    );
    if (opts?.clearTrial) {
      await pool.query(
        `UPDATE subscriptions SET trial_ends_at = NULL, updated_at = NOW()
         WHERE org_id = $1`,
        [orgId],
      );
    }
    if (opts?.auditFrom && opts.auditFrom !== orgPlan) {
      await writeProductAudit({
        orgId,
        actorUserId: opts.actorUserId,
        action: 'billing.plan_changed',
        resourceType: 'subscription',
        details: { from: opts.auditFrom, to: orgPlan, source: 'stripe' },
      });
    }
  }

  async downgradeOrgToFree(orgId: string, tenantId: string, actorUserId?: string): Promise<void> {
    const orgRow = await pool.query<{ plan: string }>(
      'SELECT plan FROM organizations WHERE id = $1',
      [orgId],
    );
    const previous = normalizeOrgPlanId(String(orgRow.rows[0]?.plan ?? 'free'));
    await pool.query(
      `UPDATE subscriptions
       SET plan = 'free', status = 'canceled', updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId],
    );
    await this.syncOrgPlan(orgId, 'free', { auditFrom: previous, actorUserId });
  }

  private async maybeProvisionScout(
    tenantId: string,
    plan: BillingPlanId,
    snapshot: SubscriptionSnapshot,
    email: string,
  ): Promise<void> {
    if (!isScoutPlan(plan) || !snapshot.scout_api_key) return;
    void provisionScoutTenant({
      email,
      tenantId,
      licenseKey: snapshot.scout_api_key,
      plan,
    }).then((provisioned) => {
      if (!provisioned?.setupToken) return;
      const scoutConsoleUrl =
        (process.env.SCOUT_CONSOLE_PUBLIC_URL || process.env.LABYRINTH_URL || 'https://console.labyrinthscout.com')
          .replace(/\/+$/, '');
      return sendScoutWelcomeEmail({
        email,
        setupToken: provisioned.setupToken,
        scoutConsoleUrl,
      });
    }).catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[carina:scout-welcome] failed:', msg);
    });
  }

  async syncFromCheckoutSession(session: Stripe.Checkout.Session): Promise<SubscriptionSnapshot> {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) throw new Error('checkout.session.completed missing tenantId metadata');
    const plan = billingPlan(session.metadata?.plan);
    const orgId = session.metadata?.orgId || (await resolveOrgIdFromUser(tenantId));
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const stripeSub = subscriptionId ? await this.stripeService.getSubscription(subscriptionId) : null;
    const resolvedPlan = stripeSub ? await resolvePlanFromSubscription(stripeSub) : plan;
    const scoutApiKey = isScoutPlan(resolvedPlan) ? issueScoutApiKey() : null;

    const result = await pool.query<SubscriptionSnapshot>(
      `INSERT INTO subscriptions
        (tenant_id, org_id, plan, status, stripe_customer_id, stripe_subscription_id,
         current_period_start, current_period_end, scout_api_key, trial_ends_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NOW(), NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         org_id = COALESCE(EXCLUDED.org_id, subscriptions.org_id),
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         scout_api_key = COALESCE(subscriptions.scout_api_key, EXCLUDED.scout_api_key),
         trial_ends_at = NULL,
         updated_at = NOW()
       RETURNING tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
                 current_period_start, current_period_end, scout_api_key, trial_ends_at`,
      [
        tenantId,
        orgId,
        resolvedPlan,
        stripeSub?.status ?? 'active',
        customerId ?? null,
        subscriptionId ?? null,
        dateFromUnix(stripeSub?.items.data[0]?.current_period_start ?? null),
        dateFromUnix(stripeSub?.items.data[0]?.current_period_end ?? null),
        scoutApiKey,
      ],
    );

    await pool.query(
      'UPDATE hosted_users SET tier = $1, stripe_customer_id = $2 WHERE id = $3',
      [planTier(resolvedPlan), customerId ?? null, tenantId],
    );

    if (orgId && isCarinaOpsPlan(resolvedPlan)) {
      const orgRow = await pool.query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [orgId],
      );
      const previous = normalizeOrgPlanId(String(orgRow.rows[0]?.plan ?? 'free'));
      await this.syncOrgPlan(orgId, resolvedPlan, {
        clearTrial: true,
        auditFrom: previous,
        actorUserId: tenantId,
      });
    }

    const userRow = await pool.query<{ email: string }>(
      'SELECT email FROM hosted_users WHERE id = $1',
      [tenantId],
    );
    const email = userRow.rows[0]?.email;
    const snapshot = result.rows[0] as SubscriptionSnapshot;
    if (email) {
      await this.maybeProvisionScout(tenantId, resolvedPlan, snapshot, email);
    }
    return snapshot;
  }

  async syncStripeSubscription(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;
    const plan = await resolvePlanFromSubscription(subscription);
    const orgId = subscription.metadata?.orgId || (await resolveOrgIdFromUser(tenantId));

    if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
      if (orgId && isCarinaOpsPlan(plan)) {
        await this.downgradeOrgToFree(orgId, tenantId);
      }
      await pool.query(
        `UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE tenant_id = $2`,
        [subscription.status, tenantId],
      );
      return;
    }

    await pool.query(
      `UPDATE subscriptions
       SET plan = $1,
           status = $2,
           current_period_start = $3,
           current_period_end = $4,
           updated_at = NOW()
       WHERE tenant_id = $5`,
      [
        plan,
        subscription.status,
        dateFromUnix(subscription.items.data[0]?.current_period_start ?? null),
        dateFromUnix(subscription.items.data[0]?.current_period_end ?? null),
        tenantId,
      ],
    );

    if (orgId && isCarinaOpsPlan(plan)) {
      const orgRow = await pool.query<{ plan: string }>(
        'SELECT plan FROM organizations WHERE id = $1',
        [orgId],
      );
      const previous = normalizeOrgPlanId(String(orgRow.rows[0]?.plan ?? 'free'));
      await this.syncOrgPlan(orgId, plan, { clearTrial: true, auditFrom: previous, actorUserId: tenantId });
    }

    await pool.query(
      'UPDATE hosted_users SET tier = $1 WHERE id = $2',
      [planTier(plan), tenantId],
    );
    if (isScoutPlan(plan)) {
      void syncScoutTenantPlan({ tenantId, plan }).catch(() => undefined);
    }
  }

  async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) {
      await pool.query(
        'UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
        ['canceled', subscription.id],
      );
      return;
    }
    const orgId = subscription.metadata?.orgId || (await resolveOrgIdFromUser(tenantId));
    const plan = await resolvePlanFromSubscription(subscription);
    await pool.query(
      `UPDATE subscriptions
       SET status = 'canceled', updated_at = NOW()
       WHERE tenant_id = $1`,
      [tenantId],
    );
    if (orgId && isCarinaOpsPlan(plan)) {
      await this.downgradeOrgToFree(orgId, tenantId);
    }
    await pool.query(
      'UPDATE hosted_users SET tier = $1 WHERE id = $2',
      ['free', tenantId],
    );
  }

  async cancel(tenantId: string): Promise<SubscriptionSnapshot | null> {
    const subscription = await this.getSubscription(tenantId);
    if (!subscription?.stripe_subscription_id) return subscription;
    await this.stripeService.cancelSubscription(subscription.stripe_subscription_id);
    await pool.query('UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE tenant_id = $2', ['canceled', tenantId]);
    return this.getSubscription(tenantId);
  }

  async reactivate(tenantId: string): Promise<SubscriptionSnapshot | null> {
    const subscription = await this.getSubscription(tenantId);
    if (!subscription?.stripe_subscription_id) return subscription;
    await this.stripeService.reactivateSubscription(subscription.stripe_subscription_id);
    await pool.query('UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE tenant_id = $2', ['active', tenantId]);
    return this.getSubscription(tenantId);
  }

  getPlan(plan: BillingPlanId) {
    return BILLING_PLANS[plan];
  }
}
