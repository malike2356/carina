# Meta-Skill: Cross-Ecosystem Skill Discovery; Implementation Prompt

> **REUSE RULE:** See `REUSE-RULES.md` (one level up). Competitor names appear here for context only. All implementation must use Carina's own voice, naming, and presentation. No competitor brand names in shipped code.


**Gap:** 05; Security / Cross-Agent Skill Consumption  
**Prompt:** 06 of 06  
**Agent (primary):** Cursor  
**Agent (fallback):** Claude Code  
**Estimated effort:** 5 days

---

## Context

Carina can now ingest skills from any ecosystem. But users don't know what skills exist in those ecosystems. They need a discovery layer; a unified search that indexes skills from every platform's public hubs and returns results from all of them.

The user types `carina skills search "security scanner"` and sees results from:
- CarinaHub (native)
- MCP server registries (tools)
- GitHub repositories with skill packs
- Hermes community hub
- OpenClaw public registry
- Cursor rules directories
- Any ecosystem with a public index

Carina becomes the discovery layer for the entire agent skill ecosystem. Not just a consumer. The index.

---

## What to Build

### 1. Source Connectors (`src/skills/cross-agent/discovery/sources/`)

Each connector is a thin wrapper that queries one ecosystem's public index and returns normalized results.

```typescript
// src/skills/cross-agent/discovery/types.ts

interface SkillSearchResult {
  name: string;
  description: string;
  version: string;
  source: string; // 'carina' | 'hermes-hub' | 'openclaw' | 'mcp' | 'github' | ...
  sourceUrl: string; // URL to the skill page or raw file
  installUrl: string; // URL or command to install
  author: string;
  rating?: number;
  downloads?: number;
  tags: string[];
  updatedAt: string;
  ingestible: boolean; // Can Carina ingest this directly?
  ingestMethod?: string; // 'mcp' | 'converter' | 'llm-fallback'
}

interface SourceConnector {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SkillSearchResult[]>;
  getSkill(name: string): Promise<SkillSearchResult | null>;
  health(): Promise<{ available: boolean; latency: number }>;
}
```

#### Connectors to build:

**`carina-hub.ts`**; CarinaHub
```
Endpoint: hub.carinaai.uk/api/v1/skills?q={query}
Returns: Native Carina skills
Ingest method: direct (already native)
```

**`mcp-registry.ts`**; MCP Server Registries
```
Sources:
  - github.com/modelcontextprotocol/servers (official MCP server list)
  - mcp.so (community MCP server directory)
  - npmjs.com/search?q=mcp-server (npm packages)
  - pypi.org/search?q=mcp-server (pip packages)
Returns: MCP tools
Ingest method: carina mcp connect
```

**`github-skills.ts`**; GitHub Skill Repositories
```
Search: GitHub code search for SKILL.md, .cursorrules, CLAUDE.md, agents.yaml
Sources:
  - github.com/NousResearch/hermes-agent/skills/
  - github.com/topics/cursor-rules
  - github.com/topics/claude-md
  - github.com/topics/crewai-agents
  - github.com/topics/ai-agent-skills
Returns: Skills found in public repos
Ingest method: converter or LLM fallback (auto-detected)
```

**`openclaw-hub.ts`**; OpenClaw Registry
```
Endpoint: registry.openclaw.dev/api/skills
Returns: OpenClaw skills
Ingest method: converter (generic-skill-md or openclaw-specific)
```

**`hermes-hub.ts`**; Hermes Community Hub
```
Endpoint: raw.githubusercontent.com/NousResearch/hermes-agent/main/skills/registry.json
Returns: Hermes skills
Ingest method: converter (generic-skill-md, 100% compatible)
```

**`pypi-packages.ts`**; PyPI MCP/AI Skill Packages
```
Search: pypi.org for packages tagged 'mcp-server', 'ai-skill', 'agent-tool'
Returns: Installable packages
Ingest method: pip install + MCP connect or converter
```

**`npm-packages.ts`**; npm MCP/AI Skill Packages
```
Search: npmjs.com for packages tagged 'mcp-server', 'ai-skill'
Returns: Installable packages
Ingest method: npx + MCP connect or converter
```

### 2. Unified Search Engine (`src/skills/cross-agent/discovery/search.ts`)

```typescript
// src/skills/cross-agent/discovery/search.ts

class CrossEcosystemSearch {
  private connectors: Map<string, SourceConnector> = new Map();

  constructor();
  registerConnector(connector: SourceConnector): void;

  async search(
    query: string,
    options?: {
      sources?: string[]; // Limit to specific ecosystems
      limit?: number; // Max results per source (default: 20)
      sort?: 'relevance' | 'rating' | 'downloads' | 'updated';
      onlyIngestible?: boolean; // Only show skills Carina can immediately ingest
    }
  ): Promise<{
    results: SkillSearchResult[];
    sources: Array<{ name: string; available: boolean; resultCount: number }>;
    totalResults: number;
    searchTime: number;
  }>;

  // Get details for a specific skill
  async getSkill(source: string, name: string): Promise<SkillSearchResult | null>;

  // Install a skill from search results
  async installSkill(result: SkillSearchResult): Promise<CarinaSkill>;
}
```

### 3. Search Result Caching

Cross-ecosystem search is expensive (multiple HTTP requests). Cache results:

