# Sprint 4 - Prompt b/01: Channel Delivery Infrastructure

**Sprint:** 4 - Foundation
**Prompt number:** b/01
**Name:** Channel adapter pattern, message router, inbound webhook receiver, outbound send pipeline
**Primary agent:** Claude Code
**Estimated hours:** 8-10 h
**Depends on:** sprint-4/ai-employee/03-worker-brain.md must be built (Aiva brain processes messages)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/b/`.

---

## Read First

1. `backends/servers/core.carinaai.uk/src/aiva/aiva-api.ts` - specifically the chat handler; this is what the message router calls after routing an inbound message to the correct Aiva
2. `backends/servers/core.carinaai.uk/src/app/api/chat/route.ts` or equivalent - how the existing chat endpoint works; the channel router feeds into this same pipeline

---

## Context

The Aiva brain (sprint-4 prompt 03) processes messages. But currently no channel sends messages
INTO the Aiva brain except the portal web chat. This prompt builds the infrastructure that lets
WhatsApp, Email, Slack, Telegram, and the embeddable web widget all route messages to Aivas.

The pattern:
1. An inbound message arrives at a channel-specific webhook endpoint
2. The message router identifies which Aiva owns that channel identifier (e.g. +44xxx = Worker abc123)
3. The router calls the Aiva brain with the message
4. The brain generates a response
5. The response is sent back via the same channel adapter's `send()` method

This prompt builds the infrastructure (interface, router, registry, DB schema).
Prompts b/02-b/05 build the individual channel adapters.
Prompt c/01 builds the web chat widget (a separate channel with different delivery mechanics).

---

## Step 1: DB schema for channel credentials

Add to a new migration `010-channels.sql`:

```sql
CREATE TABLE IF NOT EXISTS ai_worker_channels (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID        NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL,
  channel         TEXT        NOT NULL,
    -- 'whatsapp' | 'email' | 'slack' | 'telegram' | 'web'
  identifier      TEXT        NOT NULL,
    -- the inbound address: phone number, email address, Slack team_id, Telegram bot token prefix, or 'web'
  credentials     JSONB       NOT NULL DEFAULT '{}',
    -- encrypted blob: { token, secret, webhook_secret, etc. } - see Step 2 for encryption
  enabled         BOOLEAN     NOT NULL DEFAULT true,
  verified        BOOLEAN     NOT NULL DEFAULT false,
    -- true after the channel has sent and received at least one message
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel, identifier)  -- one Aiva per channel identifier globally
);

CREATE INDEX ON ai_worker_channels(worker_id);
CREATE INDEX ON ai_worker_channels(channel, identifier) WHERE enabled = true;

