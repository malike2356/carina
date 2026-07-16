import { headers } from 'next/headers';
import type { AdminSessionData } from '@/lib/admin-session';
import { requireAdminSession } from '@/lib/admin-session';

function bridgeSecret(): string {
  return process.env.OPS_BRIDGE_SECRET ?? '';
}

export function isOpsProxyRequest(headerList: Headers): boolean {
  const secret = bridgeSecret();
  if (!secret || secret.length < 16) return false;
  return headerList.get('x-ops-trusted-proxy') === secret
    && Boolean(headerList.get('x-ops-admin-token'));
}

export function sessionFromOpsProxy(headerList: Headers): AdminSessionData | null {
  if (!isOpsProxyRequest(headerList)) return null;
  const adminToken = headerList.get('x-ops-admin-token');
  if (!adminToken) return null;
  return {
    email: headerList.get('x-ops-admin-email') ?? 'operator@verlox.uk',
    adminToken,
    isAdmin: true,
  };
}

export async function resolveAdminSession(): Promise<AdminSessionData | null> {
  const headerList = await headers();
  const proxied = sessionFromOpsProxy(headerList);
  if (proxied) return proxied;
  return requireAdminSession();
}

export async function isOpsEmbedded(): Promise<boolean> {
  const headerList = await headers();
  return headerList.get('x-ops-embed') === '1';
}
