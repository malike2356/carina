import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

export const pypiPackagesConnector: SourceConnector = {
  name: 'pypi-packages',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    try {
      const url = `https://pypi.org/search/?q=${encodeURIComponent(`mcp-server ${query}`)}&format=json`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json() as { results?: Array<{ name: string; version: string; description?: string }> };
      return (data.results ?? []).slice(0, limit).map((pkg) => ({
        name: pkg.name,
        description: pkg.description ?? 'PyPI AI/MCP package',
        version: pkg.version ?? '1.0.0',
        source: 'pypi',
        sourceUrl: `https://pypi.org/project/${pkg.name}/`,
        installUrl: pkg.name,
        author: 'PyPI',
        tags: ['pypi', 'mcp-server'],
        updatedAt: new Date().toISOString(),
        ingestible: true,
        ingestMethod: 'mcp',
      }));
    } catch {
      return [];
    }
  },

  async getSkill(name: string): Promise<SkillSearchResult | null> {
    const rows = await this.search(name, { limit: 20 });
    return rows.find((r) => r.name === name) ?? null;
  },

  async health(): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();
    try {
      const res = await fetch('https://pypi.org/search/?q=carina&format=json', { signal: AbortSignal.timeout(5000) });
      return { available: res.ok, latency: Date.now() - start };
    } catch {
      return { available: false, latency: Date.now() - start };
    }
  },
};
