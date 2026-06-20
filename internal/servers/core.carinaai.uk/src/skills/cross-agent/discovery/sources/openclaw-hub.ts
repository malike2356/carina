import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

const REGISTRY_URL = 'https://registry.openclaw.dev/api/skills';

type OpenClawEntry = {
  name?: string;
  description?: string;
  version?: string;
  download_url?: string;
  url?: string;
};

export const openclawHubConnector: SourceConnector = {
  name: 'openclaw-hub',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    const q = query.toLowerCase();
    try {
      const url = `${REGISTRY_URL}?q=${encodeURIComponent(query)}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json() as OpenClawEntry[] | { skills?: OpenClawEntry[] };
      const skills = Array.isArray(data) ? data : (data.skills ?? []);
      return skills
        .filter((s) => {
          const name = String(s.name ?? '');
          const desc = String(s.description ?? '');
          return !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
        })
        .slice(0, limit)
        .map((s) => {
          const name = String(s.name ?? 'unknown');
          const installUrl = s.download_url ?? s.url ?? `${REGISTRY_URL}/${encodeURIComponent(name)}/download`;
          return {
            name,
            description: String(s.description ?? ''),
            version: String(s.version ?? '1.0.0'),
            source: 'openclaw-hub',
            sourceUrl: installUrl,
            installUrl,
            author: 'OpenClaw Registry',
            tags: ['openclaw'],
            updatedAt: new Date().toISOString(),
            ingestible: true,
            ingestMethod: 'converter',
          } satisfies SkillSearchResult;
        });
    } catch {
      return [];
    }
  },

  async getSkill(name: string): Promise<SkillSearchResult | null> {
    const rows = await this.search(name, { limit: 50 });
    return rows.find((r) => r.name === name) ?? null;
  },

  async health(): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();
    try {
      const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) });
      return { available: res.ok, latency: Date.now() - start };
    } catch {
      return { available: false, latency: Date.now() - start };
    }
  },
};
