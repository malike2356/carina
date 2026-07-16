import Stripe from 'stripe';
import { resolveConfigValue } from './billing-config.js';

let _stripe: Stripe | null = null;
let _cachedSecret = '';

export function resetStripeBillingClient(): void {
  _stripe = null;
  _cachedSecret = '';
}

export function resolveStripeSecretKey(): string {
  return resolveConfigValue('STRIPE_SECRET_KEY');
}

export function resolveStripeWebhookSecret(): string {
  return resolveConfigValue('STRIPE_WEBHOOK_SECRET');
}

export function getStripeBillingClient(): Stripe {
  const secret = resolveStripeSecretKey();
  if (!secret) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  if (_stripe && _cachedSecret === secret) return _stripe;
  _stripe = new Stripe(secret);
  _cachedSecret = secret;
  return _stripe;
}

export function getStripeBillingClientOrNull(): Stripe | null {
  const secret = resolveStripeSecretKey();
  if (!secret) return null;
  if (_stripe && _cachedSecret === secret) return _stripe;
  _stripe = new Stripe(secret);
  _cachedSecret = secret;
  return _stripe;
}
