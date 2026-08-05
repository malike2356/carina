# Sprint 6 -- Prompt 01: Passive Channel Reading (Slack Adapter Upgrade)

**Status: COMPLETED 2026-07-26**

**What was built:**
- Implemented and archived

**Sprint:** 6 -- Channel-Aware Team Agent
**Prompt number:** 01 of 05
**Name:** Upgrade Slack adapter for passive message ingestion
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing (foundation)

---

## Read first

1. Master index: `sprint-6-claude-tag-00-master.md`
2. Existing Slack adapter: `02-backends/core.carinaai.uk/src/gateway/channels/adapters/slack.ts`
3. Channel adapter interface: `02-backends/core.carinaai.uk/src/gateway/channels/adapter-interface.ts`
4. Slack SDK docs: https://slack.dev/node-slack-sdk/

---

## Context

Carina's current Slack adapter is reactive. It listens for messages where
Carina is @mentioned or DM'd and responds. It does not read the channel
otherwise.

Claude Tag's innovation is that it reads ALL channel messages -- not just
when tagged. It sits in the channel, follows the conversation, and builds
tacit knowledge over time. This is what makes it feel like a teammate
rather than a bot.

This prompt upgrades Carina's Slack adapter to support passive reading.

---

## Goal

### Step 1: New Slack Event Subscription

Currently the adapter only handles `app_mention` and `message` in DMs.
Add handling for `message` events in channels where Carina is a member:

```typescript
// In slack.ts, extend event handling:

// OLD: only respond to app_mention and direct messages
// NEW: also capture all channel messages

slackClient.event('message', async ({ event, context }) => {
  // Skip bot messages (including our own)
  if (event.subtype === 'bot_message' || event.bot_id) return;

  // Determine message type
  const isDM = event.channel_type === 'im';
  const isMention = event.text?.includes(`<@${context.botUserId}>`);
  const isChannelMessage = event.channel_type === 'channel' && !isMention;

  if (isDM || isMention) {
    // Existing path: full agent response
    await handleDirectMessage(event, context);
  } else if (isChannelMessage && this.ambientMode) {
    // NEW: passive ingestion for ambient mode
    await this.ingestChannelMessage(event, context);
  }
});
```

### Step 2: Channel Message Ingestion

Create `02-backends/core.carinaai.uk/src/agents/ambient/channel-ingestion.ts`:

```typescript
export interface ChannelMessage {
  channelId: string; // Slack channel ID
  channelName: string; // #engineering, #sales, etc.
  userId: string; // Slack user ID
  userName: string; // Display name
  text: string; // Message content (plain text, stripped of formatting)
  timestamp: string; // ISO 8601
  threadTs?: string; // Thread parent if in thread
  isPinned: boolean;
  hasFiles: boolean;
  reactions: string[]; // Emoji reaction names
  permalink: string; // Deep link to message
}

export class ChannelIngestionService {
  private ingestionQueue: ChannelMessage[] = [];
  private processingInterval: NodeJS.Timeout | null = null;

  /**
   * Ingest a channel message for later processing.
   * Messages are batched and processed every 60 seconds to avoid
   * overwhelming the memory pipeline with individual messages.
   */
  ingest(message: ChannelMessage): void {
    this.ingestionQueue.push(message);

    // If queue gets large, flush now
    if (this.ingestionQueue.length >= 50) {
      this.flush();
    }
  }

  /**
   * Start periodic processing. Call this on Gateway start if ambient mode
   * is enabled.
   */
  start(batchIntervalMs = 60000): void {
    if (this.processingInterval) return;
    this.processingInterval = setInterval(() => this.flush(), batchIntervalMs);
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  private async flush(): Promise<void> {
    if (this.ingestionQueue.length === 0) return;

    const batch = this.ingestionQueue.splice(0);
    console.log(`[ambient] Processing ${batch.length} channel messages`);

    // Group by channel for context extraction
    const byChannel = new Map<string, ChannelMessage[]>();
    for (const msg of batch) {
      const existing = byChannel.get(msg.channelId) || [];
      existing.push(msg);
      byChannel.set(msg.channelId, existing);
    }

    // Extract facts per channel (prompt 02 handles the details)
    for (const [channelId, messages] of byChannel) {
      await extractChannelFacts(channelId, messages);
    }
  }
}
```

### Step 3: Ambient Mode Configuration

Add to `02-backends/core.carinaai.uk/src/config/schema.ts`:

```typescript
// Slack ambient mode configuration
CARINA_SLACK_AMBIENT_ENABLED: {
  type: 'boolean',
  default: false,
  description: 'Enable passive channel reading for context building',
},
CARINA_SLACK_AMBIENT_CHANNELS: {
  type: 'string',
  default: '',  // comma-separated channel IDs, empty = all channels Carina is in
  description: 'Channels to passively read (comma-separated IDs). Empty = all.',
},
CARINA_SLACK_AMBIENT_EXCLUDE_CHANNELS: {
  type: 'string',
  default: '',
  description: 'Channels to never read (e.g., #exec, #finance, #hr)',
},
CARINA_SLACK_AMBIENT_BATCH_INTERVAL_MS: {
  type: 'number',
  default: 60000,
  description: 'How often to process batched messages (ms)',
},
CARINA_SLACK_AMBIENT_MAX_MESSAGES_PER_BATCH: {
  type: 'number',
  default: 50,
  description: 'Max messages to process in one batch',
},
```

### Step 4: Privacy and Permission

```typescript
// Channel exclusion check
function isChannelAllowed(channelId: string, channelName: string): boolean {
  const allowed = process.env.CARINA_SLACK_AMBIENT_CHANNELS;
  const excluded = process.env.CARINA_SLACK_AMBIENT_EXCLUDE_CHANNELS;

  // Explicit exclusion always wins
  if (excluded) {
    const excludedIds = excluded.split(',').map(s => s.trim());
    if (excludedIds.includes(channelId) || excludedIds.includes(channelName)) {
      return false;
    }
  }

  // If allowlist is set, only allow those channels
  if (allowed) {
    const allowedIds = allowed.split(',').map(s => s.trim());
    return allowedIds.includes(channelId) || allowedIds.includes(channelName);
  }

  // Default: all channels Carina is a member of
  return true;
}
```

### Step 5: Slack Scopes Update

Document the required Slack scopes for ambient mode:

```
Existing: app_mentions:read, chat:write, im:history, channels:history, groups:history
New for ambient: channels:read, groups:read (to see all channel messages)
```

---

## Testing

```typescript
// tests/ambient/channel-ingestion.test.ts
describe('ChannelIngestionService', () => {
  it('batches messages and flushes at interval');
  it('groups messages by channel before extraction');
  it('excludes blocked channels');
  it('respects max batch size');
  it('starts and stops periodic processing');
});

// tests/gateway/slack-ambient.test.ts
describe('Slack ambient mode', () => {
  it('ingests channel messages when ambient mode enabled');
  it('skips channel messages when ambient mode disabled');
  it('handles app_mention normally regardless of ambient mode');
  it('strips bot messages and our own messages');
});
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/gateway/channels/adapters/slack.ts` -- extend
- `02-backends/core.carinaai.uk/src/gateway/channels/adapter-interface.ts` -- optional new method
- `02-backends/core.carinaai.uk/src/agents/ambient/` -- new directory
- `02-backends/core.carinaai.uk/src/config/schema.ts` -- add env vars
