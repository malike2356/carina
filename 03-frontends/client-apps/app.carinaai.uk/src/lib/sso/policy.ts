import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaces } from '@/db/schema';
import { isPublicDomain, normalizeDomain, resolveSsoProviderByDomain } from './workspace-sso';

export interface SsoDiscoveryResult {
  ssoAvailable: boolean;
  providerId?: string;
  providerType?: 'oidc' | 'saml';
  domain?: string;
  ssoRequired?: boolean;
}

export async function discoverSsoForEmail(email: string): Promise<SsoDiscoveryResult> {
  const domain = normalizeDomain(email.split('@')[1] ?? '');
  if (!domain || isPublicDomain(domain)) {
    return { ssoAvailable: false };
  }

  const provider = await resolveSsoProviderByDomain(domain);
  if (!provider) {
    return { ssoAvailable: false };
  }

  return {
    ssoAvailable: true,
    providerId: provider.id,
    providerType: provider.providerType,
    domain,
    ssoRequired: provider.ssoRequired,
  };
}

export function emailDomainMatchesProvider(email: string, providerDomain: string): boolean {
  const domain = normalizeDomain(email.split('@')[1] ?? '');
  return domain === normalizeDomain(providerDomain);
}

export async function isWorkspaceOwnerForProvider(workspaceId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: workspaces.userId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return row?.userId === userId;
}
