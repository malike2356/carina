import { describe, expect, it, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

const poolQueries: Array<{ sql: string; params?: unknown[] }> = [];

vi.mock('../../memory/db.js', () => ({
  pool: {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      poolQueries.push({ sql, params });
      if (/SELECT id FROM stripe_events/.test(sql)) {
        return { rows: [], rowCount: 0 };
      }
      if (/INSERT INTO stripe_events/.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/SELECT plan FROM organizations/.test(sql)) {
        return { rows: [{ plan: 'free' }], rowCount: 1 };
      }
      if (/UPDATE organizations SET plan/.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      if (/UPDATE subscriptions/.test(sql) || /INSERT INTO subscriptions/.test(sql)) {
        return {
          rows: [{
            tenant_id: params?.[0] ?? 'tenant-1',
            plan: params?.[2] ?? 'carina_ops_starter',
            status: 'active',
            stripe_customer_id: 'cus_1',
            stripe_subscription_id: 'sub_1',
            current_period_start: new Date(),
            current_period_end: new Date(),
            scout_api_key: null,
            trial_ends_at: null,
          }],
          rowCount: 1,
        };
      }
      if (/SELECT email FROM hosted_users/.test(sql)) {
        return { rows: [{ email: 'owner@test.com' }], rowCount: 1 };
      }
      if (/UPDATE hosted_users SET tier/.test(sql)) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }),
  },
}));

const syncFromCheckoutSession = vi.fn(async () => ({
  tenant_id: 'tenant-1',
  plan: 'carina_ops_starter',
  status: 'active',
  stripe_customer_id: 'cus_1',
  stripe_subscription_id: 'sub_1',
  current_period_start: new Date(),
  current_period_end: new Date(),
  scout_api_key: null,
}));

const handleSubscriptionDeleted = vi.fn(async () => undefined);

vi.mock('../subscription-manager.js', () => ({
  SubscriptionManager: class {
    syncFromCheckoutSession = syncFromCheckoutSession;
    handleSubscriptionDeleted = handleSubscriptionDeleted;
    syncStripeSubscription = vi.fn(async () => undefined);
  },
}));

vi.mock('../invoice-generator.js', () => ({
  InvoiceGenerator: class {
    recordStripeInvoice = vi.fn(async () => undefined);
  },
}));

vi.mock('../stripe-service.js', () => ({
  StripeService: class {
    handleWebhook = vi.fn();
  },
}));

import { StripeWebhookHandler } from './stripe-webhook.js';

describe('StripeWebhookHandler', () => {
  beforeEach(() => {
    poolQueries.length = 0;
    vi.clearAllMocks();
  });

  it('syncs checkout.session.completed through SubscriptionManager', async () => {
    const handler = new StripeWebhookHandler();
    await handler.handleEvent({
      id: 'evt_checkout_1',
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { tenantId: 'tenant-1', orgId: 'org-1', plan: 'carina_ops_starter' },
        },
      },
    } as Stripe.Event);

    expect(syncFromCheckoutSession).toHaveBeenCalledTimes(1);
    expect(poolQueries.some((q) => /INSERT INTO stripe_events/.test(q.sql))).toBe(true);
  });

  it('downgrades org on customer.subscription.deleted', async () => {
    const handler = new StripeWebhookHandler();
    await handler.handleEvent({
      id: 'evt_deleted_1',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          metadata: { tenantId: 'tenant-1', orgId: 'org-1', plan: 'carina_ops_starter' },
        },
      },
    } as Stripe.Event);

    expect(handleSubscriptionDeleted).toHaveBeenCalledTimes(1);
  });

  it('skips duplicate stripe event ids', async () => {
    const { pool } = await import('../../memory/db.js');
    vi.mocked(pool.query).mockImplementation(async (sql: string) => {
      if (/SELECT id FROM stripe_events/.test(sql)) {
        return { rows: [{ id: 'evt_dup' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const handler = new StripeWebhookHandler();
    await handler.handleEvent({ id: 'evt_dup', type: 'checkout.session.completed', data: { object: {} } } as Stripe.Event);
    expect(syncFromCheckoutSession).not.toHaveBeenCalled();
  });
});
