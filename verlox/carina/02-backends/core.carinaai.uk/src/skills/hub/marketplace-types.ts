export type MarketplaceEntryKind =
  | 'pack'
  | 'extension'
  | 'toolset'
  | 'channel'
  | 'workflow'
  | 'theme'
  | 'mcp';

export type MarketplacePublisher = 'carina' | 'verified' | 'community';

export type MarketplaceValidationStatus = 'builtin' | 'passed' | 'pending' | 'failed';

export type MarketplaceRisk = 'low' | 'medium' | 'high';

export type MarketplaceInstallStatus =
  | 'available'
  | 'installed'
  | 'enabled'
  | 'disabled';

export type MarketplaceTrust = {
  publisher: MarketplacePublisher;
  featured: boolean;
  verified: boolean;
  validation: MarketplaceValidationStatus;
  risk: MarketplaceRisk;
  evalRequired?: boolean;
};

export type MarketplaceEntry = {
  id: string;
  kind: MarketplaceEntryKind;
  slug: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category?: string;
  tags?: string[];
  trust: MarketplaceTrust;
  install: {
    source: 'builtin' | 'hub' | 'local' | 'npm' | 'git';
    ref?: string;
    npmPackage?: string;
    envKeys?: string[];
    webhook?: string;
  };
  stats?: {
    downloads?: number;
    skillCount?: number;
    toolCount?: number;
  };
  status: MarketplaceInstallStatus;
  installedVersion?: string;
  updatedAt?: string;
};

export type MarketplaceCatalogFilters = {
  kind?: MarketplaceEntryKind;
  q?: string;
  category?: string;
  featured?: boolean;
  verified?: boolean;
  publisher?: MarketplacePublisher;
  installed?: boolean;
  enabled?: boolean;
};

export type MarketplaceCatalogSummary = {
  total: number;
  byKind: Record<MarketplaceEntryKind, number>;
  featured: number;
  verified: number;
  installed: number;
  enabled: number;
};

export function marketplaceEntryId(kind: MarketplaceEntryKind, slug: string): string {
  return `${kind}:${slug}`;
}

export function parseMarketplaceEntryId(id: string): { kind: MarketplaceEntryKind; slug: string } {
  const idx = id.indexOf(':');
  if (idx <= 0) {
    throw new Error(`Invalid marketplace id "${id}" (expected kind:slug)`);
  }
  const kind = id.slice(0, idx) as MarketplaceEntryKind;
  const slug = id.slice(idx + 1);
  const valid: MarketplaceEntryKind[] = ['pack', 'extension', 'toolset', 'channel', 'workflow', 'theme', 'mcp'];
  if (!valid.includes(kind) || !slug) {
    throw new Error(`Invalid marketplace id "${id}"`);
  }
  return { kind, slug };
}
