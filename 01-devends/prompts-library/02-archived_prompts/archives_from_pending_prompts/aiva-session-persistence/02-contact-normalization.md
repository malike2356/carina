# ARCHIVED 2026-07-31: implemented in core (contact-normalizer + ops unresolved endpoint)

# Aiva Session Persistence; Prompt 02 of 03: Upfront Contact Normalization
# Depends on: 01-conversation-pinning
# Estimated time: 3-4 hours

## Problem

Unauthenticated web sessions and multi-channel routing pass inconsistent `contactId` variations. The web widget sends `app`, `app:{uuid}`, `auto:{uuid}`, or empty strings depending on auth state and browser session. The Telegram adapter sends numeric chat IDs. These are treated as distinct contacts, fragmenting conversation history even after prompt 01 pins a conversation_id per contactId+channel pair.

Evidence from production: Selorm has `contact-1`, `contact-auto-76570af5`, `contact-auto-7ee5a01c`, and `contact-workspace-owner` all referencing the same human across different auth states.

## Task

### 1. Contact alias registry

Create `src/memory/aiva/contact-normalizer.ts`:

```typescript
interface ContactNormalizationResult {
  canonicalContactId: string; // stable UUID or deterministic string
  aliases: string[]; // all known contactId variations for this person
  confidence: 'exact' | 'high' | 'medium' | 'low';
  resolutionMethod: 'workspace_owner' | 'auth_token' | 'channel_identity' | 'heuristic' | 'passthrough';
}

export async function normalizeContact(params: {
  workspaceId: string;
  workerId: string;
  channel: string;
  rawContactId: string;
  metadata?: { telegramUserId?: string; sessionToken?: string; email?: string };
}): Promise<ContactNormalizationResult> {
  // Resolution order (first match wins):
  //
  // 1. WORKSPACE OWNER CHECK
  //    Query ai_workers WHERE id = workerId → get workspace_id
  //    Query aiva_workspace_contacts WHERE workspace_id = $1 AND is_owner = true
  //    If the rawContactId matches any linked channel identity of the owner → return owner's canonical UUID
  //    This catches: "workspace-owner", "1", "app", any auto:* tied to the owner
  //
  // 2. CHANNEL IDENTITY LOOKUP
  //    Query aiva_contact_identities WHERE workspace_id = $1 AND worker_id = $2
  //      AND ((channel = $3 AND channel_contact_id = $4) OR channel_contact_id = $4)
  //    If found → return canonical_contact_id
  //
  // 3. AUTH TOKEN RESOLUTION
  //    If metadata.sessionToken → decode and extract user_id
  //    Query workspace_profiles WHERE user_id matches → return profile UUID
  //
  // 4. TELEGRAM FALLBACK
  //    If channel === 'telegram' → rawContactId IS canonical (numeric chat IDs are stable)
  //    confidence: 'high'
  //
  // 5. PASSTHROUGH
  //    Return rawContactId as canonical with confidence: 'low'
  //    Log a warning for ops visibility
}

export function logUnresolvedContact(params: {
  workspaceId: string;
  workerId: string;
  rawContactId: string;
  channel: string;
}): void {
  // INSERT INTO aiva_contact_resolution_log
  // (workspace_id, worker_id, raw_contact_id, channel, resolution, created_at)
  // Only log when confidence is 'low' or 'heuristic'
  // Cap at 1 log per (workspace_id, worker_id, raw_contact_id) per hour
}
```

### 2. Database migration

Create `src/memory/migrations/003-contact-normalization.sql`:

```sql
CREATE TABLE IF NOT EXISTS aiva_contact_resolution_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  worker_id UUID NOT NULL,
  raw_contact_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  resolution_method TEXT NOT NULL,
  canonical_contact_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_resolution_workspace_worker
  ON aiva_contact_resolution_log (workspace_id, worker_id, created_at DESC);
```

### 3. Wire into message processing

In `src/workers/aiva-process-message.ts`, normalize BEFORE session resolution:

```typescript
// BEFORE conversation pinning or session ID derivation:
const normalized = await normalizeContact({
  workspaceId: params.workspaceId,
  workerId: params.workerId,
  channel: params.channel,
  rawContactId: params.contactId,
  metadata: {
    telegramUserId: params.contactId, // from Telegram adapter's metadata.telegramUserId
  },
});

// Use normalized.canonicalContactId everywhere downstream:
// - resolveOrCreateConversation
// - resolveAivaSessionId
// - hydrateEpisodicFromEmployeeThread
```

For Telegram adapter in `src/channels/adapters/telegram-adapter.ts`:

```typescript
// In parse(), the contactId is String(msg.chat.id).
// For DM chats (chatType === 'private'), also pass msg.from.id as metadata.telegramUserId
return {
  ...
  contactId: String(msg.chat.id),
  metadata: {
    telegramUserId: String(msg.from.id),
    chatType: isPrivate ? 'private' : 'group',
  },
};
```

### 4. Web widget normalization

In the web gateway (`src/gateway/router.ts` or the web chat handler):

```typescript
// When a web message arrives with contactId = 'app' or 'app:{uuid}':
// 1. Check request auth cookies/session for user identity
// 2. If authenticated → use workspace profile UUID as rawContactId
// 3. If guest → use 'app:{fingerprint}' where fingerprint is a stable browser hash
// 4. Pass to normalizeContact for final resolution
```

### 5. Add health check endpoint

Extend `src/api/conversation-health.ts` from prompt 01:

```
GET /api/ops/contacts/:workerId/unresolved
Returns: contacts with confidence='low' in last 24h, grouped by raw_contact_id
```

## Acceptance Criteria

- [x] Telegram DM `7028923891` always resolves to workspace owner's canonical UUID
- [x] Web app sessions resolve to the same canonical contact across guest → login transitions
- [x] Zero `low` confidence resolutions for active workers in production
- [x] `contact-workspace-owner`, `contact-1`, `contact-auto:*` all merge to one canonical ID
- [x] Contact resolution log populated for ops visibility
- [x] No em dashes or emojis in code
