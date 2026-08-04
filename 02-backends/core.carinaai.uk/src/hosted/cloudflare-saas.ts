import { resolveConfigValue } from '../billing/billing-config.js';

const CF_BASE = 'https://api.cloudflare.com/client/v4';

function cfHeaders(): HeadersInit {
  const token = resolveConfigValue('CF_API_TOKEN');
  if (!token) throw new Error('CF_API_TOKEN is not configured');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function zoneId(): string {
  const id = resolveConfigValue('CF_FOR_SAAS_ZONE_ID');
  if (!id) throw new Error('CF_FOR_SAAS_ZONE_ID is not configured');
  return id;
}

export interface CfCustomHostname {
  id: string;
  hostname: string;
  ownershipVerification: { type: string; name: string; value: string } | null;
  sslStatus: string;
  status: string;
}

function mapCfResponse(data: Record<string, unknown>): CfCustomHostname {
  const ssl = data.ssl as Record<string, unknown> | undefined;
  const ov = data.ownership_verification as Record<string, unknown> | undefined;
  return {
    id: String(data.id),
    hostname: String(data.hostname),
    ownershipVerification: ov
      ? { type: String(ov.type), name: String(ov.name), value: String(ov.value) }
      : null,
    sslStatus: String(ssl?.status ?? 'pending'),
    status: String(data.status ?? 'pending'),
  };
}

export async function registerCfCustomHostname(hostname: string): Promise<CfCustomHostname> {
  const res = await fetch(`${CF_BASE}/zones/${zoneId()}/custom_hostnames`, {
    method: 'POST',
    headers: cfHeaders(),
    body: JSON.stringify({
      hostname,
      ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
    }),
  });
  const body = await res.json() as { success: boolean; result: Record<string, unknown>; errors?: unknown[] };
  if (!body.success) {
    const msg = JSON.stringify(body.errors ?? 'CF API error');
    throw new Error(`CF custom hostname registration failed: ${msg}`);
  }
  return mapCfResponse(body.result);
}

export async function deleteCfCustomHostname(cfHostnameId: string): Promise<void> {
  const res = await fetch(`${CF_BASE}/zones/${zoneId()}/custom_hostnames/${cfHostnameId}`, {
    method: 'DELETE',
    headers: cfHeaders(),
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`CF custom hostname deletion failed: ${res.status}`);
  }
}

export async function getCfCustomHostname(cfHostnameId: string): Promise<CfCustomHostname | null> {
  const res = await fetch(`${CF_BASE}/zones/${zoneId()}/custom_hostnames/${cfHostnameId}`, {
    headers: cfHeaders(),
  });
  if (res.status === 404) return null;
  const body = await res.json() as { success: boolean; result: Record<string, unknown> };
  if (!body.success) return null;
  return mapCfResponse(body.result);
}
