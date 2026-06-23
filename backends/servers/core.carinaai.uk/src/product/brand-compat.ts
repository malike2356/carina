import {
  normalizeBrandConfig,
  platformBrandDefaults,
  resolveBrand,
  type BrandConfig,
  type BrandResolutionInput,
  type ResolvedBrand,
} from './brand.js';
import {
  canonicalPlatformProductName,
  canonicalPlatformShortName,
  isLegacyPlatformProductName,
} from './brand-glossary.js';
import { resolveProductSurface } from './surface.js';
import type { ProductMode, ProductSurface } from './types.js';

export function resolveAgentDisplayName(brand?: Pick<ResolvedBrand, 'shortName' | 'productName'>): string {
  const shortName = brand?.shortName?.trim();
  if (shortName) return shortName;
  const productName = brand?.productName?.trim();
  if (productName) return productName;
  return (process.env.CARINA_AGENT_NAME ?? 'Carina').trim() || 'Carina';
}

/**
 * Remove stored brand values that match platform defaults so legacy rows behave
 * like unconfigured installs after white-label migrations.
 */
export function stripPlatformEquivalentBrand(
  config: unknown,
  mode: ProductMode,
): BrandConfig {
  const platform = platformBrandDefaults(mode);
  const normalized = normalizeBrandConfig(config);
  const next: BrandConfig = { ...normalized };

  if (next.productName && isLegacyPlatformProductName(next.productName, mode)) {
    delete next.productName;
  }
  if (next.shortName && next.shortName === canonicalPlatformShortName(mode)) {
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

export function resolveBrandedProductSurface(
  hostname: string,
  brandInput?: Omit<BrandResolutionInput, 'mode'>,
): ProductSurface {
  const surface = resolveProductSurface(hostname);
  const cleanedWorkspace = stripPlatformEquivalentBrand(brandInput?.workspace, surface.mode);
  const cleanedReseller = stripPlatformEquivalentBrand(brandInput?.reseller, surface.mode);
  const brand = resolveBrand({
    mode: surface.mode,
    ...brandInput,
    workspace: cleanedWorkspace,
    reseller: cleanedReseller,
  });

  const platformName = canonicalPlatformProductName(surface.mode);
  const workspaceName = brand.productName !== platformName
    ? brand.productName
    : surface.branding.workspaceName;

  return {
    ...surface,
    branding: {
      ...surface.branding,
      productName: brand.productName,
      workspaceName,
      titleSuffix: brand.publicSiteTitle,
    },
  };
}

export function surfaceBrandToWorkspaceOptions(brand: ResolvedBrand): {
  productName: string;
  shortName: string;
  logoUrl?: string;
  colorTokens?: Record<string, string>;
} {
  return {
    productName: brand.productName,
    shortName: brand.shortName,
    logoUrl: brand.logoUrl ?? undefined,
    colorTokens: Object.keys(brand.colorTokens).length > 0 ? brand.colorTokens : undefined,
  };
}
