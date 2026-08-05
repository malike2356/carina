# Aiva Session Persistence; Prompt 03 of 03: Rolling Semantic Summarization
# Depends on: 01-conversation-pinning (can ship in parallel, both need deployed)
# Estimated time: 5-6 hours

## Problem

`resolveAivaConversationBridge` caps conversation history at `maxMemoryContext` (20 turns, max 40). When a chat exceeds this, older turns are silently dropped. The LLM loses all context from the first half of a long conversation and either repeats itself, asks questions already answered, or resets entirely. This is the "drift and start all over again" behavior Laud described.

The bridge's `mergeTurns(limit, ...)` takes the LAST N turns from each source. There is no summarization, no sliding window awareness, and no persistent context block that preserves the gist of earlier exchanges.

## Task

### 1. Database migration; thread summary storage

Create `src/memory/migrations/004-thread-summaries.sql`:

```sql
CREATE TABLE IF NOT EXISTS aiva_thread_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES channel_threads(conversation_id) ON DELETE CASCADE,
  session_epoch INTEGER NOT NULL DEFAULT 1,
  summary_text TEXT NOT NULL,
  covered_turn_range INT4RANGE NOT NULL,  -- e.g. [1,50) = turns 1-49
  compressed_at TIMESTAMPTZ DEFAULT NOW(),
  model_used TEXT NOT NULL DEFAULT '',
  token_count_before INTEGER DEFAULT 0,
  token_count_after INTEGER DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_thread_summaries_epoch_range
  ON aiva_thread_summaries (conversation_id, session_epoch, covered_turn_range);
```

### 2. Summarization worker

Create `src/memory/aiva/thread-summarizer.ts`:

```typescript
interface SummarizationConfig {
  triggerAfterTurns: number; // default: 30; when to compress
  windowKeepRecent: number; // default: 15; recent turns kept verbatim
  maxSummaryTokens: number; // default: 500; target compressed size
  compressionModel?: string; // default: uses CARINA_SUMMARY_MODEL env or cheapest available
}

interface ThreadSummary {
  summaryText: string;
  coveredRange: [number, number]; // [firstTurn, lastTurn]
  compressedAt: Date;
}

export async function maybeSummarizeThread(params: {
  conversationId: string;
  sessionEpoch: number;
  totalTurns: number;
  config?: Partial<SummarizationConfig>;
}): Promise<ThreadSummary | null> {
  // 1. If totalTurns < triggerAfterTurns → return null (nothing to summarize)
  // 2. Calculate range to compress: [1, totalTurns - windowKeepRecent)
  // 3. Check if aiva_thread_summaries already has an entry covering this range → skip
  // 4. Query episodic_memories WHERE conversation_id = $1 AND turn_number < $2
  //    (turn_number is a new column; see migration below)
  // 5. Build summarization prompt:
  //
  //    "Summarize this conversation segment. Preserve: key decisions, action items,
  //     user preferences stated, topics discussed, and context needed to continue
  //     the conversation naturally. Omit: pleasantries, repetitions, tool call details."
  //
  // 6. Call LLM with the turn content + summarization prompt
  // 7. INSERT INTO aiva_thread_summaries
  // 8. Return the summary

  const cfg = { ...DEFAULT_SUMMARIZATION_CONFIG, ...config };
  if (totalTurns < cfg.triggerAfterTurns) return null;

  const compressUpTo = totalTurns - cfg.windowKeepRecent;
  if (compressUpTo <= 0) return null;

  // Check existing coverage
  const existing = await pool.query(
    `SELECT upper(covered_turn_range) as max_covered
     FROM aiva_thread_summaries
     WHERE conversation_id = $1 AND session_epoch = $2
     ORDER BY upper(covered_turn_range) DESC LIMIT 1`,
    [conversationId, sessionEpoch],
  );
  const alreadyCovered = existing.rows[0]?.max_covered ?? 0;
  if (alreadyCovered >= compressUpTo) return null;

  // Fetch turns to compress
  const turns = await pool.query(
    `SELECT turn_number, role, content
     FROM episodic_memories
     WHERE conversation_id = $1
       AND turn_number > $2 AND turn_number <= $3
     ORDER BY turn_number ASC`,
    [conversationId, alreadyCovered, compressUpTo],
  );

  // Build prompt and call LLM
  const summary = await generateSummary(turns.rows, cfg);
  // Store
  await pool.query(
    `INSERT INTO aiva_thread_summaries
     (conversation_id, session_epoch, summary_text, covered_turn_range, model_used)
     VALUES ($1, $2, $3, int4range($4, $5), $6)`,
    [conversationId, sessionEpoch, summary, alreadyCovered, compressUpTo, summaryModel],
  );

  return { summaryText: summary, coveredRange: [alreadyCovered, compressUpTo], compressedAt: new Date() };
}
```

### 3. Add turn_number column

```sql
ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS turn_number INTEGER;
CREATE INDEX IF NOT EXISTS idx_episodic_memories_turn
  ON episodic_memories (conversation_id, turn_number);
```

In `episodic-postgres.ts` `saveMemory()`:

```typescript
// After INSERT, or as part of the INSERT:
// SELECT COALESCE(MAX(turn_number), 0) + 1 FROM episodic_memories
//   WHERE conversation_id = $conversationId
// Then INSERT with turn_number = nextTurn
```

### 4. Inject summary into bridge context

Modify `resolveAivaConversationBridge` in `conversation-bridge.ts`:

```typescript
// After building turns array, fetch and prepend summaries:
const summaries = await pool.query(
  `SELECT summary_text, covered_turn_range
   FROM aiva_thread_summaries
   WHERE conversation_id = $1 AND session_epoch = $2
   ORDER BY lower(covered_turn_range) ASC`,
  [conversationId, sessionEpoch],
);

let summaryPrefix = '';
if (summaries.rows.length > 0) {
  summaryPrefix = '## Conversation summary (earlier)\n\n'
    + summaries.rows.map((s, i) =>
        `${i + 1}. ${s.summary_text}`
      ).join('\n\n')
    + '\n\n---\n\n';
}

// Prepend summary before the recent turns
const finalContext = summaryPrefix + formatBridgeHistoryForPrompt(turns);
```

### 5. Trigger points

Summarization should trigger:

1. **After every turn**; call `maybeSummarizeThread` asynchronously (non-blocking). If the thread crossed the trigger threshold, compress in the background.

2. **On session load**; when `resolveAivaConversationBridge` is called, check if compression is needed for the current turn count.

3. **New session epoch**; when `/new` or `/clear` is issued, increment `session_epoch` in `channel_threads`. Old summaries stay for the prior epoch; new epoch starts fresh.

### 6. Token budget management

In `formatBridgeHistoryForPrompt`, update to account for summary tokens:

```typescript
const SUMMARY_TOKEN_BUDGET = 1200; // reserve this for summaries
const HISTORY_TOKEN_BUDGET = maxChars - SUMMARY_TOKEN_BUDGET;
```

## Acceptance Criteria

- [ ] Thread with 50+ turns: LLM receives summary block + last 15 turns, not 50 raw turns
- [ ] Summary preserves: user name, key decisions, action items, stated preferences, topic continuity
- [ ] After `/new`: old summaries archived under prior epoch, new epoch starts clean
- [ ] Summarization is non-blocking; doesn't add latency to message responses
- [ ] Backfill: existing threads with >30 turns get summarized on next message
- [ ] Selorm can maintain context across 100+ turns without drift or restart
- [ ] No em dashes or emojis in code
