import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

const SKILL_FILENAMES = ['SKILL.md', '.cursorrules', 'CLAUDE.md', 'agents.yaml'];

export const githubSkillsConnector: SourceConnector = {
  name: 'github-skills',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'carina-agent',
    };
    if (token) headers.Authorization = `Bearer ${token}`;

    const results: SkillSearchResult[] = [];
    for (const filename of SKILL_FILENAMES) {
      if (results.length >= limit) break;
      const q = `${query} filename:${filename}`;
      try {
        const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=${Math.min(limit, 30)}`;
        const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
        if (!res.ok) continue;
        const data = await res.json() as {
          items?: Array<{
            name: string;
            path: string;
            html_url: string;
            repository: { full_name: string };
          }>;
        };
        for (const item of data.items ?? []) {
          const rawUrl = `https://raw.githubusercontent.com/${item.repository.full_name}/HEAD/${item.path}`;
          results.push({
            name: item.path.split('/').pop()?.replace(/\.(md|yaml|cursorrules)$/i, '') ?? item.name,
            description: `GitHub skill file in ${item.repository.full_name}`,
            version: '1.0.0',
            source: 'github',
            sourceUrl: item.html_url,
            installUrl: rawUrl,
            author: item.repository.full_name,
            tags: ['github', filename.toLowerCase()],
            updatedAt: new Date().toISOString(),
            ingestible: true,
            ingestMethod: 'converter',
          });
          if (results.length >= limit) break;
        }
      } catch {
        // try next filename
      }
    }
    return results;
  },

  async getSkill(name: string): Promise<SkillSearchResult | null> {
    const rows = await this.search(name, { limit: 30 });
    return rows.find((r) => r.name === name) ?? null;
  },

  async health(): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();
    try {
      const res = await fetch('https://api.github.com/rate_limit', {
        headers: { 'User-Agent': 'carina-agent' },
        signal: AbortSignal.timeout(5000),
      });
      return { available: res.ok, latency: Date.now() - start };
    } catch {
      return { available: false, latency: Date.now() - start };
    }
  },
};
