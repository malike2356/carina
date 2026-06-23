# Gap 09 - Prompt 03: FTS5 Full-Text Session Search

> **REUSE RULE:** See `../REUSE-RULES.md`. Implement the behavior below in Carina's own voice. No competitor product names, labels, CLI text, UI copy, or config key names may appear verbatim in shipped code. Rename all user-visible elements to Carina equivalents before committing.


**Agent:** Claude Code
**Estimated hours:** 4-5 hrs
**Depends on:** SQLite must be available (it is via better-sqlite3)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## The Problem

Carina has `src/memory/session-search-service.ts` but it likely does substring matching or
embedding-based vector search. Both have weaknesses: substring search misses semantic variants,
and embedding search requires an embedding model call for every query.

Hermes uses SQLite FTS5 (Full-Text Search version 5), which provides:
- Tokenized full-text search with BM25 ranking
- No embedding calls needed for basic search
- Sub-millisecond queries against thousands of sessions
- Cross-session recall of past conversations by keyword

The result is that Hermes can instantly find "what did we discuss about Rightmove last week"
while Carina either misses it or needs to call an embedding model.

---

## Read First

```
core.carinaai.uk/src/memory/session-search-service.ts   (current search impl)
core.carinaai.uk/src/memory/session-index.ts            (session indexing)
core.carinaai.uk/src/memory/db.ts                       (DB pool / connection)
core.carinaai.uk/src/memory/backends/sqlite-backend.ts  (SQLite backend)
core.carinaai.uk/src/memory/migrations.ts               (migration runner)
core.carinaai.uk/src/surfaces/session-store.ts          (session persistence)
```

---

## 1. Database Migration: FTS5 Table

Add a migration to create the FTS5 virtual table and a content table for sessions:

```typescript
// src/memory/migrations.ts  (add new migration)

const MIGRATION_007_FTS5_SESSION_INDEX = `
-- Content table: one row per session (real data lives here)
CREATE TABLE IF NOT EXISTS session_fts_content (
  session_id   TEXT PRIMARY KEY,
  title        TEXT,
  summary      TEXT,
  full_text    TEXT,       -- concatenated messages for FTS indexing
  created_at   INTEGER,
  updated_at   INTEGER,
  profile_id   TEXT        -- for multi-profile isolation
);

-- FTS5 virtual table backed by the content table
CREATE VIRTUAL TABLE IF NOT EXISTS session_fts USING fts5(
  title,
  summary,
  full_text,
  content='session_fts_content',
  content_rowid='rowid',
  tokenize='porter unicode61 remove_diacritics 1'
);

-- Triggers to keep FTS in sync with content table
CREATE TRIGGER IF NOT EXISTS session_fts_ai
  AFTER INSERT ON session_fts_content BEGIN
    INSERT INTO session_fts(rowid, title, summary, full_text)
    VALUES (new.rowid, new.title, new.summary, new.full_text);
  END;

CREATE TRIGGER IF NOT EXISTS session_fts_ad
  AFTER DELETE ON session_fts_content BEGIN
    INSERT INTO session_fts(session_fts, rowid, title, summary, full_text)
    VALUES ('delete', old.rowid, old.title, old.summary, old.full_text);
  END;

CREATE TRIGGER IF NOT EXISTS session_fts_au
  AFTER UPDATE ON session_fts_content BEGIN
    INSERT INTO session_fts(session_fts, rowid, title, summary, full_text)
    VALUES ('delete', old.rowid, old.title, old.summary, old.full_text);
    INSERT INTO session_fts(rowid, title, summary, full_text)
    VALUES (new.rowid, new.title, new.summary, new.full_text);
  END;
`;
```

---

## 2. Session Indexer

```typescript
// src/memory/session-fts-indexer.ts  (new file)

import Database from 'better-sqlite3';
import { getDb } from './db.js';

export interface SessionFtsEntry {
  sessionId: string;
  title: string;
  summary: string;
  fullText: string;
  createdAt: number;
  updatedAt: number;
  profileId?: string;
}

/**
 * Index or update a session in the FTS table.
 * Call this when a session ends or is summarized.
 */
export function indexSession(entry: SessionFtsEntry): void {
  const db = getDb() as Database.Database;

  const existing = db
    .prepare('SELECT session_id FROM session_fts_content WHERE session_id = ?')
    .get(entry.sessionId);

  if (existing) {
    db.prepare(`
      UPDATE session_fts_content
      SET title = ?, summary = ?, full_text = ?, updated_at = ?
      WHERE session_id = ?
    `).run(entry.title, entry.summary, entry.fullText, entry.updatedAt, entry.sessionId);
  } else {
    db.prepare(`
      INSERT INTO session_fts_content
        (session_id, title, summary, full_text, created_at, updated_at, profile_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.sessionId, entry.title, entry.summary, entry.fullText,
      entry.createdAt, entry.updatedAt, entry.profileId ?? 'default'
    );
  }
}

/**
 * Remove a session from the FTS index.
 */
export function deindexSession(sessionId: string): void {
  const db = getDb() as Database.Database;
  db.prepare('DELETE FROM session_fts_content WHERE session_id = ?').run(sessionId);
}

/**
 * Build full_text from an array of messages (trim to last 50 messages to keep it manageable).
 */
export function buildFullText(messages: Array<{ role: string; content: string }>): string {
  return messages
    .slice(-50)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')
    .slice(0, 50_000); // max 50K chars per session
}
```

---

## 3. FTS Search Service

Replace or augment the existing `session-search-service.ts`:

```typescript
// src/memory/session-fts-search.ts  (new file)

import Database from 'better-sqlite3';
import { getDb } from './db.js';
import { callAuxiliaryModel } from '../brain/auxiliary-client.js'; // from gap-09-prompt-02

