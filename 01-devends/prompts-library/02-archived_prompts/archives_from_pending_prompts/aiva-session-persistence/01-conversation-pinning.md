# Aiva Session Persistence; Prompt 01 of 03: Persistent Canonical Session Mapping
# Blocks: 02-contact-normalization
# Estimated time: 4-5 hours

## Problem

`resolveAivaSessionId` in `memory/aiva/memory-commands.ts` derives session IDs dynamically from `workerId + channel + contactId` on every inbound request. When a client reconnects with a slightly different contact identifier (guest vs authenticated, new browser tab, session token reset), a brand new session ID is generated. `getSessionHistory` queries `episodic_memories` under this new key where zero prior turns exist, forcing the LLM to start with blank context.

Twelve fragmented session IDs exist for Selorm alone. The bridge then falls back to `listRecentWorkerEpisodicTurns` which pulls turns from ALL sessions, creating the cross-contamination.

## Task

### 1. Database migration; stable conversation pinning

Create `src/memory/migrations/002-conversation-pinning.sql`:

```sql
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS conversation_id UUID DEFAULT gen_random_uuid();
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS session_epoch INTEGER DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_threads_conversation
  ON channel_threads (conversation_id);

ALTER TABLE episodic_memories ADD COLUMN IF NOT EXISTS conversation_id UUID;
CREATE INDEX IF NOT EXISTS idx_episodic_memories_conversation
  ON episodic_memories (conversation_id, created_at DESC);
```

### 2. Conversation pinning service

Create `src/memory/aiva/conversation-pinner.ts`:

```typescript
export async function resolveOrCreateConversation(params: {
  workspaceId: string;
  workerId: string;
  channel: string;
  contactId: string;
}): Promise<{ conversationId: string; sessionEpoch: number; isNew: boolean }> {
  // 1. Query channel_threads WHERE worker_id = $1 AND channel = $2 AND contact_id = $3
  // 2. If row exists AND has conversation_id → return it (pinned)
  // 3. If row exists WITHOUT conversation_id → backfill gen_random_uuid(), UPDATE, return it
  // 4. If no row → INSERT new row with gen_random_uuid() conversation_id, return it
  // 5. Never return a dynamically-derived string; always the persisted UUID
}
```

The session ID used for `episodic_memories.session_id` becomes `aiva-${workerId}-conv-${conversationId}`; a stable key that never changes for the lifetime of that thread.

### 3. Wire into message processing

In `src/workers/aiva-process-message.ts`, replace the call to `resolveAivaSessionId`:

```typescript
// BEFORE (current):
const identity = await resolveAivaSessionId({
  workspaceId, workerId, channel, contactId, displayName,
});
const sessionId = identity.sessionId;

// AFTER:
const { conversationId } = await resolveOrCreateConversation({
  workspaceId, workerId, channel, contactId: canonicalContactId,
});
const sessionId = `aiva-${workerId}-conv-${conversationId}`;
// Keep resolveAivaSessionId only for contact identity linking (canonicalContactId, linked, ownerAuto)
const identity = await resolveAivaSessionId({...});
```

### 4. Update episodic query paths

In `src/memory/aiva/conversation-bridge.ts`:

- `hydrateEpisodicFromEmployeeThread`; use the pinned `conversation_id` for session lookups
- `resolveAivaConversationBridge`; query `episodic_memories WHERE session_id = $1` using the stable key
- `listRecentWorkerEpisodicTurns`; ADD a filter: `AND created_at > NOW() - INTERVAL '4 hours'` to prevent pulling ancient Amoako/CV threads into current context

### 5. Add health check

Create `src/api/conversation-health.ts`:

```typescript
// GET /api/ops/conversations/:workerId
// Returns: list of conversation_ids with turn counts, last_active, channel
// Flags: conversations with >1 session_id mapping to same channel+contact (fragmentation detected)
```

## Acceptance Criteria

- [ ] Same Telegram DM to Selorm always resolves to the same `conversation_id` across restarts, reconnects, and browser tab switches
- [ ] `episodic_memories.session_id` uses `aiva-{workerId}-conv-{conversationId}` consistently
- [ ] Cross-contamination eliminated: `listRecentWorkerEpisodicTurns` only returns turns from last 4 hours
- [ ] Health endpoint shows zero fragmented conversations for active workers
- [ ] No existing episodic data lost (backfill: UPDATE episodic_memories SET conversation_id = extract from session_id)
- [ ] No em dashes or emojis in code
