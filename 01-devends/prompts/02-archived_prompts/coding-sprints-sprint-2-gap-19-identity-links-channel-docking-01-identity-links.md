**Status: COMPLETED 2026-06-21**

**What was built:**
- `identity_links` Postgres table and migration in `memory/migrations.ts`
- `gateway/identity-links-types.ts`, `gateway/identity-resolver.ts`
- `/link`, `/link code`, `/link claim` in `gateway/commands.ts`

# Gap 19 - Prompt 01: Identity Links Data Model & Resolution

**Gap:** 19 Identity Links & Channel Docking
**Prompt number:** 01 of 03
**Name:** Identity link data model, linking, resolution
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** Nothing

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Read first

1. `gateway/router.ts` -- inbound message routing (~lines 380-500)
2. `workspaces/agent-routing.ts` -- agent resolution
3. OpenClaw `src/session/identity-links.ts` (reference)

---

## Goal

### Step 1: Data Model

New DB table `identity_links`:

```sql
CREATE TABLE identity_links (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     TEXT NOT NULL,           -- canonical user identifier
  channel     TEXT NOT NULL,           -- 'telegram' | 'webchat' | 'discord' | ...
  channel_user_id TEXT NOT NULL,       -- platform-specific ID (E.164, UUID, etc.)
  display_name TEXT,                    -- user's display name on this channel
  linked_at   INTEGER NOT NULL,         -- Date.now()
  last_seen_at INTEGER NOT NULL,
  is_primary  BOOLEAN NOT NULL DEFAULT false,  -- primary identity for this user
  metadata    TEXT DEFAULT '{}',        -- platform-specific extras

  UNIQUE(channel, channel_user_id),
  UNIQUE(user_id, channel)
);

CREATE INDEX idx_il_user ON identity_links(user_id);
CREATE INDEX idx_il_channel_user ON identity_links(channel, channel_user_id);
```

### Step 2: Identity Resolution

Create `gateway/identity-resolver.ts`:

```typescript
export class IdentityResolver {
  /**
   * Resolve a channel-specific identifier to a canonical user ID.
   * Returns the canonical user_id if found, or creates a new one.
   */
  async resolve(channel: string, channelUserId: string): Promise<string> {
    // Look up existing link
    const link = await this.db.query(
      'SELECT user_id FROM identity_links WHERE channel = ? AND channel_user_id = ?',
      [channel, channelUserId]
    ).get();

    if (link) {
      // Update last_seen
      await this.db.run(
        'UPDATE identity_links SET last_seen_at = ? WHERE channel = ? AND channel_user_id = ?',
        [Date.now(), channel, channelUserId]
      );
      return link.user_id;
    }

    // First time -- create new canonical identity
    const userId = `usr_${randomUUID()}`;
    await this.db.run(
      `INSERT INTO identity_links (user_id, channel, channel_user_id, linked_at, last_seen_at, is_primary)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, channel, channelUserId, Date.now(), Date.now(), true]
    );
    return userId;
  }

  /**
   * Link an additional channel identity to an existing canonical user.
   */
  async link(
    userId: string,
    channel: string,
    channelUserId: string,
    displayName?: string,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO identity_links (user_id, channel, channel_user_id, display_name, linked_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(channel, channel_user_id) DO UPDATE SET user_id = ?, last_seen_at = ?`,
      [userId, channel, channelUserId, displayName, Date.now(), Date.now(), userId, Date.now()]
    );
  }

  /**
   * Get all linked identities for a canonical user.
   */
  async getIdentities(userId: string): Promise<IdentityLink[]> {
    return this.db.query(
      'SELECT * FROM identity_links WHERE user_id = ? ORDER BY is_primary DESC, last_seen_at DESC',
      [userId]
    ).all();
  }

  /**
   * Resolve a canonical user back to a specific channel identity.
   */
  async resolveToChannel(userId: string, channel: string): Promise<IdentityLink | null> {
    return this.db.query(
      'SELECT * FROM identity_links WHERE user_id = ? AND channel = ?',
      [userId, channel]
    ).get() ?? null;
  }
}
```

### Step 3: Wire into Message Routing

In `gateway/router.ts`, replace the session key with the resolved canonical ID:

```typescript
// OLD: session key = `${channel}:${channelUserId}`
// NEW:
const canonicalUserId = await this.identityResolver.resolve(channel, channelUserId);
const sessionKey = `${channel}:${canonicalUserId}`; // shared across channels
```

The `/link` command lets users say "link my Telegram to my WebChat":

```
/link               Show current linked identities
/link code          Generate a one-time linking code (valid 5 min)
/link claim <code>  Claim a link code from another channel
```

---

## Existing Carina code to integrate with

- `gateway/router.ts` -- replace session key derivation
- `gateway/types.ts` -- add `canonicalUserId` to session metadata
- `db/migrations/` -- new migration for `identity_links`
- `agents/command-handler.ts` -- add `/link` command
