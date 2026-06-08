import crypto from 'crypto';
import type Stripe from 'stripe';
import { pool } from '../memory/db.js';
import { BILLING_PLANS, type BillingPlanId } from './plans.js';
import { StripeService } from './stripe-service.js';

export interface SubscriptionSnapshot {
  tenant_id: string;
  plan: BillingPlanId;
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  scout_api_key: string | null;
}

function asPlan(value: unknown): BillingPlanId {
  return value === 'scout_standard' || value === 'carina_bundle' || value === 'enterprise' ? value : 'free';
}

function dateFromUnix(value: number | null | undefined): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

export function issueScoutApiKey(): string {
  return `scout_live_${crypto.randomBytes(24).toString('hex')}`;
}

export class SubscriptionManager {
  constructor(private readonly stripeService = new StripeService()) {}

  async getSubscription(tenantId: string): Promise<SubscriptionSnapshot | null> {
    const result = await pool.query<SubscriptionSnapshot>(
      `SELECT tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
              current_period_start, current_period_end, scout_api_key
       FROM subscriptions
       WHERE tenant_id = $1`,
      [tenantId],
    );
    return result.rows[0] ?? null;
  }

  async syncFromCheckoutSession(session: Stripe.Checkout.Session): Promise<SubscriptionSnapshot> {
    const tenantId = session.metadata?.tenantId;
    if (!tenantId) throw new Error('checkout.session.completed missing tenantId metadata');
    const plan = asPlan(session.metadata?.plan);
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
    const stripeSub = subscriptionId ? await this.stripeService.getSubscription(subscriptionId) : null;
    const scoutApiKey = issueScoutApiKey();

    const result = await pool.query<SubscriptionSnapshot>(
      `INSERT INTO subscriptions
        (tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
         current_period_start, current_period_end, scout_api_key, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
       ON CONFLICT (tenant_id)
       DO UPDATE SET
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         scout_api_key = COALESCE(subscriptions.scout_api_key, EXCLUDED.scout_api_key),
         updated_at = NOW()
       RETURNING tenant_id, plan, status, stripe_customer_id, stripe_subscription_id,
                 current_period_start, current_period_end, scout_api_key`,
      [
        tenantId,
        plan,
        stripeSub?.status ?? 'active',
        customerId ?? null,
        subscriptionId ?? null,
        dateFromUnix(stripeSub?.items.data[0]?.current_period_start ?? null),
        dateFromUnix(stripeSub?.items.data[0]?.current_period_end ?? null),
        scoutApiKey,
      ],
    );
    await pool.query('UPDATE hosted_users SET tier = $1, stripe_customer_id = $2 WHERE id = $3', ['pro', customerId ?? null, tenantId]);
    return result.rows[0] as SubscriptionSnapshot;
  }

  async syncStripeSubscription(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId;
    if (!tenantId) return;
    const plan = asPlan(subscription.metadata?.plan);
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
