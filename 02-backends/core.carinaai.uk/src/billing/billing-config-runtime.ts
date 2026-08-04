import { resetStripeBillingClient } from './billing-stripe-client.js';
import { resetResendClient } from '../email/resend-client.js';

/** Keys that rebuild SDK clients when their effective value changes. */
export const BILLING_RUNTIME_SECRET_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'CF_API_TOKEN',
  'CF_FOR_SAAS_ZONE_ID',
  'RESEND_API_KEY',
  'RESEND_WEBHOOK_SECRET',
] as const;

let lastRuntimeFingerprint = '';

function runtimeFingerprint(cache: Record<string, string>): string {
  return BILLING_RUNTIME_SECRET_KEYS.map((key) => {
    const fromDb = cache[key]?.trim() ?? '';
    const fromEnv = process.env[key]?.trim() ?? '';
    return `${key}=${fromDb || fromEnv}`;
  }).join('\0');
}

export function resetBillingRuntimeClients(): void {
  lastRuntimeFingerprint = '';
  resetStripeBillingClient();
  resetResendClient();
}

export function syncRuntimeClientsFromCache(cache: Record<string, string>): void {
  const fingerprint = runtimeFingerprint(cache);
  if (fingerprint === lastRuntimeFingerprint) return;
  lastRuntimeFingerprint = fingerprint;
  resetStripeBillingClient();
  resetResendClient();
}
