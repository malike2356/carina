import express, { type Express } from 'express';
import { BillingApi } from '../billing/billing-api.js';
import { StripeWebhookHandler } from '../billing/webhooks/stripe-webhook.js';

export function mountBillingWebhook(app: Express): void {
  app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), new StripeWebhookHandler().expressHandler());
}

export function mountBillingRoutes(app: Express): void {
  app.use('/api/billing', new BillingApi().router);
}
