import Stripe from 'stripe';
import { config } from '../config/index.js';
import {
  resolveStripePriceIdAsync,
  resolveTopupStripePriceIdAsync,
  type BillingPlanId,
  type CreditTopupPackId,
} from './plans.js';
import { refreshBillingConfigCache } from './billing-config.js';

export interface CheckoutInput {
  tenantId: string;
  orgId?: string;
  email: string;
  plan: BillingPlanId;
  successUrl: string;
  cancelUrl: string;
}

export interface TopupCheckoutInput {
  tenantId: string;
  orgId: string;
  email: string;
  packId: CreditTopupPackId;
  successUrl: string;
  cancelUrl: string;
}

export class StripeService {
  private stripe: Stripe | null;

  constructor(stripe?: Stripe) {
    this.stripe = stripe ?? null;
  }

  private client(): Stripe {
    if (this.stripe) return this.stripe;
    const secret = config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
    if (!secret) {
      throw new Error('Missing required env var: STRIPE_SECRET_KEY');
    }
    this.stripe = new Stripe(secret);
    return this.stripe;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<Stripe.Checkout.Session> {
    await refreshBillingConfigCache();
    const priceId = await resolveStripePriceIdAsync(input.plan);
    return this.client().checkout.sessions.create({
      mode: 'subscription',
      customer_email: input.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        tenantId: input.tenantId,
        orgId: input.orgId ?? '',
        plan: input.plan,
      },
      subscription_data: {
        metadata: {
          tenantId: input.tenantId,
          orgId: input.orgId ?? '',
          plan: input.plan,
        },
      },
    });
  }

  async createTopupCheckoutSession(input: TopupCheckoutInput): Promise<Stripe.Checkout.Session> {
    await refreshBillingConfigCache();
    const priceId = await resolveTopupStripePriceIdAsync(input.packId);
    return this.client().checkout.sessions.create({
      mode: 'payment',
      customer_email: input.email,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        tenantId: input.tenantId,
        orgId: input.orgId,
        packId: input.packId,
        checkoutType: 'credit_topup',
      },
    });
  }

  handleWebhook(payload: Buffer | string, signature: string): Stripe.Event {
    const secret = config.hosted.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!secret) throw new Error('Missing required env var: STRIPE_WEBHOOK_SECRET');
    return this.client().webhooks.constructEvent(payload, signature, secret);
  }

  async getCheckoutSession(sessionId: string): Promise<Stripe.Checkout.Session> {
    return this.client().checkout.sessions.retrieve(sessionId);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.update(subscriptionId, { cancel_at_period_end: false });
  }

  async updatePaymentMethod(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return this.client().billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  }

  async retrieveSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.retrieve(subscriptionId, { expand: ['items.data.price'] });
  }

  async createSubscriptionItem(subscriptionId: string, priceId: string): Promise<Stripe.SubscriptionItem> {
    return this.client().subscriptionItems.create({ subscription: subscriptionId, price: priceId });
  }

  async reportMeterEvent(params: {
    eventName: string;
    stripeCustomerId: string;
    quantity: number;
    timestamp?: number;
    identifier?: string;
  }): Promise<Stripe.Billing.MeterEvent> {
    return this.client().billing.meterEvents.create({
      event_name: params.eventName,
      payload: {
        stripe_customer_id: params.stripeCustomerId,
        value: String(params.quantity),
      },
      timestamp: params.timestamp,
      identifier: params.identifier,
    });
  }
}
