# Cursor Task: Fix clarify (#20) and session-search (#19) tools in Carina

## Context

Carina is a Node.js/TypeScript autonomous AI agent at:
`/opt/lampp/htdocs/verlox/carina/core.carinaai.uk/`

We are going through 27 Hermes tools one at a time, debugging and confirming each
works end-to-end. Tools #18 (memory) and #21 (todo) are already confirmed working.
This task covers tools #19 (session-search) and #20 (clarify).

Read these files in full before touching anything:
- `src/tools/clarify.ts`
- `src/tools/session-search.ts`
- `src/memory/session-index.ts`
- `src/memory/migrations.ts`
- `src/agents/carina.ts` (especially `buildContext`, `runTurnLoop`, and the memory interceptor)
- `src/tools/index.ts` (especially `registerSessionTools`)
- `src/tools/session-tool-store.ts` (the per-session tool store introduced for todo)
- `src/types/index.ts`

Do NOT modify any file you have not read first.

---

## Tool #20: clarify

### What it is supposed to do (Hermes behaviour)

When the agent needs information before it can complete a task (ambiguous intent,
missing parameter, a choice between two valid approaches), it calls:

```
clarify(question="Which format do you want?", choices=["PDF", "Markdown", "Plain text"])
```

The tool stores the pending question in memory keyed by sessionId. The agent's response
to the user is the question text. The user replies. On the NEXT turn, the agent sees
the clarification context prepended to the user's answer and continues the original
workflow - it does not ask again, it does not forget what it was doing.

### Current state: stub

The tool implementation in `src/tools/clarify.ts` is correct: it stores the pending
question in a module-level `Map<sessionId, ClarifyRequest>` and returns
`{ status: 'awaiting_clarification', ... }`.

BUT: `getPendingClarification` and `clearPendingClarification` are **never imported or
called anywhere outside clarify.ts**. The pending question is stored but never consumed.
The next turn starts with no knowledge that a clarification was pending, so the user's
answer is treated as a fresh unrelated message.

Additionally, after the clarify tool resolves, the turn loop continues calling the LLM
again. The LLM should generate the question text and stop - not make further tool calls.

### Fixes required

#### Fix 1: Inject clarification context into the next turn

In `src/agents/carina.ts`, in the `buildContext` method, add a check near the top of
the method (before the system prompt parts are assembled) that:

1. Imports `getPendingClarification` and `clearPendingClarification` from
   `../tools/clarify.js`. Import these at the top of the file.
2. Calls `getPendingClarification(this.sessionId)`.
3. If a pending clarification exists, appends a context block to `contextParts` (after
   the base system prompt parts but before memory/skills):

```
Clarification context: on the previous turn you asked the user the following question
and are now receiving their answer. Question: "[question]". Choices offered:
[list choices if present, else "open-ended"]. Resume your original task using their
answer. Do not ask the same question again.
```

4. Calls `clearPendingClarification(this.sessionId)` immediately after reading it
   (clear-on-read so it cannot be injected twice).

Do NOT clear before reading. Do NOT inject inside the memory block. Inject it as its
own entry in `contextParts`.

#### Fix 2: Stop the turn loop after clarify resolves

In `src/agents/carina.ts`, in `runTurnLoop`, in the tool call execution loop:

After `executeToolCall` resolves for any tool whose result contains
`status: 'awaiting_clarification'`, push the tool_result to messages as normal, then
break out of the while loop immediately. Do not make another LLM call after a
clarification is pending.

Concretely: after pushing the tool_result message, check if
`(result as any)?.status === 'awaiting_clarification'` and if yes, `break` out of the
`for (const call of toolCalls)` loop AND then `break` out of the outer `while` loop.
Use a boolean flag `let awaitingClarification = false` declared before the while loop
to signal the outer break.

#### Fix 3: Improve the tool description

Replace the current description in `createClarifyTool` with:

```
'Use this tool when you cannot complete the task without more information from the user: missing parameters, ambiguous intent, or a genuine choice between approaches. Call it with a clear question and up to 4 choices. The user will answer in their next message; you will then resume the original task. Do not use it for rhetorical questions or when you can make a reasonable assumption yourself.'
```

#### Fix 4: Write tests

Create `src/tools/clarify.test.ts` with tests covering:
- Tool returns `awaiting_clarification` status with question and choices.
- Tool stores the pending clarification (verify via `getPendingClarification`).
- Empty question returns `{ error: 'Question is required.' }`.
- Choices are capped at 4.
- `clearPendingClarification` removes the pending entry.
- Two different session IDs have independent pending clarifications.

---

## Tool #19: session-search

### What it is supposed to do (Hermes behaviour)

The agent can search its own conversation history across all sessions:
- `session-search(query="TypeScript decorators")` - find past conversations mentioning this
- `session-search(session_id="...", around_message_id="...")` - scroll context around a message
- `session-search()` - browse recent sessions

The agent uses this proactively: before saying "I don't remember discussing X", it
should search first. It uses it when the user references past work: "last time you
helped me with...", "do you remember when we...".

### Current state: mostly working, three bugs

The database setup is confirmed on the VPS:
- `content_tsv` tsvector column: EXISTS (migration ran)
- GIN index: MISSING (migration bug - see Fix 1 below)
- Search: works via seq scan (216 rows so far, acceptable now, slow at scale)
- `websearch_to_tsquery` and `ts_headline`: functional

