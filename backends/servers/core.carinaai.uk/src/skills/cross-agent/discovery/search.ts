import { ingestSkill } from '../pipeline.js';
import type { CarinaSkill } from '../types.js';
import { carinaHubConnector } from './sources/carina-hub.js';
import { githubSkillsConnector } from './sources/github-skills.js';
import { hermesHubConnector } from './sources/hermes-hub.js';
import { mcpRegistryConnector } from './sources/mcp-registry.js';
import { npmPackagesConnector } from './sources/npm-packages.js';
import { openclawHubConnector } from './sources/openclaw-hub.js';
import { pypiPackagesConnector } from './sources/pypi-packages.js';
import { DETAIL_TTL_MS, HEALTH_TTL_MS, searchCache, SEARCH_TTL_MS } from './cache.js';
import type { SearchOptions, SkillSearchResult, SourceConnector } from './types.js';

let lastSearchResults: SkillSearchResult[] = [];

export function getLastSearchResults(): SkillSearchResult[] {
  return lastSearchResults;
}

export class CrossEcosystemSearch {
  private connectors: Map<string, SourceConnector>;

  constructor() {
    this.connectors = new Map<string, SourceConnector>([
      [carinaHubConnector.name, carinaHubConnector],
      [hermesHubConnector.name, hermesHubConnector],
      [openclawHubConnector.name, openclawHubConnector],
      [mcpRegistryConnector.name, mcpRegistryConnector],
      [githubSkillsConnector.name, githubSkillsConnector],
      [npmPackagesConnector.name, npmPackagesConnector],
      [pypiPackagesConnector.name, pypiPackagesConnector],
    ]);
  }

  registerConnector(connector: SourceConnector): void {
    this.connectors.set(connector.name, connector);
  }

  listConnectors(): SourceConnector[] {
    return [...this.connectors.values()];
  }

  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<{
    results: SkillSearchResult[];
    sources: Array<{ name: string; available: boolean; resultCount: number; latency?: number }>;
    totalResults: number;
    searchTime: number;
  }> {
    const started = Date.now();
    const cacheKey = `search:${query}:${(options.sources ?? []).join(',')}:${options.limit ?? 20}`;
    if (!options.noCache) {
      const cached = searchCache.get<SkillSearchResult[]>(cacheKey);
      if (cached) {
        lastSearchResults = cached;
        return {
          results: cached,
          sources: [],
          totalResults: cached.length,
          searchTime: Date.now() - started,
        };
      }
    }

    const selected = options.sources?.length
      ? options.sources.map((s) => this.connectors.get(s)).filter(Boolean) as SourceConnector[]
      : [...this.connectors.values()];

    const perSource = await Promise.all(
      selected.map(async (connector) => {
        const rows = await connector.search(query, options);
        const health = await connector.health();
        return { connector, rows, health };
      }),
    );

    let results = perSource.flatMap((entry) => entry.rows);
    if (options.onlyIngestible) {
      results = results.filter((r) => r.ingestible);
    }

    if (options.sort === 'rating') {
      results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (options.sort === 'downloads') {
      results.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
    } else if (options.sort === 'updated') {
      results.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    }

    searchCache.set(cacheKey, results, SEARCH_TTL_MS);
    lastSearchResults = results;

    return {
      results,
      sources: perSource.map(({ connector, rows, health }) => ({
        name: connector.name,
        available: health.available,
        resultCount: rows.length,
        latency: health.latency,
      })),
      totalResults: results.length,
      searchTime: Date.now() - started,
    };
  }

  async getSkill(source: string, name: string): Promise<SkillSearchResult | null> {
    const cacheKey = `skill:${source}:${name}`;
    const cached = searchCache.get<SkillSearchResult>(cacheKey);
    if (cached) return cached;

    const connector = this.connectors.get(source);
    if (!connector) return null;
    const skill = await connector.getSkill(name);
    if (skill) searchCache.set(cacheKey, skill, DETAIL_TTL_MS);
    return skill;
  }

  async connectorHealth(): Promise<Array<{ name: string; available: boolean; latency: number }>> {
    const out: Array<{ name: string; available: boolean; latency: number }> = [];
    for (const connector of this.connectors.values()) {
      const cacheKey = `health:${connector.name}`;
      const cached = searchCache.get<{ available: boolean; latency: number }>(cacheKey);
      if (cached) {
        out.push({ name: connector.name, ...cached });
        continue;
      }
      const health = await connector.health();
      searchCache.set(cacheKey, health, HEALTH_TTL_MS);
      out.push({ name: connector.name, ...health });
    }
    return out;
  }

  async installSkill(result: SkillSearchResult): Promise<CarinaSkill> {
    if (result.ingestMethod === 'mcp') {
      const { connectMcpFromInstallUrl } = await import('../../../mcp/connect-helper.js');
      await connectMcpFromInstallUrl(result.name, result.installUrl);
      return {
        name: result.name,
        version: result.version,
        description: result.description,
        category: 'mcp-native',
        tags: result.tags,
        platforms: ['linux', 'macos', 'windows'],
        source: {
          hub: 'mcp',
          url: result.sourceUrl,
          originalFormat: 'mcp-server',
          convertedAt: new Date().toISOString(),
          converterVersion: 'mcp-native-1.0.0',
        },
        tools: { required: [], optional: [] },
        triggers: [],
        dependencies: [],
        permissions: { network: true, filesystem: [], shell: false, mcpTools: [result.name] },
        content: `MCP tool connected: ${result.name}`,
      };
    }

    const ingested = await ingestSkill(result.installUrl || result.sourceUrl, { hub: result.source });
    return ingested.skill;
  }
}
