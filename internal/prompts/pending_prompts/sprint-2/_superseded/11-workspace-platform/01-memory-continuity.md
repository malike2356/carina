# Prompt 01: Memory Continuity Across Sessions


## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`

## Context

Carina stores memories but they are not consistently surfaced across different session
contexts. A user who worked on an ABBIS billing module last week should have Carina
remember that context automatically when they start a new session related to ABBIS, without
having to remind Carina.

This is a foundational capability for the Workspace Platform vision (persistent AI
context that persists across sessions like a human colleague's memory).

## What to Build

### 1. Memory relevance scoring

When a new session starts, fetch memories most relevant to the initial user message:
```typescript
export async function fetchRelevantMemories(
  userId: string,
  initialMessage: string,
  limit = 5
): Promise<Memory[]> {
  // Use pgvector cosine similarity (already configured)
  const embedding = await embedText(initialMessage);

  const result = await db.query(
    `SELECT id, title, content, 1 - (embedding <=> $1::vector) AS similarity
     FROM memories
     WHERE user_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [JSON.stringify(embedding), userId, limit]
  );

  // Filter out low-similarity results
  return result.rows.filter(r => r.similarity > 0.72);
}
```

### 2. Cross-session context injection

In `src/agents/CarinaAgent.ts`, at session start:
```typescript
const relevantMemories = await fetchRelevantMemories(userId, session.firstMessage);
const memoryBlock = relevantMemories.length > 0
  ? `RELEVANT MEMORIES:\n${relevantMemories.map(m => `- ${m.title}: ${m.content}`).join('\n')}`
  : '';

const systemPrompt = `
${baseSystemPrompt}
${userProfile}
${memoryBlock}
`;
```

### 3. Automatic memory creation

At the end of each session, extract key facts worth remembering:
```typescript
export async function extractSessionMemories(sessionId: string, userId: string): Promise<void> {
  const session = await loadSession(sessionId);
  if (session.messages.length < 4) return; // Skip trivial sessions

  const extraction = await llm.complete(
    `Review this conversation and extract any facts worth remembering for future sessions.
     Focus on: decisions made, key findings, project context, user preferences.
     Return a JSON array of { title, content } objects. Max 3 items.
     Conversation: ${summarizeMessages(session.messages)}`
  );

  const extracted = JSON.parse(extraction);
  for (const memory of extracted) {
    await createMemory({ userId, ...memory, source: 'auto', sessionId });
  }
}
```

Trigger this after session closes (TTL-based or explicit `/end` command).

### 4. Memory decay

Old memories that are never accessed lose relevance over time. Add a `last_accessed` column
to the memories table and a monthly decay pass:
```sql
ALTER TABLE memories ADD COLUMN last_accessed TIMESTAMPTZ;
ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0;
ALTER TABLE memories ADD COLUMN relevance_score FLOAT DEFAULT 1.0;
```

Monthly decay: `relevance_score *= 0.85` for memories not accessed in 30+ days.
Memories with `relevance_score < 0.1` are archived (not deleted) after 6 months.

### 5. Memory UI

In the web UI, add a "Memories" panel (already referenced in the window-docking prompt):
- List of memories with title, snippet, last accessed, relevance score
- Pin/unpin (pinned memories always injected into system prompt)
- Delete
- "Similar sessions" link (sessions where this memory was surfaced)

## Verification Checklist

- [ ] Create a session discussing "ABBIS billing module". End session.
- [ ] Start new session, type "continue working on billing". Memory for ABBIS appears in system prompt.
- [ ] Session with < 4 messages does not trigger memory extraction
- [ ] Extracted memories appear in the Memories panel after session ends
- [ ] Memory accessed 5 times has higher relevance_score than one accessed 0 times

## Files to Create or Modify

- MODIFY `src/memory/retrieval.ts` - add fetchRelevantMemories with pgvector
- MODIFY `src/agents/CarinaAgent.ts` - inject relevant memories at session start
- CREATE `src/memory/session-extractor.ts` - extract memories from ended sessions
- MODIFY `docker/postgres/init.sql` - add last_accessed, access_count, relevance_score columns
- MODIFY `apps/cloud/src/components/MemoryPanel.tsx` - add relevance score and pin controls
