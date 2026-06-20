import { buildMarketplaceCatalog, summarizeMarketplaceCatalog } from './marketplace-catalog.js';
import { listHubPacks, getRegistrySummary } from './registry.js';

export type EcosystemMetrics = {
  generatedAt: string;
  marketplace: {
    total: number;
    packs: number;
    extensions: number;
    channels: number;
    mcp: number;
    featured: number;
    verified: number;
    community: number;
  };
  hubPacks: {
    total: number;
    featured: number;
    categories: string[];
  };
  proof: {
    categoryClaim: string;
    measurableOutcomes: string[];
  };
};

export async function buildEcosystemMetrics(): Promise<EcosystemMetrics> {
  let hubPacks: Awaited<ReturnType<typeof listHubPacks>> = [];
  let registry = { packCount: 0, skillCount: 0, categories: [] as string[] };
  try {
    hubPacks = await listHubPacks();
    registry = await getRegistrySummary();
  } catch {
    // local-only mode
  }

  const catalog = await buildMarketplaceCatalog({ hubPacks, includeHubDb: true });
  const summary = summarizeMarketplaceCatalog(catalog);

  const byKind = (kind: string) => catalog.filter((e) => e.kind === kind).length;
  const community = catalog.filter((e) => e.trust.publisher === 'community').length;

  return {
    generatedAt: new Date().toISOString(),
    marketplace: {
      total: summary.total,
      packs: byKind('pack'),
      extensions: byKind('extension'),
      channels: byKind('channel'),
      mcp: byKind('mcp'),
      featured: summary.featured,
      verified: summary.verified,
      community,
    },
    hubPacks: {
      total: hubPacks.length || registry.packCount,
      featured: hubPacks.filter((p) => p.featured).length,
      categories: registry.categories,
    },
    proof: {
      categoryClaim: 'The agent platform you can trust in production',
      measurableOutcomes: [
        `${summary.total} marketplace entries discoverable via carina hub`,
        `${registry.skillCount} indexed hub skills`,
        `${summary.verified} verified marketplace entries`,
        'Cross-agent skill sharing with hub sync',
        'MIT kernel with optional Scout security layer',
      ],
    },
  };
}
