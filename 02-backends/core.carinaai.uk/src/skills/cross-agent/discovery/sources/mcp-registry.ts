import type { SearchOptions, SkillSearchResult, SourceConnector } from '../types.js';

const MCP_SERVERS_URL =
  'https://raw.githubusercontent.com/modelcontextprotocol/servers/main/README.md';

export const mcpRegistryConnector: SourceConnector = {
  name: 'mcp-registry',

  async search(query: string, options: SearchOptions = {}): Promise<SkillSearchResult[]> {
    const limit = options.limit ?? 20;
    const q = query.toLowerCase();
    const results: SkillSearchResult[] = [];

    try {
      const res = await fetch(MCP_SERVERS_URL, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        const text = await res.text();
        for (const match of text.matchAll(/^###\s+(.+)$/gm)) {
          const name = match[1].trim();
          if (q && !name.toLowerCase().includes(q) && !text.toLowerCase().includes(q)) continue;
          results.push({
            name: name.toLowerCase().replace(/\s+/g, '-'),
            description: `Official MCP server: ${name}`,
            version: '1.0.0',
            source: 'mcp',
            sourceUrl: 'https://github.com/modelcontextprotocol/servers',
            installUrl: `@modelcontextprotocol/server-${name.toLowerCase().replace(/\s+/g, '-')}`,
            author: 'MCP Official',
            tags: ['mcp', 'tool'],
            updatedAt: new Date().toISOString(),
            ingestible: true,
            ingestMethod: 'mcp',
          });
          if (results.length >= limit) break;
        }
      }
    } catch {
      // continue to npm
    }

    if (results.length < limit) {
      try {
        const npmUrl = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(`mcp-server ${query}`)}&size=${limit}`;
        const npmRes = await fetch(npmUrl, { signal: AbortSignal.timeout(8000) });
        if (npmRes.ok) {
          const npmData = await npmRes.json() as { objects?: Array<{ package: { name: string; description?: string; version?: string } }> };
          for (const obj of npmData.objects ?? []) {
            const pkg = obj.package;
            results.push({
              name: pkg.name,
              description: pkg.description ?? 'npm MCP server package',
              version: pkg.version ?? '1.0.0',
              source: 'mcp',
              sourceUrl: `https://www.npmjs.com/package/${pkg.name}`,
              installUrl: pkg.name,
              author: 'npm',
              tags: ['mcp', 'npm'],
              updatedAt: new Date().toISOString(),
              ingestible: true,
              ingestMethod: 'mcp',
            });
            if (results.length >= limit) break;
          }
        }
      } catch {
        // ignore
      }
    }

    return results.slice(0, limit);
  },

  async getSkill(name: string): Promise<SkillSearchResult | null> {
    const rows = await this.search(name, { limit: 20 });
    return rows.find((r) => r.name === name || r.installUrl === name) ?? null;
  },

  async health(): Promise<{ available: boolean; latency: number }> {
    const start = Date.now();
    try {
      const res = await fetch(MCP_SERVERS_URL, { signal: AbortSignal.timeout(5000) });
      return { available: res.ok, latency: Date.now() - start };
    } catch {
      return { available: false, latency: Date.now() - start };
    }
  },
};
