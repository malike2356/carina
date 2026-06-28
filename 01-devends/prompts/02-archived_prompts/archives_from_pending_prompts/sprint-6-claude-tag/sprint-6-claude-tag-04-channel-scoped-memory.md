# Sprint 6 -- Prompt 04: Channel-Scoped Memory

**Sprint:** 6 -- Channel-Aware Team Agent
**Prompt number:** 04 of 05
**Name:** Tag memory entries with channel source, scoped recall per channel
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 02-channel-context-ingestion.md (facts must be stored with scope)

---

## Read first

1. Master index: `sprint-6-claude-tag-00-master.md`
2. `02-backends/core.carinaai.uk/src/memory/backends/types.ts` -- memory entry types
3. `02-backends/core.carinaai.uk/src/memory/backends/postgres.ts` or `sqlite.ts`
4. `02-backends/core.carinaai.uk/src/agents/system-prompt.ts` -- where memory is injected

---

## Context

Facts extracted from channels (prompt 02) are stored in memory. But when
Carina responds to an @mention, it needs to pull the RIGHT context -- the
channel the mention came from, not all channels mashed together.

Claude Tag calls this "scoped identities": a Claude set up for sales
doesn't pass memories to the Claude set up for engineering. Carina
implements this via channel-scoped memory.

---

## Goal

### Step 1: Extend Memory Schema

Add a `scope` field to memory entries. This tags every entry with where
it came from.

```typescript
// In memory/backends/types.ts, extend MemoryEntry:

export interface MemoryEntry {
  id: string;
  type: 'user_preference' | 'fact' | 'decision' | 'channel_context' | 'rem_promotion';
  content: string;
  summary?: string;
  scope?: string; // NEW: "channel:C12345" or "global" or "user:<id>"
  scopeName?: string; // NEW: human-readable name like "#engineering"
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
  // existing fields...
}

// Scopes:
// - "global" -- applies to all channels (user preferences, standing orders)
// - "channel:<slack_channel_id>" -- scoped to one Slack channel
// - "user:<user_id>" -- scoped to one user
```

### Step 2: Scoped Memory Queries

```typescript
// In memory/backends/postgres.ts (or sqlite.ts depending on active backend):

interface MemoryQueryOptions {
  type?: string;
  scope?: string; // Exact scope match
  scopePrefix?: string; // Prefix match (e.g., "channel:" for ALL channels)
  scopeNot?: string; // Exclude this scope
  orderBy?: string;
  order?: 'ASC' | 'DESC';
  limit?: number;
  search?: string;
}

async function queryMemory(opts: MemoryQueryOptions): Promise<MemoryEntry[]> {
  let sql = 'SELECT * FROM memory_entries WHERE 1=1';
  const params: any[] = [];

  if (opts.type) {
    params.push(opts.type);
    sql += ` AND type = $${params.length}`;
  }

  if (opts.scope) {
    params.push(opts.scope);
    sql += ` AND scope = $${params.length}`;
  }

  if (opts.scopePrefix) {
    params.push(opts.scopePrefix + '%');
    sql += ` AND scope LIKE $${params.length}`;
  }

  if (opts.scopeNot) {
    params.push(opts.scopeNot);
    sql += ` AND scope != $${params.length}`;
  }

  if (opts.search) {
    params.push(`%${opts.search}%`);
    sql += ` AND (content ILIKE $${params.length} OR summary ILIKE $${params.length})`;
  }

  sql += ` ORDER BY ${opts.orderBy || 'updated_at'} ${opts.order || 'DESC'}`;

  if (opts.limit) {
    params.push(opts.limit);
    sql += ` LIMIT $${params.length}`;
  }

  return db.query(sql, params);
}
```

### Step 3: Context Injection by Channel

When Carina responds to a channel @mention, inject only the channel-scoped
context for THAT channel plus global context:

