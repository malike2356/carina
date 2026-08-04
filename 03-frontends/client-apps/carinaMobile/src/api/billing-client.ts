import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

export interface BillingUsageResponse {
  usage: {
    tokensUsed: number;
    limit: number | null;
    warning?: string;
    blocked?: string;
  };
  subscription: {
    plan: string;
    status: string;
    current_period_start: string | null;
    current_period_end: string | null;
  };
  tier: string;
  planName: string;
  tokenLimit: number | null;
  monthlyPriceGbp: number | null;
  messagesToday: number;
  freeDailyLimit: number | null;
}

function formatBillingError(label: string, status: number, body: string, statusText: string): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('self.__next_f')) {
    return `${label} ${status}: endpoint missing or returned HTML instead of JSON.`;
  }
  try {
    const parsed = JSON.parse(trimmed) as { error?: string; message?: string };
    const msg = parsed.error ?? parsed.message;
    if (msg) return `${label} ${status}: ${msg}`;
  } catch {
    // not JSON
  }
  const short = trimmed.length > 180 ? `${trimmed.slice(0, 180)}…` : trimmed;
  return `${label} ${status}: ${short || statusText}`;
}

export async function fetchBillingUsage(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<BillingUsageResponse> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/app/auth/billing/usage`,
    mergeGatewayInit(auth, { method: 'GET', headers: { Accept: 'application/json' } }),
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatBillingError('Billing usage', response.status, text, response.statusText));
  }
  return response.json() as Promise<BillingUsageResponse>;
}

export async function openBillingPortal(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<string> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/app/auth/billing/portal`,
    mergeGatewayInit(auth, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: '{}',
    }),
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(formatBillingError('Billing portal', response.status, text, response.statusText));
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error('No billing portal URL returned');
  return data.url;
}

export async function startBillingCheckout(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<string> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/app/auth/billing/checkout`,
    mergeGatewayInit(auth, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: JSON.stringify({ plan: 'team' }),
    }),
  );
  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      formatBillingError('Billing checkout', response.status, text, response.statusText),
    );
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) throw new Error('No checkout URL returned');
  return data.url;
}
