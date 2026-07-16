import express, { type Express } from 'express';
import { BillingApi } from '../billing/billing-api.js';
import { StripeWebhookHandler } from '../billing/webhooks/stripe-webhook.js';

const stripeWebhookRaw = express.raw({ type: 'application/json' });
const stripeWebhookHandler = new StripeWebhookHandler().expressHandler();

export function mountBillingWebhook(app: Express): void {
  app.post('/webhooks/stripe', stripeWebhookRaw, stripeWebhookHandler);
  // Legacy path from early launch docs; keep until Stripe dashboard endpoints are migrated.
  app.post('/api/billing/stripe/webhook', stripeWebhookRaw, stripeWebhookHandler);
}

export function mountBillingRoutes(app: Express): void {
  app.use('/api/billing', new BillingApi().router);
}
