import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { customDomains, workspaceSettings, workspaces } from '@/db/schema';
import {
  canonicalAppHost,
  isCanonicalAppHost,
  normaliseCustomDomainHostname,
} from '@/lib/custom-domains';
import { isAivaProductHost, type ProductSurface } from '@/lib/product-surface';
import { normalizeBrandConfig, resolveWorkspaceBrand, type ResolvedBrand } from '@/lib/brand';

export type HostBrandContext = {
  hostname: string;
  isCanonical: boolean;
  isCustomDomain: boolean;
  isAivaProduct: boolean;
  productSurface: ProductSurface;
  workspaceId: string | null;
  canonicalHost: string;
  resolvedBrand: ResolvedBrand;
};

export async function lookupVerifiedDomain(hostname: string) {
  const normalised = normaliseCustomDomainHostname(hostname);
  const [row] = await db
    .select()
    .from(customDomains)
    .where(eq(customDomains.hostname, normalised))
    .limit(1);
  if (!row?.verifiedAt) return null;
  return row;
}

export async function resolveHostBrandContext(hostname: string): Promise<HostBrandContext> {
  const host = normaliseCustomDomainHostname(hostname);
  const canonicalHost = canonicalAppHost();

  if (isAivaProductHost(host)) {
    return {
      hostname: host,
      isCanonical: true,
      isCustomDomain: false,
      isAivaProduct: true,
      productSurface: 'aiva',
      workspaceId: null,
      canonicalHost: host,
      resolvedBrand: resolveWorkspaceBrand({ mode: 'aiva' }),
    };
  }

  if (isCanonicalAppHost(host)) {
    return {
      hostname: host,
      isCanonical: true,
      isCustomDomain: false,
      isAivaProduct: false,
      productSurface: 'cloud',
      workspaceId: null,
      canonicalHost,
      resolvedBrand: resolveWorkspaceBrand({ mode: 'hosted' }),
    };
  }

  const domain = await lookupVerifiedDomain(host);
  if (!domain) {
    return {
      hostname: host,
      isCanonical: false,
      isCustomDomain: false,
      isAivaProduct: false,
      productSurface: 'cloud',
      workspaceId: null,
      canonicalHost,
      resolvedBrand: resolveWorkspaceBrand({ mode: 'hosted' }),
    };
  }

  const [settings] = await db
    .select({ brand: workspaceSettings.brand, customTheme: workspaceSettings.customTheme })
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, domain.workspaceId))
    .limit(1);

  const resolvedBrand = resolveWorkspaceBrand({
    workspaceBrand: normalizeBrandConfig(settings?.brand ?? {}),
    userColorTokens: settings?.customTheme,
  });

  return {
    hostname: host,
    isCanonical: domain.isCanonical,
    isCustomDomain: true,
    isAivaProduct: false,
    productSurface: 'cloud',
    workspaceId: domain.workspaceId,
    canonicalHost: domain.isCanonical ? domain.hostname : canonicalHost,
    resolvedBrand,
  };
}

export async function getCanonicalHostForWorkspace(workspaceId: string): Promise<string> {
  const rows = await db
    .select({
      hostname: customDomains.hostname,
      isCanonical: customDomains.isCanonical,
      verifiedAt: customDomains.verifiedAt,
    })
    .from(customDomains)
    .where(eq(customDomains.workspaceId, workspaceId));

  const verifiedCanonical = rows.find((entry) => entry.verifiedAt && entry.isCanonical);
  if (verifiedCanonical) {
    return normaliseCustomDomainHostname(verifiedCanonical.hostname);
  }
  return canonicalAppHost();
}

export async function listWorkspaceDomains(workspaceId: string) {
  return db
    .select()
    .from(customDomains)
    .where(eq(customDomains.workspaceId, workspaceId));
}

export async function getWorkspaceCoreOrgId(workspaceId: string): Promise<string | null> {
  const [workspace] = await db
    .select({ coreOrgId: workspaces.coreOrgId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return workspace?.coreOrgId ?? null;
}
