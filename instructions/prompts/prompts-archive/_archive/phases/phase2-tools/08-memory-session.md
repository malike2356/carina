# Action: memory Tool + session-search Tool (Reinterpreted for Postgres/pgvector, Standalone Carina)

## Goal
Expose Carina's existing semantic-memory functions as a directly-callable `memory` tool (add/replace/remove with `user`/`memory` targets and length budgets), and build a new `session-search` tool - reinterpreted from the spec's SQLite-FTS5 design onto Carina's actual PostgreSQL + pgvector storage, using Postgres full-text search rather than introducing a second database engine.

## Context
- Project: `core.carinaai.uk`. Node.js 22 + TypeScript 5, ESM imports, pnpm, Vitest. Memory storage is **PostgreSQL 16 + pgvector** (`src/memory/db.ts`, `migrations.ts`, `store.ts`), NOT SQLite.
- **The spec describes a different storage engine and must be reinterpreted, not ported**: it specifies "FTS5-backed retrieval over SQLite message store" with an "indexed table on session_id, message_id, role, content." Carina has no SQLite anywhere (`grep -rln 'sqlite\|better-sqlite3\|FTS5' src/ package.json` returns nothing) and a working pgvector-based semantic search already (`searchMemory` in `store.ts` does cosine-similarity search over `episodic_memories.embedding`). PostgreSQL's built-in full-text search (`tsvector`/`tsquery`/`plainto_tsquery`/`ts_rank`, with a GIN index) is the direct, idiomatic equivalent of SQLite FTS5 - use that, not a new database.
- **Two real gaps exist here, scoped narrowly**:
  1. `saveMemory`/`searchMemory`/`deleteMemory`/`listRecentMemories` (in `store.ts`, read in full - 143 lines) exist as internal functions used by the orchestrator's auto-write path (`evaluateAndWriteSkill`), but there is **no LLM-callable `memory` tool** with the spec's `add`/`replace`/`remove` actions, `user`/`memory` targets, or length-budget enforcement (`grep -rln "'memory'" src/tools src/types` returns nothing as a tool name).
  2. `session_search` (full-text retrieval over past conversation transcripts, with the spec's three calling shapes: discovery/scroll/browse) does not exist in any form - this is a genuinely new feature requiring a new full-text index over conversation history.
- Read `src/memory/store.ts` (143 lines) and `src/memory/migrations.ts` (existing `episodic_memories` schema) fully before writing anything - the new tool must compose with this, not duplicate it.
- Conventions: functions under ~20 lines, Vitest mirroring `store.test.ts`, no em dashes/emojis, `.js` import specifiers.

## Files to create
- `src/tools/memory.ts` - the `memory` `Tool` (actions: `add`, `replace`, `remove`; targets: `user`, `memory`)
- `src/tools/memory.test.ts`
- `src/tools/session-search.ts` - the `session-search` `Tool` (discovery/scroll/browse shapes)
- `src/tools/session-search.test.ts`
- `src/memory/session-index.ts` - Postgres full-text search helpers over conversation history (the `searchSessions`/`getSessionWindow`/`browseRecentSessions` functions the tool calls)

## Files to modify
- `src/memory/migrations.ts` - add a `tsvector` column + GIN index to whatever table stores conversation messages (confirm which table this is - `episodic_memories` stores role/content/session_id already; check whether it IS the message store or a separate summarisation layer sits on top, by tracing how `getSessionHistory` is used in `router.ts`/`carina.ts`)
- `src/tools/index.ts` - register both tools

## Step-by-step

1. **Trace where conversation history actually lives** before designing the search index. `getSessionHistory(sessionId, limit)` in `store.ts` reads from `episodic_memories` - confirm whether this table holds the FULL message transcript (every user/assistant turn) or only curated "memory" entries (the function names suggest both roles are stored, but `saveMemory` is also called explicitly in the orchestrator's synthesis path with specific content - read `orchestrator.ts` lines ~155-157 again and confirm whether EVERY turn is saved or only some). `session_search` needs to search actual conversation transcripts; if `episodic_memories` doesn't hold complete transcripts, you may need a separate `session_messages` table, or the gap is larger than the spec assumes (full transcript persistence may not exist yet) - in which case say so plainly rather than building a search tool over incomplete data.

2. **Add full-text search to the message store** (whichever table step 1 identifies):
   ```sql
   ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS content_tsv tsvector
     GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
   CREATE INDEX IF NOT EXISTS episodic_memories_tsv_idx ON episodic_memories USING GIN (content_tsv);
   ```
   A generated, stored column keeps the index automatically in sync with `content` - no triggers to maintain, no drift risk. This is the direct Postgres equivalent of "FTS5-backed retrieval," done idiomatically.

3. Implement `src/memory/session-index.ts` with three functions matching the spec's three calling shapes:
   - `searchSessions(query, { limit, sort, roleFilter })`: `plainto_tsquery('english', query)` against `content_tsv`, `ts_rank` for relevance (or `ts_rank_cd` if phrase proximity matters), grouped/deduped by `session_id` (the spec's "dedupe by session lineage" - confirm whether Carina has a concept of session lineage/parent-child sessions at all; if not, dedupe by `session_id` alone and note the lineage concept doesn't exist yet). For each matched session, fetch `bookend_start` (first 3 messages by `created_at ASC`), `bookend_end` (last 3 by `created_at DESC`, re-sorted ascending), and a window of +/-5 messages around the best-matching message (`ts_headline` for the highlighted snippet - Postgres's direct equivalent of FTS5 snippet highlighting).
   - `getSessionWindow(sessionId, aroundMessageId, window)`: fetch `window` messages before and after the anchor by `id`/`created_at` ordering - a straightforward ranged query, no full-text involved.
   - `browseRecentSessions(limit)`: group by `session_id`, order by most recent message timestamp, return titles/previews/timestamps. ("Title" doesn't currently exist as a concept on a session - derive one, e.g. from the first user message, truncated, or note that session titling is itself a small new feature this tool needs.)

4. **Map FTS5 query syntax to `tsquery` syntax** in a small `translateQuerySyntax(input: string): string` function - the spec documents SQLite FTS5 operators (`OR`, quoted phrases, `NOT`, `deploy*` wildcards) which differ from Postgres `tsquery` syntax (`|`, `<->` for phrases, `!`, `:*` for prefix matching). Either translate the spec's documented syntax into `tsquery`'s, or - the simpler, more honest choice - use `websearch_to_tsquery` (Postgres 11+, available in PG16) which natively understands `OR`, quoted phrases, and `-exclude` syntax close to what users expect from a search box, and document to the LLM (in the tool description) which operators are actually supported rather than copying the spec's FTS5-specific documentation verbatim.

5. **Build the `memory` tool** (`memory.ts`) as a thin wrapper that adds the spec's missing semantics on top of existing `store.ts` functions:
   - `add`: calls `saveMemory(sessionId, target === 'user' ? ... : ..., content)` - check whether `saveMemory`'s `role` parameter is the right vehicle for "target" (`user` vs `memory`/agent-notes) or whether a new column/distinction is needed (the existing `Role` type is `user|assistant|system`-shaped, not `user-profile|agent-notes`-shaped - this is likely a real schema gap to close, e.g. a `target` or `kind` column on `episodic_memories`, or a separate small table for durable cross-session facts vs. episodic turn-by-turn history, since conflating "this is a fact about the user that should be injected into every future turn" with "this is one turn of one past conversation" seems like the wrong data model for the spec's stated behaviour: "Memory is injected into every future turn")
   - `replace`/`remove`: the spec identifies entries by `old_text`, not by ID - implement a fuzzy-match lookup (exact substring first, then a similarity threshold) against existing entries for the given target, and require a unique match before mutating (mirror `03-file-system.md`'s `patch` tool's "reject ambiguous matches" discipline)
   - **Enforce the length budgets** (2,200 chars for agent notes, 1,375 for user profile) by computing the running total for the target before allowing an `add`, and returning a clear "budget exceeded, consolidate first" error rather than silently truncating or silently growing past the documented limit (silent growth defeats the entire purpose of a budget meant to bound what's injected into every turn's context)

6. Write both test files (Vitest, mirror `store.test.ts`):
   - `memory.test.ts`: budget enforcement (an `add` that would exceed the limit is rejected with a clear message), `replace`/`remove` fuzzy-match uniqueness requirements, `target` routing to the correct underlying storage
   - `session-search.test.ts`: mock the database; test each of the three calling shapes produces the documented response shape, test `translateQuerySyntax`/`websearch_to_tsquery` choice against the spec's example queries (`"alpha OR beta"`, `"docker networking"`, `"python NOT java"`, `"deploy*"`), test deduplication doesn't drop genuinely-distinct sessions

## Expected behavior
- The agent can say "remember that I prefer concise responses" and have it land in the `user` target, respecting the character budget, retrievable and injected into future turns.
- `session-search(query: "auth refactor")` returns relevant past sessions with highlighted snippets and surrounding context, backed by a real Postgres GIN index (fast even over thousands of messages).
- `session-search(session_id: ..., around_message_id: ...)` lets the agent scroll through a specific past conversation.
- Budget violations are caught and reported clearly, never silently ignored.

## Test
```bash
cd core.carinaai.uk
pnpm vitest run src/tools/memory.test.ts src/tools/session-search.test.ts src/memory/session-index.ts
pnpm test
pnpm build
```

## Dependencies
- PostgreSQL 16 with the migration applied (generated `tsvector` column + GIN index)
- Resolution of the step-1 question (does full transcript persistence exist?) before `session-search` can be considered complete - if it doesn't, that's a prerequisite gap to close first, not a detail to paper over
- `pgvector` (already present) - `memory`'s semantic-add path continues to use embeddings via `saveMemory`/`embed`
