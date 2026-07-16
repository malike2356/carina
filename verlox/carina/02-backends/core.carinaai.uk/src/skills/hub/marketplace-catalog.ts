import { config } from '../../config/index.js';
import { readExtensionStore } from '../../extensions/store.js';
import type { HubPackRow } from './registry.js';
import { buildBuiltinMarketplaceEntries } from './marketplace-builtin.js';
import {
  hubRowToMarketplaceInput,
  listHubMarketplaceEntries,
} from './marketplace-registry.js';
import { readMarketplaceStore } from './marketplace-store.js';
import type {
  MarketplaceCatalogFilters,
  MarketplaceCatalogSummary,
  MarketplaceEntry,
  MarketplaceEntryKind,
  MarketplaceInstallStatus,
} from './marketplace-types.js';
import { marketplaceEntryId } from './marketplace-types.js';
import {
  assertCatalogIntegrity,
  normalizeMarketplaceEntry,
} from './marketplace-validate.js';
import { isPackVerified } from './hub-client.js';

function hubPackToEntry(pack: HubPackRow, localStatus?: MarketplaceInstallStatus, installedVersion?: string): MarketplaceEntry {
  return normalizeMarketplaceEntry({
    kind: 'pack',
    slug: pack.name,
    name: pack.name,
    version: pack.version,
    description: pack.description,
    author: pack.author,
    category: pack.category ?? undefined,
    trust: {
      publisher: isPackVerified(pack) ? 'verified' : pack.pricing_tier === 'premium' ? 'verified' : 'community',
      featured: pack.featured,
      verified: isPackVerified(pack),
      validation: isPackVerified(pack) ? 'passed' : 'pending',
      risk: pack.pricing_tier === 'premium' ? 'medium' : 'low',
      evalRequired: true,
    },
    install: {
      source: 'hub',
      ref: pack.name,
    },
    stats: {
      downloads: pack.download_count,
      skillCount: pack.skill_count,
    },
    status: localStatus ?? 'available',
    installedVersion,
  });
}

function applyLocalState(
  entries: MarketplaceEntry[],
  localRows: Awaited<ReturnType<typeof readMarketplaceStore>>,
  activePacks: string[],
): MarketplaceEntry[] {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  return entries.map((entry) => {
    const local = localById.get(entry.id);
    let status: MarketplaceInstallStatus = entry.status;
    let installedVersion = entry.installedVersion;

    if (local) {
      status = local.status;
      installedVersion = local.version;
    } else if (entry.kind === 'pack' && activePacks.includes(entry.slug)) {
      status = 'enabled';
      installedVersion = entry.version;
    }

    return { ...entry, status, installedVersion };
  });
}

function filterEntries(entries: MarketplaceEntry[], filters: MarketplaceCatalogFilters): MarketplaceEntry[] {
  return entries.filter((entry) => {
    if (filters.kind && entry.kind !== filters.kind) return false;
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.featured && !entry.trust.featured) return false;
    if (filters.verified && !entry.trust.verified) return false;
    if (filters.publisher && entry.trust.publisher !== filters.publisher) return false;
    if (filters.installed && entry.status === 'available') return false;
    if (filters.enabled && entry.status !== 'enabled') return false;
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      const hay = `${entry.name} ${entry.description} ${entry.slug} ${entry.author} ${entry.category ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function summarizeMarketplaceCatalog(entries: MarketplaceEntry[]): MarketplaceCatalogSummary {
  const byKind = {
    pack: 0,
    extension: 0,
    toolset: 0,
    channel: 0,
    workflow: 0,
    theme: 0,
    mcp: 0,
  } satisfies Record<MarketplaceEntryKind, number>;

  let featured = 0;
  let verified = 0;
  let installed = 0;
  let enabled = 0;

  for (const entry of entries) {
    byKind[entry.kind]++;
    if (entry.trust.featured) featured++;
    if (entry.trust.verified) verified++;
    if (entry.status !== 'available') installed++;
    if (entry.status === 'enabled') enabled++;
  }

  return {
    total: entries.length,
    byKind,
    featured,
    verified,
    installed,
    enabled,
  };
}

export async function buildMarketplaceCatalog(options: {
  hubPacks?: HubPackRow[];
  includeHubDb?: boolean;
  activePacks?: string[];
} = {}): Promise<MarketplaceEntry[]> {
  const builtin = buildBuiltinMarketplaceEntries();
  const byId = new Map<string, MarketplaceEntry>();
  for (const entry of builtin) {
    byId.set(entry.id, entry);
  }

  if (options.hubPacks) {
    for (const pack of options.hubPacks) {
      const id = marketplaceEntryId('pack', pack.name);
      byId.set(id, hubPackToEntry(pack));
    }
  }

  if (options.includeHubDb) {
    try {
      const rows = await listHubMarketplaceEntries();
      for (const row of rows) {
        const input = hubRowToMarketplaceInput(row);
        byId.set(input.id!, normalizeMarketplaceEntry(input));
      }
    } catch {
      // Hub DB optional for local-only catalog
    }
  }

  const extensions = await readExtensionStore();
  for (const ext of extensions) {
    const id = marketplaceEntryId('extension', ext.id);
    byId.set(id, normalizeMarketplaceEntry({
      kind: 'extension',
      slug: ext.id,
      name: ext.name,
      version: ext.version,
      description: `Installed extension (${ext.status})`,
      author: 'community',
      category: 'extensions',
      trust: {
        publisher: 'community',
        featured: false,
        verified: ext.eval_passed === true,
        validation: ext.eval_passed ? 'passed' : 'pending',
        risk: ext.health === 'fail' ? 'high' : 'medium',
        evalRequired: true,
      },
      install: { source: 'local', ref: ext.source ?? ext.id },
      status: ext.status === 'enabled' ? 'enabled' : ext.status === 'disabled' ? 'disabled' : 'installed',
      installedVersion: ext.version,
    }));
  }

  const localRows = await readMarketplaceStore();
  const activePacks = options.activePacks ?? config.carina.activePacks;
  const merged = applyLocalState([...byId.values()], localRows, activePacks);
  const errors = assertCatalogIntegrity(merged);
  if (errors.length > 0) {
    throw new Error(`Marketplace catalog integrity failed: ${errors.join('; ')}`);
  }
  return merged.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
}

export async function queryMarketplaceCatalog(
  filters: MarketplaceCatalogFilters = {},
  options?: Parameters<typeof buildMarketplaceCatalog>[0],
): Promise<{ entries: MarketplaceEntry[]; summary: MarketplaceCatalogSummary }> {
  const catalog = await buildMarketplaceCatalog(options);
  const entries = filterEntries(catalog, filters);
  return { entries, summary: summarizeMarketplaceCatalog(catalog) };
}

export async function getMarketplaceEntry(
  id: string,
  options?: Parameters<typeof buildMarketplaceCatalog>[0],
): Promise<MarketplaceEntry | undefined> {
  const catalog = await buildMarketplaceCatalog(options);
  return catalog.find((entry) => entry.id === id);
}