```typescript
// In agents/system-prompt.ts, add channel context injection:

async function buildChannelContextSection(
  channelId: string,
  channelName: string,
  memoryStore: MemoryBackend,
): Promise<string> {
  // Get channel-specific facts, newest first
  const channelFacts = await memoryStore.query({
    type: 'channel_context',
    scope: `channel:${channelId}`,
    orderBy: 'extracted_at',
    order: 'DESC',
    limit: 15,  // Don't overwhelm the context window
  });

  if (channelFacts.length === 0) return '';

  // Group by fact type
  const deadlines = channelFacts.filter(f => f.metadata?.factType === 'deadline');
  const decisions = channelFacts.filter(f => f.metadata?.factType === 'decision');
  const blockers = channelFacts.filter(f => f.metadata?.factType === 'blocker');
  const statuses = channelFacts.filter(f => f.metadata?.factType === 'status_update');
  const other = channelFacts.filter(f =>
    !['deadline', 'decision', 'blocker', 'status_update'].includes(f.metadata?.factType)
  );

  const lines = ['', `## Channel Context (${channelName})`, ''];

  if (deadlines.length > 0) {
    lines.push('### Upcoming Deadlines');
    for (const d of deadlines) {
      lines.push(`- ${d.summary} (${d.metadata?.entities?.dates?.[0] || 'date TBD'})`);
    }
    lines.push('');
  }

  if (decisions.length > 0) {
    lines.push('### Recent Decisions');
    for (const d of decisions) {
      lines.push(`- ${d.summary}`);
    }
    lines.push('');
  }

  if (blockers.length > 0) {
    lines.push('### Active Blockers');
    for (const b of blockers) {
      lines.push(`- ${b.summary}`);
    }
    lines.push('');
  }

  if (statuses.length > 0) {
    lines.push('### Recent Status Updates');
    for (const s of statuses.slice(0, 5)) {
      lines.push(`- ${s.summary}`);
    }
    lines.push('');
  }

  if (other.length > 0) {
    lines.push('### Other Context');
    for (const o of other.slice(0, 5)) {
      lines.push(`- ${o.summary}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// Then in the system prompt assembly:
// Add channel context section AFTER workspace context but BEFORE tool definitions
// Only when responding to a channel @mention (not DM)
```

### Step 4: Cross-Channel Context (Optional, Gated)

When answering a question in one channel, optionally pull relevant facts
from other channels. Gated behind a config flag:

```typescript
const CROSS_CHANNEL_ENABLED = process.env.CARINA_AMBIENT_CROSS_CHANNEL === 'true';

if (CROSS_CHANNEL_ENABLED) {
  // Search ALL channels for facts relevant to the current query
  const crossFacts = await memoryStore.query({
    type: 'channel_context',
    scopeNot: `channel:${channelId}`,  // exclude current channel
    search: userMessage,               // search relevance
    limit: 5,
  });

  if (crossFacts.length > 0) {
    lines.push('### Relevant Updates from Other Channels');
    lines.push('(Cross-channel context -- verify before acting)');
    for (const f of crossFacts) {
      lines.push(`- [${f.scopeName}] ${f.summary}`);
    }
  }
}
```

### Step 5: Memory Dashboard (Admin)

Add a view to the Scout console showing per-channel memory:

```
GET /api/admin/channel-memory?channel=C12345
  Returns: all facts for this channel, grouped by type, with staleness

GET /api/admin/channel-memory/stats
  Returns: per-channel fact counts, staleness distribution, storage usage

POST /api/admin/channel-memory/C12345/purge
  Delete all channel-scoped memory for a channel (GDPR right-to-delete)
```

---

## Testing

```typescript
// tests/memory/scoped-memory.test.ts
describe('Scoped Memory', () => {
  it('stores facts with channel scope');
  it('queries facts by exact scope');
  it('queries facts by scope prefix');
  it('excludes scope with scopeNot');
  it('searches across scopes');
  it('limits results per query');
  it('builds channel context section for system prompt');
  it('only includes channel-scoped facts, not other channels');
  it('optionally includes cross-channel context');
  it('purges channel memory on GDPR request');
});
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/memory/backends/types.ts` -- add scope field
- `02-backends/core.carinaai.uk/src/memory/backends/postgres.ts` -- scoped queries
- `02-backends/core.carinaai.uk/src/memory/backends/sqlite.ts` -- scoped queries
- `02-backends/core.carinaai.uk/src/agents/system-prompt.ts` -- inject channel context
- `02-backends/core.carinaai.uk/src/db/migrations/` -- add scope column to memory_entries
