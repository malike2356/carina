import type { ProductMode } from './types.js';
import { platformBrandDefaults } from './brand.js';

/**
 * Platform brand: Carina kernel, operator hosts, CLI identifiers, and internal docs.
 * Customer brand: reseller or workspace product name shown to end users.
 */
export const BRAND_GLOSSARY = {
  platformBrand: {
    term: 'Platform brand',
    meaning: 'Canonical Carina naming on kernel, ops, CLI, and developer surfaces.',
    examples: ['Carina', 'Carina Cloud', 'Carina Ops', 'carina CLI'],
  },
  customerBrand: {
    term: 'Customer brand',
    meaning: 'Product name, logo, and support identity shown to a tenant end users.',
    examples: ['Acme Agents', 'Nova Cloud', 'help@client.example'],
  },
  resellerBrand: {
    term: 'Reseller brand',
    meaning: 'Partner-level defaults applied to every client workspace under that partner.',
    examples: ['Agency product name', 'Partner support email'],
  },
  workspaceBrand: {
    term: 'Workspace brand',
    meaning: 'Per-workspace overrides within a customer or reseller account.',
    examples: ['Client logo URL', 'Workspace-specific sender name'],
  },
} as const;

/** Legacy user-facing labels that remain valid compatibility aliases. */
export const LEGACY_PLATFORM_PRODUCT_NAMES: Record<ProductMode, string> = {
  hosted: 'Carina Cloud',
  private: 'Carina',
  ops: 'Carina Ops',
};

export function canonicalPlatformProductName(mode: ProductMode): string {
  return platformBrandDefaults(mode).productName ?? LEGACY_PLATFORM_PRODUCT_NAMES[mode];
}

export function canonicalPlatformShortName(mode: ProductMode): string {
  return platformBrandDefaults(mode).shortName ?? 'Carina';
}

export function isLegacyPlatformProductName(name: string, mode: ProductMode): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  const canonical = canonicalPlatformProductName(mode);
  const legacy = LEGACY_PLATFORM_PRODUCT_NAMES[mode];
  return trimmed === canonical || trimmed === legacy;
}

export function resolveLegacyProductAlias(name: string): ProductMode | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  for (const [mode, label] of Object.entries(LEGACY_PLATFORM_PRODUCT_NAMES) as Array<[ProductMode, string]>) {
    if (trimmed === label) return mode;
  }
  if (trimmed === 'Carina Agent') return 'private';
  return null;
}
