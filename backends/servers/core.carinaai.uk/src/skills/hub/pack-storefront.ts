import { PACK_MANIFESTS } from '../pack-manifests.js';
import {
  defaultPackOwnership,
  filterVisiblePackCatalog,
  mergePackCatalog,
  type PackCatalogContext,
  type PackCatalogRecord,
  type PackOwnership,
} from './pack-ownership.js';
import { VERTICAL_TEMPLATES, mergeTemplatePacks, type VerticalTemplate } from './vertical-templates.js';

export type StorefrontPack = {
  slug: string;
  name: string;
  description: string;
  version: string;
  category?: string;
  ownership: PackOwnership;
  visible: boolean;
  installed: boolean;
  label?: string;
};

export type PackStorefront = {
  productName: string;
  marketplaceEnabled: boolean;
  templates: VerticalTemplate[];
  packs: StorefrontPack[];
  activePacks: string[];
};

function platformCatalog(): PackCatalogRecord[] {
  return Object.keys(PACK_MANIFESTS).map((slug) => ({
    slug,
    ownership: defaultPackOwnership(slug),
    visible: true,
  }));
}

function toStorefrontPack(
  entry: PackCatalogRecord,
  activePacks: string[],
): StorefrontPack | null {
  const manifest = PACK_MANIFESTS[entry.slug];
  if (!manifest) return null;
  return {
    slug: entry.slug,
    name: entry.label ?? manifest.name,
    description: manifest.description,
    version: manifest.version,
    category: manifest.category,
    ownership: entry.ownership,
    visible: entry.visible,
    installed: activePacks.includes(entry.slug),
    label: entry.label,
  };
}

export function buildPackStorefront(input: {
  activePacks?: string[];
  productName?: string;
  marketplaceEnabled?: boolean;
  context?: PackCatalogContext;
  partnerPacks?: PackCatalogRecord[];
  customerPacks?: PackCatalogRecord[];
}): PackStorefront {
  const activePacks = [...(input.activePacks ?? [])];
  const context = input.context ?? {};
  const marketplaceEnabled = input.marketplaceEnabled !== false;

  const catalog = mergePackCatalog(platformCatalog(), [
    ...(input.partnerPacks ?? context.partnerPacks ?? []),
    ...(input.customerPacks ?? context.customerPacks ?? []),
  ]);

  const visibleCatalog = marketplaceEnabled
    ? filterVisiblePackCatalog(catalog, context)
    : catalog.filter((entry) => entry.ownership !== 'customer' || entry.visible !== false);

  const packs = visibleCatalog
    .map((entry) => toStorefrontPack(entry, activePacks))
    .filter((entry): entry is StorefrontPack => entry !== null);

  return {
    productName: input.productName?.trim() || 'Carina',
    marketplaceEnabled,
    templates: marketplaceEnabled ? VERTICAL_TEMPLATES : [],
    packs,
    activePacks,
  };
}

export function applyVerticalTemplate(
  activePacks: string[],
  templateId: string,
  knownPackSlugs: Iterable<string> = Object.keys(PACK_MANIFESTS),
): { packs: string[]; invalid: string[] } {
  const known = new Set(knownPackSlugs);
  const merged = mergeTemplatePacks(activePacks, templateId);
  const invalid = merged.filter((slug) => !known.has(slug));
  return {
    packs: merged.filter((slug) => known.has(slug)),
    invalid,
  };
}

export function toggleStorefrontPack(
  activePacks: string[],
  slug: string,
  enabled: boolean,
  knownPackSlugs: Iterable<string> = Object.keys(PACK_MANIFESTS),
): { packs: string[]; invalid: string[] } {
  const known = new Set(knownPackSlugs);
  if (!known.has(slug)) {
    return { packs: activePacks, invalid: [slug] };
  }
  const next = new Set(activePacks);
  if (enabled) next.add(slug);
  else next.delete(slug);
  return { packs: [...next].sort(), invalid: [] };
}