export interface SessionSearchResult {
  sessionId: string;
  title: string;
  snippet: string;
  rank: number;
  createdAt: number;
}

/**
 * Search sessions using FTS5 BM25 ranking.
 * Returns up to `limit` results ordered by relevance.
 */
export function searchSessions(
  query: string,
  opts: { profileId?: string; limit?: number } = {}
): SessionSearchResult[] {
  const db = getDb() as Database.Database;
  const limit = opts.limit ?? 10;
  const profileId = opts.profileId ?? 'default';

  // FTS5 MATCH query with BM25 ranking
  const rows = db.prepare(`
    SELECT
      c.session_id,
      c.title,
      snippet(session_fts, 2, '[', ']', '...', 20) AS snippet,
      rank,
      c.created_at
    FROM session_fts
    JOIN session_fts_content c ON session_fts.rowid = c.rowid
    WHERE session_fts MATCH ?
      AND c.profile_id = ?
    ORDER BY rank
    LIMIT ?
  `).all(sanitizeFtsQuery(query), profileId, limit) as Array<{
    session_id: string;
    title: string;
    snippet: string;
    rank: number;
    created_at: number;
  }>;

  return rows.map(r => ({
    sessionId: r.session_id,
    title: r.title ?? '',
    snippet: r.snippet ?? '',
    rank: r.rank,
    createdAt: r.created_at,
  }));
}

/**
 * Search + LLM summarization for cross-session recall.
 * Use this when the agent needs to recall across past sessions.
 */
export async function recallAcrossSessions(
  query: string,
  profileId?: string
): Promise<string> {
  const results = searchSessions(query, { profileId, limit: 5 });

  if (results.length === 0) {
    return `No past sessions found matching "${query}".`;
  }

  const context = results
    .map(r => `Session "${r.title}" (${new Date(r.createdAt).toLocaleDateString()}): ${r.snippet}`)
    .join('\n\n');

  // Use auxiliary model for summarization (from prompt 02)
  try {
    return await callAuxiliaryModel(
      'sessionSearch',
      `The user asked: "${query}"

Relevant past conversations:
${context}

Summarize what was discussed in 2-3 sentences. Be specific about dates and topics.`
    );
  } catch {
    // Fallback: return raw snippets
    return results.map(r => `[${r.title}] ${r.snippet}`).join('\n');
  }
}

/**
 * Escape special FTS5 characters in user query to prevent injection.
 */
function sanitizeFtsQuery(query: string): string {
  // FTS5 special chars: " * ^ { }
  // Wrap each word in double quotes for exact matching, or use simple sanitization
  return query
    .replace(/['"*^{}]/g, ' ')  // strip special chars
    .split(/\s+/)
    .filter(Boolean)
    .join(' ');
}
```

---

## 4. Auto-Index Sessions on End

In the session lifecycle, trigger indexing when a session ends:

```typescript
// src/gateway/session-control.ts  (add to session end handler)

import { indexSession, buildFullText } from '../memory/session-fts-indexer.js';
import { generateSessionTitle } from '../surfaces/session-store.js';

async function onSessionEnd(sessionId: string, messages: Message[]): Promise<void> {
  try {
    const title = await generateSessionTitle(messages[0]?.content ?? '');
    const fullText = buildFullText(messages);

    // One-sentence summary via auxiliary model
    let summary = '';
    try {
      summary = await callAuxiliaryModel(
        'summarization',
        `Summarize this conversation in one sentence:\n${fullText.slice(0, 2000)}`
      );
    } catch { /* skip summary if model fails */ }

    indexSession({
      sessionId,
      title,
      summary,
      fullText,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      profileId: getCurrentProfileId(),
    });
  } catch (err) {
    console.warn('[fts] Failed to index session:', err);
    // Non-fatal: user can still use the session, it just won't appear in search
  }
}
```

---

## 5. Register as a Memory Tool

Expose session search as a tool the agent can call:

```typescript
// src/tools/session-search.ts  (modify or create)

import { recallAcrossSessions } from '../memory/session-fts-search.js';

export const sessionSearchTool = {
  name: 'recall_past_sessions',
  description: 'Search across past conversations to recall what was discussed on a topic',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'What to search for in past conversations' },
    },
    required: ['query'],
  },
  handler: async ({ query }: { query: string }) => {
    return recallAcrossSessions(query);
  },
};
```

---

## Files to Create

```
core.carinaai.uk/src/memory/session-fts-indexer.ts
core.carinaai.uk/src/memory/session-fts-search.ts
```

## Files to Modify

```
core.carinaai.uk/src/memory/migrations.ts          add FTS5 migration
core.carinaai.uk/src/gateway/session-control.ts    call indexSession on session end
core.carinaai.uk/src/tools/session-search.ts       use FTS search, expose as tool
core.carinaai.uk/src/memory/session-search-service.ts  delegate to fts-search for keyword queries
```

---

## Done When

- [ ] Migration creates `session_fts_content` table and `session_fts` FTS5 virtual table on startup
- [ ] FTS5 triggers keep content and index in sync on insert/update/delete
- [ ] `searchSessions('rightmove')` returns sessions containing that word, ranked by BM25
- [ ] `recallAcrossSessions('property valuation')` returns LLM-summarized results
- [ ] Sessions are automatically indexed when they end
- [ ] Profile isolation: searching with profileId='alice' does not return 'bob' sessions
- [ ] `recall_past_sessions` tool is available to the agent
- [ ] FTS query sanitization prevents injection via special FTS5 characters
- [ ] Unit test: index 3 sessions, search finds the right one
- [ ] Unit test: empty search returns 0 results without crash
- [ ] Performance test: search across 1000 indexed sessions completes in under 50ms