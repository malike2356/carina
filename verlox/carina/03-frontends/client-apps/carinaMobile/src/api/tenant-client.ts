import type { GatewayAuthOptions } from '@/lib/gateway-auth';
import { mergeGatewayInit } from '@/lib/gateway-auth';

export interface TenantProvider {
  provider: string;
  enabled: boolean;
  hasKey: boolean;
  baseUrl?: string | null;
  model?: string | null;
}

async function tenantFetch<T>(
  baseUrl: string,
  path: string,
  auth?: GatewayAuthOptions,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}${path}`,
    mergeGatewayInit(auth, init),
  );
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Tenant API ${response.status}: ${body || response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export function listTenantProviders(
  baseUrl: string,
  auth?: GatewayAuthOptions,
): Promise<{ providers: TenantProvider[] }> {
  return tenantFetch(baseUrl, '/api/tenant/providers', auth);
}

export function addTenantProvider(
  baseUrl: string,
  provider: string,
  apiKey: string,
  options?: { baseUrl?: string; model?: string; auth?: GatewayAuthOptions },
): Promise<{ success: boolean }> {
  return tenantFetch(baseUrl, '/api/tenant/providers', options?.auth, {
    method: 'POST',
    body: JSON.stringify({
      provider,
      apiKey,
      baseUrl: options?.baseUrl,
      model: options?.model,
    }),
  });
}

export function removeTenantProvider(
  baseUrl: string,
  provider: string,
  auth?: GatewayAuthOptions,
): Promise<{ success: boolean }> {
  return tenantFetch(baseUrl, `/api/tenant/providers/${encodeURIComponent(provider)}`, auth, {
    method: 'DELETE',
  });
}