```typescript
// Cache strategy:
// - Cache search results for 5 minutes
// - Cache skill details for 1 hour
// - Cache connector health checks for 10 minutes
// - Cache invalidation: user explicitly requests fresh search with --no-cache

interface SearchCache {
  get(key: string): SearchCacheEntry | undefined;
  set(key: string, entry: SearchCacheEntry, ttl: number): void;
  invalidate(pattern: string): void;
}
```

### 4. CLI Commands

```bash
# Search across ALL ecosystems
carina skills search "security scanner" --all
  CarinaHub (12 results)
    carina-nuclei-scanner        v2.1.0     (1.2K)   Native
    carina-nmap-scanner          v1.5.0     (890)    Native
    ...
  MCP Tools (4 results)
    security-scanner             v1.0.0; MCP server
    vuln-db                      v2.3.0; MCP server
    ...
  GitHub (23 results)
    advanced-security-scanner    v3.1.0     (340)   .cursorrules
    enterprise-vuln-mgmt         v1.0.0     (45)    agents.yaml
    ...
  Hermes Hub (3 results)
    hermes-nmap-scanner          v2.1.0     (156)   Skill MD
    ...
  OpenClaw Registry (1 result)
    openclaw-network-recon       v3.0.1     (312)   Skill MD
    ...
  PyPI (6 results)
    mcp-server-security          v1.2.0; pip package
    ...

  Total: 49 results across 6 ecosystems. Search took 1.2s.

# Search a specific ecosystem
carina skills search "nmap" --hub github
carina skills search "postgres" --hub mcp

# Install directly from search results
carina skills install --result 3     # Install result #3 from last search

# Show skill details from any ecosystem
carina skills info --source github advanced-security-scanner

# List available source connectors and their health
carina skills sources
  carina-hub         connected    12ms
  mcp-registry       connected    45ms
  github-skills      connected    230ms (rate limited: 58/60 remaining)
  openclaw-hub       connected    89ms
  hermes-hub         connected    120ms
  pypi-packages      connected    340ms
  npm-packages       connected    180ms
```

### 5. TUI Integration

In the Ink Chat TUI, the model picker overlay gains a "Skills" tab:
- Shows trending skills across all ecosystems
- Filter by ecosystem
- One-click install
- Preview skill content before installing

### 6. Periodic Indexing (Background)

Carina's cron scheduler periodically indexes all connected ecosystems and updates a local search index. This makes repeated searches fast (sub-100ms for cached results):

```typescript
// Cron job: every 6 hours
carina skills index --all

// Updates local SQLite index at ~/.carina/skills-index.db
// Indexes: name, description, tags, source, rating, downloads
// Full-text search via SQLite FTS5
```

---

## Files to Create

```
core.carinaai.uk/src/skills/cross-agent/discovery/
  types.ts                       SkillSearchResult, SourceConnector, SearchOptions
  search.ts                      CrossEcosystemSearch engine
  cache.ts                       Search result caching
  indexer.ts                     Periodic indexing + local FTS5 database
  sources/
    carina-hub.ts                CarinaHub connector
    mcp-registry.ts              MCP server registries connector
    github-skills.ts             GitHub code search connector
    openclaw-hub.ts              OpenClaw registry connector
    hermes-hub.ts                Hermes community hub connector
    pypi-packages.ts             PyPI packages connector
    npm-packages.ts              npm packages connector

core.carinaai.uk/src/cli/commands/
  skills-search.ts               search, info, sources commands
  skills-install.ts              install --result flag
```

## Files to Modify

```
core.carinaai.uk/src/cli/registry.ts           Register skills search/info/sources
core.carinaai.uk/src/tui/ink/components/       Add Skills tab to model picker overlay
core.carinaai.uk/src/cron/jobs.ts               Add periodic index job
```

---

## Done-When Criteria

- [ ] `carina skills search "security" --all` returns results from 5+ ecosystems
- [ ] Each ecosystem connector returns results in < 500ms
- [ ] GitHub connector respects rate limits and reports remaining quota
- [ ] MCP connector discovers tools from official MCP registry + mcp.so + npm + PyPI
- [ ] `carina skills install --result N` installs the skill from search results
- [ ] `carina skills info --source github <name>` shows skill details
- [ ] `carina skills sources` shows all connectors with health status
- [ ] Search results are cached for 5 minutes. `--no-cache` bypasses cache.
- [ ] Periodic index cron job runs every 6 hours and updates local FTS5 database
- [ ] TUI Skills tab shows trending skills from all ecosystems
- [ ] At least 3 ecosystems contribute results to a typical search query

---

## Performance Targets

| Operation | Target | Acceptable |
|-----------|--------|------------|
| Single ecosystem search | < 500ms | < 2s |
| All ecosystems search | < 3s | < 8s |
| Cached search (local index) | < 50ms | < 200ms |
| Skill install from search | < 5s | < 15s |
| Periodic full index | < 60s | < 5min |

---

## Future: Skill Recommendations

Post-MVP, add a recommendation engine:
- "Users who installed X also installed Y"
- "Trending this week in the Cursor ecosystem"
- "Skills similar to your existing installed skills"
- "New skills since your last search"
- Weekly digest: "5 new skills you might like"

This turns cross-ecosystem discovery from a search tool into a discovery platform. Carina knows what skills exist across every ecosystem. It can make recommendations no single-ecosystem agent can.