Bug 1: GIN index is never created on instances where the column was added before the
index creation statement was added to the migration. The migration uses one `IF NOT
EXISTS` check for the column - if the column exists, the whole block including
`CREATE INDEX` is skipped.

Bug 2: The SQL query in `searchSessions` fetches ALL matching rows from Postgres then
limits in JS. The `limit` variable is in `params` as `$2` but `$2` is never used in
the SQL string. This is inefficient at scale.

Bug 3: `DISTINCT ON (session_id)` with `ORDER BY session_id, rank DESC` returns
sessions sorted alphabetically by session_id, not by best match quality. The top 5
results may be the alphabetically first sessions, not the most relevant ones.

### Fixes required

#### Fix 1: Add GIN index migration

In `src/memory/migrations.ts`, replace the `FTS_MIGRATION` string with a version that
adds a SEPARATE `DO $$ BEGIN` block for the index, independent of the column check:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'episodic_memories' AND column_name = 'content_tsv'
  ) THEN
    ALTER TABLE episodic_memories
      ADD COLUMN content_tsv tsvector
      GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS episodic_memories_tsv_idx
  ON episodic_memories USING GIN (content_tsv);
```

The `CREATE INDEX IF NOT EXISTS` is outside the `DO` block so it always runs and is
idempotent. This fixes instances where the column exists but the index does not.

#### Fix 2: Fix the SQL query in searchSessions

In `src/memory/session-index.ts`, replace the `searchSessions` SQL with a subquery
that correctly limits at the DB level and orders by best match across sessions:

```sql
SELECT sub.session_id, sub.message_id, sub.role, sub.content, sub.created_at,
       sub.snippet, sub.rank
FROM (
  SELECT DISTINCT ON (session_id)
    session_id,
    id AS message_id,
    role,
    content,
    created_at,
    ts_headline('english', content, websearch_to_tsquery('english', $1)) AS snippet,
    ts_rank(content_tsv, websearch_to_tsquery('english', $1)) AS rank
  FROM episodic_memories
  WHERE content_tsv @@ websearch_to_tsquery('english', $1)
  ORDER BY session_id, rank DESC
) sub
ORDER BY sub.rank DESC
LIMIT $2
```

The params array is already `[tsQuery, limit]` so `$2` now correctly maps to `limit`.
The outer `ORDER BY sub.rank DESC LIMIT $2` returns the top N most relevant sessions,
not alphabetically first sessions.

Also remove the JS-level `if (hits.length >= limit) break` check since the DB now
enforces it - but keep it as a safety guard (it is harmless if left).

#### Fix 3: Add error handling for bad queries

`websearch_to_tsquery` can throw on certain malformed inputs. Wrap the pool.query call
in `searchSessions` in a try/catch that returns `[]` on error (log the error with
`console.error`). Do the same for `getSessionWindow` (throws if message not found -
currently returns an Error but callers may not expect it).

#### Fix 4: Improve the tool description

Replace the current description in `src/tools/session-search.ts` with:

```
'Search past conversation history. Use this BEFORE claiming you do not remember something - search first. Also use it when the user references prior work ("last time", "previously", "do you remember"). Modes: query (find sessions by content), scroll (read context around a message), browse (list recent sessions with no query).'
```

#### Fix 5: Write tests

Create `src/tools/session-search.test.ts`. Mock `../memory/session-index.js` entirely.
Tests should cover:
- Called with a query: calls `searchSessions` and returns `{ mode: 'discovery', query, results }`.
- Called with session_id and around_message_id: calls `getSessionWindow` and returns `{ mode: 'scroll', ... }`.
- Called with no params: calls `browseRecentSessions` and returns `{ mode: 'browse', ... }`.
- `searchSessions` throws: returns `{ error: '...' }` (requires the error handling added in Fix 3 to propagate).

---

## General rules

- TypeScript only. No `any` unless there is no alternative (and document why).
- No em dashes, no emojis anywhere (prose, comments, commit messages).
- Functions under 20 lines. No multi-paragraph comments.
- Run `npx tsc --noEmit` after every file change. Fix all errors before moving on.
- Run `npx vitest run src/tools/clarify.test.ts src/tools/session-search.test.ts`
  after writing tests. All tests must pass.
- Do not touch files not listed in this prompt unless a type error forces it.
- Do not add features beyond what is listed here.

## Verification checklist (do this before considering the task done)

- [ ] `npx tsc --noEmit` exits 0
- [ ] `npx vitest run src/tools/clarify.test.ts` all pass
- [ ] `npx vitest run src/tools/session-search.test.ts` all pass
- [ ] `npx vitest run src/tools/memory.test.ts src/tools/todo.test.ts` still pass
      (regression check - do not break existing tests)
- [ ] `getPendingClarification` is imported and called in `carina.ts`
- [ ] `clearPendingClarification` is called immediately after reading (clear-on-read)
- [ ] The GIN index migration runs idempotently (`CREATE INDEX IF NOT EXISTS` outside DO block)
- [ ] `searchSessions` SQL uses `$2` for LIMIT, wraps DISTINCT ON in a subquery ordered by rank
- [ ] Turn loop breaks early when `status === 'awaiting_clarification'` is detected
