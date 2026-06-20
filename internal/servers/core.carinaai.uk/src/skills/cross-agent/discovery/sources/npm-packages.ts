import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

export const npmPackagesConnector: SourceConnector = {
  name: 'npm-packages',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    try {
      const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`ai-skill ${query}`)}&size=${limit}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json() as { objects?: Array<{ package: { name: string; description?: string; version?: string } }> };
      return (data.objects ?? []).slice(0, limit).map((obj) => ({
        name: obj.package.name,
        description: obj.package.description ?? 'npm AI skill package',
        version: obj.package.version ?? '1.0.0',
        source: 'npm',
        sourceUrl: `https://www.npmjs.com/package/${obj.package.name}`,
        installUrl: obj.package.name,
        author: 'npm',
        tags: ['npm', 'ai-skill'],
        updatedAt: new Date().toISOString(),
        ingestible: true,
        ingestMethod: 'llm-fallback',
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
      const res = await fetch('https://registry.npmjs.org/-/ping', { signal: AbortSignal.timeout(5000) });
      return { available: res.ok, latency: Date.now() - start };
    } catch {
      return { available: false, latency: Date.now() - start };
    }
  },
};
