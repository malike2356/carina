import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

const REGISTRY_URL =
  process.env.CARINA_EXTERNAL_SKILLS_REGISTRY_URL?.trim()
  ?? 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills/registry.json';

const SKILL_BASE_URL =
  process.env.CARINA_EXTERNAL_SKILLS_SKILL_BASE_URL?.trim()
  ?? 'https://raw.githubusercontent.com/NousResearch/hermes-agent/main/skills';

type ExternalRegistryEntry = {
  name?: string;
  description?: string;
  version?: string;
  url?: string;
};

export const externalSkillsHubConnector: SourceConnector = {
  name: 'external-skills-hub',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    const q = query.toLowerCase();
    try {
      const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) return [];
      const data = await res.json() as { skills?: ExternalRegistryEntry[] } | ExternalRegistryEntry[];
      const skills = Array.isArray(data) ? data : (data.skills ?? []);
      return skills
        .filter((s) => {
          const name = String(s.name ?? '');
          const desc = String(s.description ?? '');
          return name.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
        })
        .slice(0, limit)
        .map((s) => {
          const name = String(s.name ?? 'unknown');
          const installUrl = s.url ?? `${SKILL_BASE_URL}/${name}/SKILL.md`;
          return {
            name,
            description: String(s.description ?? ''),
            version: String(s.version ?? '1.0.0'),
            source: 'external-skills-hub',
            sourceUrl: installUrl,
            installUrl,
            author: 'External YAML/MD registry',
            tags: ['compat-agent', 'skill-md'],
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
