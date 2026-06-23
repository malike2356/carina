# Sprint 4 - Prompt b/04: Slack Bot Adapter

**Sprint:** 4 - Foundation
**Prompt number:** b/04
**Name:** Slack bot adapter - OAuth install, DM handling, message send, event verification
**Primary agent:** Claude Code
**Estimated hours:** 5-6 h
**Depends on:** b/01 (channel infrastructure)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/b/`.

---

## Step 1: Slack app creation (document in CHANNEL-SETUP.md)

Each workspace installs one Slack bot (one per Aiva, or one per workspace with routing - use
per-workspace: simpler, one Slack app token per VERLOX Slack App installation).

Document in `infrastructure/CHANNEL-SETUP.md`:

```markdown
## Slack Setup

1. Go to api.slack.com/apps -> Create New App -> From scratch
2. Name: [Your Aiva name] (e.g. "Alex from Propman Co")
3. OAuth & Permissions:
   - Bot Token Scopes: chat:write, im:history, im:read, im:write, users:read
4. Event Subscriptions:
   - Enable Events
   - Request URL: https://core.carinaai.uk/api/channels/webhook/slack
   - Subscribe to bot events: message.im
5. Install App to Workspace -> copy Bot User OAuth Token
6. Copy Signing Secret from Basic Information
7. Enter both in the portal Channels tab for your Aiva
```

---

## Step 2: Environment variables

Add to `.env.example`:
```env
# Per-workspace credentials stored in ai_worker_channels.credentials:
# { bot_token, signing_secret, team_id }
# No global Slack env vars needed in v1 (single-tenant Slack app per workspace)
```

---

## Step 3: Slack adapter

Create `src/channels/adapters/slack-adapter.ts`:

```typescript
import { ChannelAdapter, InboundMessage, OutboundMessage } from '../types';
import crypto from 'crypto';

export const slackAdapter: ChannelAdapter = {
  channel: 'slack',

  verify(headers, rawBody) {
    const timestamp = headers['x-slack-request-timestamp'];
    const sig = headers['x-slack-signature'];
    if (!timestamp || !sig) return false;

    // Reject old requests (replay protection)
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

    // Signature check requires the signing secret - which is per-workspace.
    // For signature verification before routing, we need a global signing secret.
    // Solution: use a single Slack app (one signing secret for all VERLOX-connected workspaces).
    // The bot_token is per-workspace but the signing_secret is the same for all.
    const signingSecret = process.env.SLACK_SIGNING_SECRET!;
    const base = `v0:${timestamp}:${rawBody.toString()}`;
    const expected = 'v0=' + crypto.createHmac('sha256', signingSecret).update(base).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  },

  parse(payload: unknown, workerId: string, workspaceId: string): InboundMessage | null {
    const body = payload as SlackEventPayload;

    // Handle URL verification (already handled in router before calling parse)
    if (body.type === 'url_verification') return null;

    const event = body.event;
    if (!event || event.type !== 'message') return null;
    if (event.bot_id) return null;       // ignore bot messages (avoid echo loop)
    if (event.subtype) return null;      // ignore edits, deletions

    return {
      channel: 'slack',
      workerId,
      workspaceId,
      contactId: event.user,            // Slack user ID
      content: event.text || '',
      rawPayload: payload,
      timestamp: new Date(parseFloat(event.ts) * 1000),
      threadId: event.thread_ts || event.ts,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const { bot_token } = credentials;

    const body = {
      channel: message.contactId,   // DM: channel = user ID for im channels
      text: message.content,
      ...(message.replyToThreadId ? { thread_ts: message.replyToThreadId } : {}),
    };

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bot_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Slack send failed: ${result.error}`);
    }
  },
};

interface SlackEventPayload {
  type: string;
  event?: {
    type: string;
    user: string;
    text: string;
    ts: string;
    thread_ts?: string;
    bot_id?: string;
    subtype?: string;
  };
  team_id?: string;
}
```

Add to `.env.example`:
```env
SLACK_SIGNING_SECRET=   # from the Slack app's Basic Information page (same for all workspaces using this Slack app)
```

---

## Step 4: Wire into channel router

In `src/channels/channel-router.ts`:

```typescript
import { slackAdapter } from './adapters/slack-adapter';

router.post('/api/channels/webhook/slack', express.raw({ type: '*/*' }), async (req, res) => {
  const rawBody = req.body as Buffer;

  // URL verification happens before signature check (Slack sends challenge before app is configured)
  const body = JSON.parse(rawBody.toString());
  if (body.type === 'url_verification') {
    return res.json({ challenge: body.challenge });
  }

  if (!slackAdapter.verify(
    Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
    rawBody
  )) {
    return res.sendStatus(401);
  }

  // ACK before processing - Slack requires response within 3 seconds
  res.sendStatus(200);

  const teamId = body.team_id;
  if (!teamId) return;

  const result = await routeInboundMessage(
    'slack',
    teamId,
    (workerId, workspaceId) => slackAdapter.parse(body, workerId, workspaceId)
  );

  if (result.handled && result.response) {
    const entry = lookupWorker('slack', teamId);
    if (entry) {
      const credentials = decryptCredentials(entry.credentialBlob);
      const event = body.event;
      await slackAdapter.send(
        {
          channel: 'slack',
          contactId: event.user,
          content: result.response,
          replyToThreadId: event.thread_ts || event.ts,
        },
        credentials
      );
    }
  }
});
```

---

## Step 5: Slack channel identifier

For Slack, the `identifier` stored in `ai_worker_channels` is the Slack `team_id` (workspace ID).
This allows one bot installation per Slack workspace, routing all DMs to the correct Aiva.

When the workspace owner adds a Slack channel in the portal, they enter the Slack team ID.
This is visible in the Slack workspace URL: `https://yourteam.slack.com/` -> the team ID is
shown in admin settings or via the Slack API `team.info` endpoint.

Document this in the portal Channels tab help text.

---

## Done When

- [ ] Slack adapter `verify()` validates X-Slack-Signature with HMAC-SHA256 and rejects requests older than 5 minutes
- [ ] `url_verification` challenge handled before signature check
- [ ] `parse()` ignores bot messages and message edits/deletions
- [ ] `send()` calls `chat.postMessage` with bot_token from credentials
- [ ] Thread continuity maintained via `thread_ts`
- [ ] Bot echo loop prevented (bot_id check in parse)
- [ ] Channel router wires Slack adapter; ACKs Slack within 3 seconds
- [ ] Team ID used as channel identifier; documented in portal help text
- [ ] `SLACK_SIGNING_SECRET` env var added to .env.example
- [ ] `infrastructure/CHANNEL-SETUP.md` has Slack setup section
- [ ] No em dashes in comments
