import { Resend } from 'resend';
import { resolveConfigValue } from '../billing/billing-config.js';

let _client: Resend | null = null;
let _cachedApiKey = '';

export function resetResendClient(): void {
  _client = null;
  _cachedApiKey = '';
}

export function resolveResendApiKey(): string {
  return resolveConfigValue('RESEND_API_KEY');
}

export function resolveResendWebhookSecret(): string {
  return resolveConfigValue('RESEND_WEBHOOK_SECRET');
}

export function getResendClient(): Resend | null {
  const apiKey = resolveResendApiKey();
  if (!apiKey) return null;
  if (_client && _cachedApiKey === apiKey) return _client;
  _client = new Resend(apiKey);
  _cachedApiKey = apiKey;
  return _client;
}
