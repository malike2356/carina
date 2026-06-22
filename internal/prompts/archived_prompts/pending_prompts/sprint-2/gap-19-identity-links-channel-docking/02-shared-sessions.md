**Status: COMPLETED 2026-06-21**

**What was built:**
- Async session map keys via `buildGatewaySessionMapKeyAsync()` and `canonical:` external keys
- `session-identity-prefs.ts` for sharing prefs and reply routing metadata
- `/identity share on|off` command; linked identities block in `carina.ts` prompt assembly

# Gap 19 - Prompt 02: Cross-Channel Shared Sessions

**Gap:** 19 Identity Links & Channel Docking
**Prompt number:** 02 of 03
**Name:** Cross-channel session sharing via identity links
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 01-identity-links.md

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Goal

Once identities are linked (prompt 01), the agent must share session context
across channels for the same canonical user. When you send a message on
Telegram, the WebChat session sees that history and vice versa.

### Step 1: Session Key Migration

Sessions currently keyed by `channel:channelUserId`. Migrate to:

```typescript
type SessionKey = `session:${string}`; // `session:<canonicalUserId>`

// During resolution:
const canonicalUserId = await this.identityResolver.resolve(channel, channelUserId);
const sessionKey: SessionKey = `session:${canonicalUserId}`;
```

A migration reads existing sessions and updates their keys:

```sql
-- Create a mapping from old keys to new canonical IDs
-- This is a background migration that runs on startup
INSERT INTO identity_links (user_id, channel, channel_user_id, linked_at, last_seen_at)
SELECT 
  'usr_' || gen_random_uuid()::text,  -- generate canonical ID
  split_part(session_key, ':', 1),    -- channel
  split_part(session_key, ':', 2),    -- channel_user_id
  ?,
  ?
FROM (
  SELECT DISTINCT session_key FROM sessions WHERE session_key LIKE '%:%'
) existing
ON CONFLICT (channel, channel_user_id) DO NOTHING;
```

### Step 2: Response Routing

When the agent replies, it routes to the *originating channel* even though
the session is shared:

```typescript
// Session metadata stores the current reply channel
session.metadata.replyChannel = channelId;
session.metadata.replyChannelThreadId = threadId;

// On agent response, deliver to session.metadata.replyChannel
// This can be changed via channel docking (prompt 03)
```

### Step 3: Context Injection

When building the system prompt, include a "Linked Identities" section:

```
## Linked Identities
You are talking to the same person across these channels:
- Telegram (@username)
- WebChat (browser session)
- Discord (user#1234)

Currently replying on: Telegram
```

### Step 4: Opt-in / Opt-out

Not all users want cross-channel sessions. Add a per-user pref:

```typescript
// /identity share on|off
// When off, sessions stay per-channel even if identities are linked
session.metadata.crossChannelSharing = boolean;
```

---

## Existing Carina code to integrate with

- `gateway/router.ts` -- session key change, reply routing
- `agents/session-manager.ts` -- session key migration
- `agents/system-prompt.ts` -- add linked identities section
- `agents/command-handler.ts` -- `/identity share on|off`
