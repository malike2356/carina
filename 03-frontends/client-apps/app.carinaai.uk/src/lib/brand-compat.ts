import type { AppBrandMode, BrandConfig } from '@/lib/brand';
import { normalizeBrandConfig, PLATFORM_BRAND_DEFAULTS } from '@/lib/brand';

export const LEGACY_PLATFORM_PRODUCT_NAMES: Record<AppBrandMode, string> = {
  hosted: 'Carina Cloud',
  private: 'Carina',
  ops: 'Carina Ops',
  aiva: 'Aiva',
};

export function canonicalPlatformProductName(mode: AppBrandMode = 'hosted'): string {
  return PLATFORM_BRAND_DEFAULTS[mode].productName ?? LEGACY_PLATFORM_PRODUCT_NAMES[mode];
}

export function isLegacyPlatformProductName(name: string, mode: AppBrandMode = 'hosted'): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  return trimmed === canonicalPlatformProductName(mode) || trimmed === LEGACY_PLATFORM_PRODUCT_NAMES[mode];
}

export function stripPlatformEquivalentBrand(
  config: unknown,
  mode: AppBrandMode = 'hosted',
): BrandConfig {
  const platform = PLATFORM_BRAND_DEFAULTS[mode];
  const normalized = normalizeBrandConfig(config);
  const next: BrandConfig = { ...normalized };

  if (next.productName && isLegacyPlatformProductName(next.productName, mode)) {
    delete next.productName;
  }
  if (next.shortName && next.shortName === (platform.shortName ?? 'Carina')) {
    delete next.shortName;
  }
  if (next.publicSiteTitle && isLegacyPlatformProductName(next.publicSiteTitle, mode)) {
    delete next.publicSiteTitle;
  }
  if (next.supportName && next.supportName === platform.supportName) {
    delete next.supportName;
  }
  if (next.supportEmail && next.supportEmail === platform.supportEmail) {
    delete next.supportEmail;
  }
  if (next.senderName && next.senderName === platform.senderName) {
    delete next.senderName;
  }
  if (next.senderEmail && next.senderEmail === platform.senderEmail) {
    delete next.senderEmail;
  }

  return normalizeBrandConfig(next);
}

export function resolveAgentDisplayName(productName?: string, shortName?: string): string {
  const shortLabel = shortName?.trim();
  if (shortLabel) return shortLabel;
  const productLabel = productName?.trim();
  if (productLabel) return productLabel;
  return 'Carina';
}