-- Conversation threads: track channel-level conversation state
CREATE TABLE IF NOT EXISTS channel_threads (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       UUID        NOT NULL REFERENCES ai_workers(id) ON DELETE CASCADE,
  workspace_id    UUID        NOT NULL,
  channel         TEXT        NOT NULL,
  contact_id      TEXT        NOT NULL,
    -- the external user's identifier: phone number, email, Slack user_id, Telegram chat_id, session token
  thread_metadata JSONB       NOT NULL DEFAULT '{}',
    -- channel-specific: { last_message_id, whatsapp_message_id, email_thread_id, etc. }
  last_message_at TIMESTAMPTZ,
  message_count   INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON channel_threads(worker_id, channel, contact_id);
CREATE UNIQUE INDEX ON channel_threads(channel, worker_id, contact_id);
```

---

## Step 2: Credential encryption

Channel credentials (tokens, API keys) must not be stored in plaintext in the DB.

Add to `.env.example`:
```env
CHANNEL_CREDENTIAL_KEY=   # 32-byte hex key for AES-256-GCM: openssl rand -hex 32
```

Create `src/channels/credential-store.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptCredentials(obj: Record<string, string>): string {
  const key = Buffer.from(process.env.CHANNEL_CREDENTIAL_KEY!, 'hex');
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = JSON.stringify(obj);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptCredentials(blob: string): Record<string, string> {
  const key = Buffer.from(process.env.CHANNEL_CREDENTIAL_KEY!, 'hex');
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}
```

Store credentials as `encryptCredentials({ token: '...', webhookSecret: '...' })` in the JSONB column.
Decrypt when the adapter needs them.

Note: JSONB in Postgres stores JSON. Store the encrypted blob as a JSON string value:
```typescript
{ encrypted: encryptCredentials(rawCredentials) }
```

---

## Step 3: Channel adapter interface

Create `src/channels/types.ts`:

```typescript
export interface InboundMessage {
  channel: 'whatsapp' | 'email' | 'slack' | 'telegram' | 'web';
  workerId: string;
  workspaceId: string;
  contactId: string;       // external user identifier
  contactName?: string;    // display name if available
  content: string;         // plain text content
  rawPayload: unknown;     // original webhook payload for logging
  timestamp: Date;
  threadId?: string;       // for reply threading (email Message-ID, etc.)
  attachments?: Array<{ type: string; url: string; name?: string }>;
}

export interface OutboundMessage {
  channel: 'whatsapp' | 'email' | 'slack' | 'telegram' | 'web';
  contactId: string;
  content: string;
  replyToThreadId?: string;
  metadata?: Record<string, string>;
}

export interface ChannelAdapter {
  channel: InboundMessage['channel'];
  // Verify the inbound webhook signature; return false to reject
  verify(headers: Record<string, string>, rawBody: Buffer): boolean;
  // Parse the raw webhook payload into an InboundMessage
  parse(payload: unknown, workerId: string, workspaceId: string): InboundMessage | null;
  // Send a message back to the contact via this channel
  send(message: OutboundMessage, credentials: Record<string, string>): Promise<void>;
}
```

---

## Step 4: Worker registry

The message router needs to know which Aiva owns a given channel identifier without a DB query on every message.

Create `src/channels/worker-registry.ts`:

```typescript
// In-memory map: "whatsapp:+447911123456" -> { workerId, workspaceId, credentials }
// Rebuilt from DB on process start and on any ai_worker_channels INSERT/UPDATE/DELETE

interface RegistryEntry {
  workerId: string;
  workspaceId: string;
  credentialBlob: string;  // encrypted, decrypted on demand
}

const registry = new Map<string, RegistryEntry>();

function registryKey(channel: string, identifier: string): string {
  return `${channel}:${identifier}`;
}

export async function rebuildRegistry(db: DatabaseClient): Promise<void> {
  const result = await db.query(
    'SELECT channel, identifier, worker_id, workspace_id, credentials FROM ai_worker_channels WHERE enabled = true'
  );
  registry.clear();
  for (const row of result.rows) {
    registry.set(registryKey(row.channel, row.identifier), {
      workerId: row.worker_id,
      workspaceId: row.workspace_id,
      credentialBlob: row.credentials.encrypted,
    });
  }
}

export function lookupWorker(channel: string, identifier: string): RegistryEntry | undefined {
  return registry.get(registryKey(channel, identifier));
}

export function registerChannel(channel: string, identifier: string, entry: RegistryEntry): void {
  registry.set(registryKey(channel, identifier), entry);
}

export function unregisterChannel(channel: string, identifier: string): void {
  registry.delete(registryKey(channel, identifier));
}
```

Call `rebuildRegistry(db)` on server startup (in `server.ts`) after DB connection is established.

Also call `registerChannel` whenever a new channel row is created, and `unregisterChannel` on delete.

---

## Step 5: Message router

Create `src/channels/message-router.ts`:

```typescript
import { InboundMessage } from './types';
import { lookupWorker } from './worker-registry';
import { decryptCredentials } from './credential-store';
import { processAivaMessage } from '../aiva/aiva-api';  // the Aiva brain entry point
import { logActivity } from '../aiva/aiva-api';

export async function routeInboundMessage(
  channel: InboundMessage['channel'],
  identifier: string,
  buildMessage: (workerId: string, workspaceId: string) => InboundMessage | null,
): Promise<{ handled: boolean; response?: string }> {
  const entry = lookupWorker(channel, identifier);
  if (!entry) {
    console.warn(`[ROUTER] No Aiva found for ${channel}:${identifier}`);
    return { handled: false };
  }

  const message = buildMessage(entry.workerId, entry.workspaceId);
  if (!message) return { handled: false };

  // Upsert a channel thread record
  await upsertThread(message);

  // Log inbound activity
  await logActivity({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    actionType: 'message_received',
    summary: `Inbound ${channel} message from ${message.contactId}`,
    inputSummary: message.content.slice(0, 200),
  });

  // Process through Aiva brain
  const response = await processAivaMessage({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    userMessage: message.content,
    channel: message.channel,
    contactId: message.contactId,
    threadId: message.threadId,
  });

  return { handled: true, response };
}
```

`processAivaMessage` is the function in `aiva-api.ts` that runs the Aiva brain. Wire this in.
If the function does not exist by that name, find the equivalent (the chat handler) and call it.

---

## Step 6: Webhook router endpoints

Add to core backend (mount before auth middleware - webhooks have their own signature verification):

```typescript
// src/channels/channel-router.ts

router.post('/api/channels/webhook/whatsapp', express.raw({ type: '*/*' }), async (req, res) => {
  // 1. Import WhatsApp adapter (b/02)
  // 2. Verify signature
  // 3. Parse message(s) - WhatsApp may batch multiple messages
  // 4. For each message: routeInboundMessage('whatsapp', phoneNumberId, buildFn)
  // 5. After routing: look up adapter credentials and call adapter.send() with the response
  // 6. Return 200 immediately (WhatsApp requires fast ACK)
  res.sendStatus(200);
});

// WhatsApp webhook verification (GET request from Meta)
router.get('/api/channels/webhook/whatsapp', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

router.post('/api/channels/webhook/email', async (req, res) => {
  // Email inbound (Postmark or Resend inbound)
  // No raw body needed - email services send parsed JSON
  res.sendStatus(200);
});

router.post('/api/channels/webhook/slack', express.raw({ type: '*/*' }), async (req, res) => {
  // Handle Slack URL verification challenge AND message events
  const body = JSON.parse(req.body.toString());
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }
  res.sendStatus(200);
});

router.post('/api/channels/webhook/telegram', async (req, res) => {
  res.sendStatus(200);
});
```

Mount this router in `server.ts` BEFORE any auth middleware. Webhook routes authenticate via
their own signature verification, not session tokens.

---

## Step 7: Channel management API routes (workspace-facing)

```
GET    /api/channels                    List channels for workspace (reads from ai_worker_channels)
POST   /api/channels                    Add a channel to an Aiva
DELETE /api/channels/:id                Remove a channel
PATCH  /api/channels/:id/enable         Enable/disable a channel
GET    /api/channels/:id/test           Send a test message to verify the channel is working
```

These are workspace-authenticated routes (existing session). The portal Channels tab calls them.

`POST /api/channels` body:
```typescript
{
  workerId: string;
  channel: 'whatsapp' | 'email' | 'slack' | 'telegram';
  identifier: string;      // phone, email address, Slack team ID, Telegram bot token
  credentials: {           // raw, NOT encrypted - encrypted server-side before storage
    token?: string;
    webhookSecret?: string;
    appSecret?: string;
    botToken?: string;
  };
}
```

On POST: encrypt credentials, insert to DB, call `registerChannel()` on the registry, return channel row.
On DELETE: delete from DB, call `unregisterChannel()`.

---

## Step 8: Send response after Aiva generates it

In the webhook handler for each channel, after `routeInboundMessage` returns a response:

```typescript
if (result.handled && result.response) {
  const credentials = decryptCredentials(entry.credentialBlob);
  await adapter.send(
    {
      channel,
      contactId: message.contactId,
      content: result.response,
      replyToThreadId: message.threadId,
    },
    credentials
  );

  await logActivity({
    workerId: entry.workerId,
    workspaceId: entry.workspaceId,
    actionType: 'message_sent',
    summary: `Outbound ${channel} reply to ${message.contactId}`,
    outputSummary: result.response.slice(0, 200),
  });
}
```

---

## Done When

- [ ] `010-channels.sql` migration creates `ai_worker_channels` and `channel_threads` tables
- [ ] `encryptCredentials` and `decryptCredentials` work correctly (round-trip test)
- [ ] `ChannelAdapter` interface defined in `src/channels/types.ts`
- [ ] `worker-registry.ts` builds in-memory map from DB on startup
- [ ] `rebuildRegistry` called in `server.ts` after DB connection
- [ ] `lookupWorker` returns correct entry for a known (channel, identifier) pair
- [ ] `routeInboundMessage` finds the Aiva, calls processAivaMessage, returns response
- [ ] Webhook endpoints exist for whatsapp, email, slack, telegram (return 200 immediately)
- [ ] WhatsApp GET verification endpoint handles hub.challenge correctly
- [ ] Slack url_verification challenge handled in POST endpoint
- [ ] Channel management CRUD routes exist and are workspace-authenticated
- [ ] POST /api/channels encrypts credentials before DB insert
- [ ] Channel row UNIQUE constraint on (channel, identifier) prevents two Aivas sharing an identifier
- [ ] No em dashes in any copy or comments
