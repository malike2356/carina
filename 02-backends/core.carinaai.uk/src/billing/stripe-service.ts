import Stripe from 'stripe';
import {
  resolveStripePriceId,
  resolveTopupStripePriceId,
  type BillingPlanId,
  type CreditTopupPackId,
} from './plans.js';
import { refreshBillingConfigCache } from './billing-config.js';
import {
  resolveStripeSecretKey,
  resolveStripeWebhookSecret,
} from './billing-stripe-client.js';

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
  private cachedSecret = '';
  private readonly injected: boolean;

  constructor(stripe?: Stripe) {
    this.stripe = stripe ?? null;
    this.injected = Boolean(stripe);
  }

  resetClient(): void {
    if (this.injected) return;
    this.stripe = null;
    this.cachedSecret = '';
  }

  private client(): Stripe {
    if (this.injected && this.stripe) return this.stripe;
    const secret = resolveStripeSecretKey();
    if (!secret) {
      throw new Error('Missing STRIPE_SECRET_KEY');
    }
    if (this.stripe && this.cachedSecret === secret) return this.stripe;
    this.stripe = new Stripe(secret);
    this.cachedSecret = secret;
    return this.stripe;
  }

  async createCheckoutSession(input: CheckoutInput): Promise<Stripe.Checkout.Session> {
    return this.client().checkout.sessions.create({
      mode: 'subscription',
      customer_email: input.email,
      line_items: [{ price: resolveStripePriceId(input.plan), quantity: 1 }],
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
    return this.client().checkout.sessions.create({
      mode: 'payment',
      customer_email: input.email,
      line_items: [{ price: resolveTopupStripePriceId(input.packId), quantity: 1 }],
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
    const secret = resolveStripeWebhookSecret();
    if (!secret) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
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
