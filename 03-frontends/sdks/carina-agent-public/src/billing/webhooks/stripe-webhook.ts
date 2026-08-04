import type { Request, Response } from 'express';
import type Stripe from 'stripe';
import { pool } from '../../memory/db.js';
import { InvoiceGenerator } from '../invoice-generator.js';
import { StripeService } from '../stripe-service.js';
import { SubscriptionManager } from '../subscription-manager.js';

export class StripeWebhookHandler {
  constructor(
    private readonly stripeService = new StripeService(),
    private readonly subscriptions = new SubscriptionManager(stripeService),
    private readonly invoices = new InvoiceGenerator(),
  ) {}

  async handleEvent(event: Stripe.Event): Promise<void> {
    const existing = await pool.query('SELECT id FROM stripe_events WHERE id = $1', [event.id]);
    if ((existing.rowCount ?? 0) > 0) return;
    await pool.query('INSERT INTO stripe_events (id, type, received_at) VALUES ($1, $2, NOW())', [event.id, event.type]);

    if (event.type === 'checkout.session.completed') {
      await this.subscriptions.syncFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
      return;
    }
    if (event.type === 'customer.subscription.updated') {
      await this.subscriptions.syncStripeSubscription(event.data.object as Stripe.Subscription);
      return;
    }
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await pool.query('UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2', ['canceled', subscription.id]);
      return;
    }
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      await this.invoices.recordStripeInvoice(invoice);
      const subscriptionId = typeof invoice.parent?.subscription_details?.subscription === 'string'
        ? invoice.parent.subscription_details.subscription
        : null;
      if (subscriptionId) {
        await pool.query('UPDATE subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2', ['past_due', subscriptionId]);
      }
      return;
    }
    if (event.type === 'invoice.payment_succeeded') {
      await this.invoices.recordStripeInvoice(event.data.object as Stripe.Invoice);
    }
  }

  expressHandler() {
    return async (req: Request, res: Response): Promise<void> => {
      const signature = req.headers['stripe-signature'];
      if (typeof signature !== 'string') {
        res.status(400).send('Missing Stripe signature');
        return;
      }
      try {
        const event = this.stripeService.handleWebhook(req.body as Buffer, signature);
        await this.handleEvent(event);
        res.json({ received: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        res.status(400).send(msg);
      }
    };
  }
}
