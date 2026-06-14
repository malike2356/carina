import Stripe from 'stripe';
import { config } from '../config/index.js';
import { resolveStripePriceId, type BillingPlanId } from './plans.js';

export interface CheckoutInput {
  tenantId: string;
  orgId?: string;
  email: string;
  plan: BillingPlanId;
  successUrl: string;
  cancelUrl: string;
}

export class StripeService {
  private readonly stripe: Stripe;

  constructor(stripe?: Stripe) {
    const secret = config.hosted.stripeSecretKey || process.env.STRIPE_SECRET_KEY || '';
    if (!secret && !stripe) {
      throw new Error('Missing required env var: STRIPE_SECRET_KEY');
    }
    this.stripe = stripe ?? new Stripe(secret);
  }

  async createCheckoutSession(input: CheckoutInput): Promise<Stripe.Checkout.Session> {
    return this.stripe.checkout.sessions.create({
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

  handleWebhook(payload: Buffer | string, signature: string): Stripe.Event {
    const secret = config.hosted.stripeWebhookSecret || process.env.STRIPE_WEBHOOK_SECRET || '';
    if (!secret) throw new Error('Missing required env var: STRIPE_WEBHOOK_SECRET');
    return this.stripe.webhooks.constructEvent(payload, signature, secret);
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(subscriptionId);
  }

  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
  }

  async reactivateSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: false });
  }

  async updatePaymentMethod(customerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
    return this.stripe.billingPortal.sessions.create({ customer: customerId, return_url: returnUrl });
  }
}
