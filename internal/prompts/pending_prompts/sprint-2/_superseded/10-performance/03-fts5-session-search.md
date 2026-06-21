# Prompt 03: Full-Text Session Search


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

As session history grows, operators need to find past conversations by content. "Find the
session where we discussed the nginx CVE" should return results instantly. PostgreSQL has
built-in full-text search via `tsvector`. This prompt adds an FTS index on sessions and
memories and surfaces it via a search API.

## What to Build

### 1. FTS index on sessions and memories

```sql
-- Sessions: index on message content
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS sessions_fts_idx ON sessions USING GIN(fts_vector);

-- Trigger to update fts_vector when messages change
CREATE OR REPLACE FUNCTION update_session_fts() RETURNS trigger AS $$
BEGIN
  NEW.fts_vector := to_tsvector('english', COALESCE(NEW.title, '') || ' ' || COALESCE(NEW.messages::text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_fts_trigger
  BEFORE INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_session_fts();

-- Memories: index on title + content
ALTER TABLE memories ADD COLUMN IF NOT EXISTS fts_vector tsvector;

CREATE INDEX IF NOT EXISTS memories_fts_idx ON memories USING GIN(fts_vector);
```

### 2. Search API

In `src/api/search.ts`:
```typescript
export async function searchSessions(query: string, userId: string, limit = 20): Promise<SearchResult[]> {
  const results = await db.query(
    `SELECT id, title, ts_rank(fts_vector, query) as rank,
            ts_headline('english', title, query, 'MaxWords=20,MinWords=5') as snippet
     FROM sessions, to_tsquery('english', $1) as query
     WHERE fts_vector @@ query AND user_id = $2
     ORDER BY rank DESC
     LIMIT $3`,
    [processQuery(query), userId, limit]
  );
  return results.rows;
}

export async function searchMemories(query: string, userId: string, limit = 20): Promise<SearchResult[]> {
  // same pattern for memories table
}

// Convert user query to tsquery: "nginx CVE" -> "nginx & CVE"
function processQuery(raw: string): string {
  return raw.trim().split(/\s+/).join(' & ');
}
```

### 3. Combined search endpoint

```
GET /api/search?q=nginx+CVE&type=all|sessions|memories&limit=20

Response:
{
  "sessions": [
    { "id": "...", "title": "Security scan discussion", "snippet": "...nginx CVE-2026-1844...", "date": "..." }
  ],
  "memories": [
    { "id": "...", "title": "CVE investigation notes", "snippet": "...", "date": "..." }
  ]
}
```

### 4. Search UI

In `apps/cloud/src/components/SearchBar.tsx`, a command-palette-style search:
- Keyboard shortcut: Ctrl+K (or Cmd+K on Mac) opens search overlay
- Debounced API call as user types (300ms delay)
- Results grouped: Sessions / Memories
- Arrow keys to navigate, Enter to open result
- Escape to close
- Highlights matched terms in snippets

### 5. Backfill existing sessions

After adding the trigger, backfill existing sessions:
```sql
UPDATE sessions SET fts_vector = to_tsvector('english', COALESCE(title, '') || ' ' || COALESCE(messages::text, ''));
```

Run as a one-time migration via `pnpm db:migrate`.

## Verification Checklist

- [ ] Search for "nginx" returns sessions containing nginx in their messages
- [ ] Ctrl+K opens search overlay in web UI
- [ ] Results appear within 500ms of last keystroke
- [ ] Snippets highlight matched terms in context
- [ ] Search for multi-word "nginx CVE" returns sessions with both words
- [ ] `EXPLAIN ANALYZE SELECT ... WHERE fts_vector @@ ...` shows "Bitmap Index Scan" (not seq scan)

## Files to Create or Modify

- MODIFY `docker/postgres/init.sql` - add fts_vector columns, indexes, triggers
- CREATE `src/api/search.ts`
- MODIFY `src/server.ts` - mount search endpoint
- CREATE `apps/cloud/src/components/SearchBar.tsx`
- MODIFY `apps/cloud/src/App.tsx` - register Ctrl+K shortcut for SearchBar
- CREATE backfill migration in `docker/postgres/migrations/`
