import { fetchHubSkills, hubBaseUrl } from '../../../hub/hub-client.js';
import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

export const carinaHubConnector: SourceConnector = {
  name: 'carina-hub',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    try {
      const skills = await fetchHubSkills({ q: query, limit });
      return skills.map((s) => ({
        name: s.name,
        description: s.description ?? '',
        version: '1.0.0',
        source: 'carina',
        sourceUrl: `${hubBaseUrl()}/skills/${encodeURIComponent(s.name)}`,
        installUrl: `${hubBaseUrl()}/skills/${encodeURIComponent(s.name)}`,
        author: s.pack_name ?? 'CarinaHub',
        tags: s.triggers ?? [],
        updatedAt: s.created_at ?? new Date().toISOString(),
        ingestible: true,
        ingestMethod: 'native' as const,
      })).slice(0, limit);
    } catch {
      return [];
    }
  },

  async getSkill(name: string): Promise<SkillSearchResult | null> {
    const rows = await this.search(name, { limit: 5 });
    return rows.find((r: SkillSearchResult) => r.name === name) ?? rows[0] ?? null;
  },

  async health(): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();
    try {
      await fetch(`${hubBaseUrl()}/api/registry`, { signal: AbortSignal.timeout(5000) });
      return { available: true, latency: Date.now() - start };
    } catch {
      return { available: false, latency: Date.now() - start };
    }
  },
};
