import { listKnownPackNames } from '../pack-manifests.js';

export type PackOwnership = 'platform' | 'reseller' | 'customer';

export type PackCatalogRecord = {
  slug: string;
  ownership: PackOwnership;
  ownerId?: string;
  visible: boolean;
  label?: string;
};

export type PackCatalogContext = {
  partnerId?: string | null;
  workspaceId?: string | null;
  partnerPacks?: PackCatalogRecord[];
  customerPacks?: PackCatalogRecord[];
};

const PLATFORM_OWNED = new Set(listKnownPackNames());

export function defaultPackOwnership(slug: string): PackOwnership {
  return PLATFORM_OWNED.has(slug) ? 'platform' : 'customer';
}

export function normalizePackCatalogRecord(raw: unknown): PackCatalogRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const slug = String(row.slug ?? '').trim();
  if (!slug) return null;
  const ownership = String(row.ownership ?? defaultPackOwnership(slug)) as PackOwnership;
  if (!['platform', 'reseller', 'customer'].includes(ownership)) return null;
  return {
    slug,
    ownership,
    ownerId: row.ownerId ? String(row.ownerId) : undefined,
    visible: row.visible !== false,
    label: row.label ? String(row.label) : undefined,
  };
}

export function mergePackCatalog(
  base: PackCatalogRecord[],
  overrides: PackCatalogRecord[],
): PackCatalogRecord[] {
  const bySlug = new Map(base.map((entry) => [entry.slug, entry]));
  for (const entry of overrides) {
    bySlug.set(entry.slug, { ...bySlug.get(entry.slug), ...entry });
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

export function isPackVisibleToContext(
  entry: PackCatalogRecord,
  context: PackCatalogContext,
): boolean {
  if (!entry.visible) return false;
  if (entry.ownership === 'platform') return true;
  if (entry.ownership === 'reseller') {
    return Boolean(context.partnerId) && (!entry.ownerId || entry.ownerId === context.partnerId);
  }
  if (entry.ownership === 'customer') {
    return Boolean(context.workspaceId) && (!entry.ownerId || entry.ownerId === context.workspaceId);
  }
  return false;
}

export function filterVisiblePackCatalog(
  catalog: PackCatalogRecord[],
  context: PackCatalogContext,
): PackCatalogRecord[] {
  return catalog.filter((entry) => isPackVisibleToContext(entry, context));
}
