# Sprint 6 -- Prompt 05: @Carina Channel Trigger (Team-Visible Responses)

**Sprint:** 6 -- Channel-Aware Team Agent
**Prompt number:** 05 of 05
**Name:** @Carina mention in channels without DM, shared visibility, threaded replies
**Primary agent:** Claude Code
**Estimated hours:** 2-3 h
**Depends on:** 04-channel-scoped-memory.md (needs scoped context for responses)

---

## Read first

1. Master index: `sprint-6-claude-tag-00-master.md`
2. `02-backends/core.carinaai.uk/src/gateway/channels/adapters/slack.ts` -- Slack adapter
3. `02-backends/core.carinaai.uk/src/gateway/router.ts` -- GatewayRouter
4. `02-backends/core.carinaai.uk/src/agents/agent-runner.ts` -- agent loop

---

## Context

Carina currently responds to DMs and `@Carina` in channels where it's
mentioned. But the existing `app_mention` handler treats it like a DM
-- the response goes to the channel, but there's no channel context,
no shared visibility of the full conversation, and no threading.

Claude Tag's @mention is different:
1. Anyone in the channel can @Claude -- not just the person who invited it
2. The response is threaded, so the channel stays clean
3. Anyone can see what Claude is working on and pick up the thread
4. The response draws on channel-scoped context (prompt 04)

This prompt upgrades Carina's `app_mention` handler to the channel-resident
pattern.

---

## Goal

### Step 1: Upgrade app_mention Handler

```typescript
// In slack.ts, upgrade the existing app_mention handler:

slackClient.event('app_mention', async ({ event, context }) => {
  const channelId = event.channel;

  // 1. Determine if this is a channel or DM
  const isDM = event.channel_type === 'im';
  const channelInfo = isDM ? null : await this.getChannelInfo(channelId);

  // 2. Resolve the appropriate agent for this channel
  const agentId = await this.resolveAgentForChannel(
    channelId,
    channelInfo?.name
  );

  // 3. Build channel-aware system prompt (prompt 04 provides context)
  const channelContext = isDM ? null :
    await this.buildChannelContext(channelId, channelInfo?.name);

  // 4. Parse the user's request (strip @Carina mention)
  const userMessage = this.stripMention(event.text, context.botUserId);

  // 5. Run the agent with channel context
  const response = await this.runAgent(agentId, {
    message: userMessage,
    userId: event.user,
    channelId,
    channelName: channelInfo?.name,
    channelContext,
    isDM,
  });

  // 6. Post response in thread (channels) or as direct reply (DMs)
  if (isDM) {
    await this.sendDM(event.user, response);
  } else {
    await this.sendThreadedReply(channelId, event.ts, response);
  }

  // 7. Update channel context with this interaction
  if (!isDM) {
    await this.recordInteraction(channelId, {
      userId: event.user,
      question: userMessage,
      response: response.summary,
      timestamp: new Date().toISOString(),
    });
  }
});
```

### Step 2: Threaded Replies

Channel responses go in threads, keeping the main channel clean:

```typescript
async function sendThreadedReply(
  channelId: string,
  parentTs: string,     // The @Carina message timestamp
  response: AgentResponse,
): Promise<void> {
  // Thread the reply so the channel isn't cluttered
  await slackClient.chat.postMessage({
    channel: channelId,
    thread_ts: parentTs,   // Reply in thread
    text: response.text,
    blocks: buildResponseBlocks(response),
    // Broadcast to channel only if the response is high-signal
    reply_broadcast: response.shouldBroadcast || false,
  });

  // Add a reaction to the original message to show it's being worked on
  await slackClient.reactions.add({
    channel: channelId,
    timestamp: parentTs,
    name: 'eyes',  // "I'm looking at this"
  });
}
```

### Step 3: @Carina in Threads

If someone @mentions Carina inside an existing thread, Carina reads
the full thread context before responding:

```typescript
slackClient.event('app_mention', async ({ event, context }) => {
  // If the mention is inside a thread, fetch the full thread
  if (event.thread_ts) {
    const threadMessages = await slackClient.conversations.replies({
      channel: event.channel,
      ts: event.thread_ts,
      limit: 50,  // reasonable context window
    });

    // Inject thread messages as additional context
    event.threadContext = threadMessages.messages || [];
  }

  // ... continue with normal handler
});
```

### Step 4: Visibility Controls

```typescript
// Admins can control how Carina responds in channels:

interface ChannelResponseConfig {
  mode: 'thread' | 'channel' | 'ephemeral';
  // thread: always reply in thread (default)
  // channel: reply directly in channel (for announcements)
  // ephemeral: only the @mention-er sees the response

  broadcastOnComplete: boolean;
  // If true, broadcast the final result to the channel when done
  // Useful for long-running tasks

  mentionRequired: boolean;
  // If true, only respond to @Carina mentions
  // If false, respond to any message in the channel (danger: noisy)
}

// Set per-channel:
// /carina channel-config mode thread
// /carina channel-config broadcast true
// /carina channel-config mention-required true
```

### Step 5: @Carina in Multiple Channels

When Carina is a member of multiple channels, each @mention is handled
by the correct agent based on the channel binding:

```typescript
// In workspaces/agent-routing.ts, extend binding resolution:

async function resolveAgentForChannel(
  channelId: string,
  channelName?: string,
): Promise<string> {
  // 1. Check for explicit channel binding
  const binding = await db.query(
    'SELECT agent_id FROM channel_agent_bindings WHERE channel_id = ?',
    [channelId]
  );

  if (binding) return binding.agent_id;

  // 2. Check for channel name pattern binding
  // e.g., all #engineering-* channels go to engineering-agent
  const patternBinding = await matchChannelPattern(channelName);
  if (patternBinding) return patternBinding.agent_id;

  // 3. Default agent
  return 'default';
}
```

### Step 6: DM Fallback

Users can always DM Carina directly. DMs get the user's PERSONAL context
(not channel context). DMs are private. DMs are not threaded.

```typescript
// DM behaviour: full agent, no channel context, private response
// This already works -- no changes needed.
// Just confirm it doesn't accidentally inject channel context into DMs.
```

---

## Testing

```typescript
// tests/gateway/slack-channel-trigger.test.ts
describe('@Carina channel trigger', () => {
  it('responds in thread when @mentioned in channel');
  it('uses channel-scoped context for channel responses');
  it('does not use channel context for DMs');
  it('reads full thread context when mentioned inside a thread');
  it('resolves correct agent per channel binding');
  it('respects channel response mode config');
  it('respects broadcastOnComplete setting');
  it('adds eyes reaction when starting work');
  it('strips @Carina mention from message text');
});

// tests/gateway/slack-dm.test.ts
describe('DM behaviour', () => {
  it('responds privately to DMs');
  it('does not inject channel context into DMs');
  it('uses personal/user-scoped memory for DMs');
});
```

---

## Existing Carina code to integrate with

- `02-backends/core.carinaai.uk/src/gateway/channels/adapters/slack.ts` -- upgrade handler
- `02-backends/core.carinaai.uk/src/workspaces/agent-routing.ts` -- channel binding
- `02-backends/core.carinaai.uk/src/agents/system-prompt.ts` -- inject channel context
- `02-backends/core.carinaai.uk/src/agents/ambient/` -- channel context from prompt 02
- `02-backends/core.carinaai.uk/src/db/migrations/` -- channel_agent_bindings table
