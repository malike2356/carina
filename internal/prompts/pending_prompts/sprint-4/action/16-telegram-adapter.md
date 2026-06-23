# Sprint 4 - Prompt b/05: Telegram Bot Adapter

**Sprint:** 4 - Foundation
**Prompt number:** b/05
**Name:** Telegram bot adapter - webhook registration, message handling, send
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** b/01 (channel infrastructure)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/b/`.

---

## Step 1: Telegram setup (document in CHANNEL-SETUP.md)

Each Aiva gets its own Telegram bot. The workspace owner creates the bot via BotFather:

```markdown
## Telegram Setup

1. Open Telegram and message @BotFather
2. Send /newbot
3. Enter a name for the bot: "[WorkerName] Assistant"
4. Enter a username: [workername]_[yourcompany]_bot
5. Copy the bot token (looks like: 7123456789:AAFxxxxxxxx)
6. Enter the token in the portal Channels tab for your Aiva
7. The system will automatically register the webhook.
```

The identifier stored in `ai_worker_channels` is the bot token itself (encrypted in credentials).
The public identifier used for routing is the bot_id (extracted from the token: first part before `:`).

---

## Step 2: Webhook auto-registration

When the workspace owner saves a Telegram channel in the portal:

```typescript
// Called from POST /api/channels after saving to DB
async function registerTelegramWebhook(botToken: string, workerId: string): Promise<void> {
  const webhookUrl = `${process.env.CORE_URL}/api/channels/webhook/telegram/${workerId}`;
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: webhookUrl,
        allowed_updates: ['message'],
        secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      }),
    }
  );
  const result = await response.json();
  if (!result.ok) {
    throw new Error(`Telegram webhook registration failed: ${result.description}`);
  }
}
```

Use per-worker webhook URLs so routing is trivial: `/api/channels/webhook/telegram/:workerId`.
The `secret_token` parameter makes Telegram include `X-Telegram-Bot-Api-Secret-Token` on every
webhook call, used for verification.

Add to `.env.example`:
```env
TELEGRAM_WEBHOOK_SECRET=   # random string, set once, used for all Telegram bots
```

---

## Step 3: Telegram adapter

Create `src/channels/adapters/telegram-adapter.ts`:

```typescript
import { ChannelAdapter, InboundMessage, OutboundMessage } from '../types';

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; last_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

export const telegramAdapter: ChannelAdapter = {
  channel: 'telegram',

  verify(headers) {
    const secret = headers['x-telegram-bot-api-secret-token'];
    return secret === process.env.TELEGRAM_WEBHOOK_SECRET;
  },

  parse(payload: unknown, workerId: string, workspaceId: string): InboundMessage | null {
    const update = payload as TelegramUpdate;
    const message = update.message;

    if (!message?.text) return null;  // ignore non-text (stickers, photos, etc.)

    // Only handle private chats in v1 (type = 'private')
    if (message.chat.type !== 'private') return null;

    const contactName = [message.from.first_name, message.from.last_name]
      .filter(Boolean).join(' ');

    return {
      channel: 'telegram',
      workerId,
      workspaceId,
      contactId: String(message.from.id),
      contactName,
      content: message.text,
      rawPayload: payload,
      timestamp: new Date(message.date * 1000),
      threadId: String(message.chat.id),
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const { bot_token } = credentials;
    const chatId = message.threadId || message.contactId;  // Telegram chatId = contactId for private chats

    const response = await fetch(
      `https://api.telegram.org/bot${bot_token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.content,
          parse_mode: 'Markdown',
        }),
      }
    );

    const result = await response.json();
    if (!result.ok) {
      throw new Error(`Telegram send failed: ${result.description}`);
    }
  },
};
```

---

## Step 4: Per-worker webhook endpoint

Unlike other channels where one endpoint routes all messages, Telegram uses per-worker endpoints
to avoid needing a lookup (the URL itself identifies the Aiva):

```typescript
// In channel-router.ts
router.post('/api/channels/webhook/telegram/:workerId', async (req, res) => {
  // ACK Telegram immediately
  res.sendStatus(200);

  if (!telegramAdapter.verify(
    Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]))
  )) {
    console.warn('[Telegram] Invalid secret token');
    return;
  }

  const { workerId } = req.params;

  // Look up the Aiva directly by workerId (skip registry lookup since URL gives us workerId)
  const workerRow = await db.query(
    'SELECT workspace_id, credentials FROM ai_worker_channels WHERE worker_id = $1 AND channel = $2 AND enabled = true',
    [workerId, 'telegram']
  );
  if (!workerRow.rows[0]) return;

  const { workspace_id, credentials } = workerRow.rows[0];
  const creds = decryptCredentials(credentials.encrypted);

  const message = telegramAdapter.parse(req.body, workerId, workspace_id);
  if (!message) return;

  const result = await processAivaMessage({
    workerId,
    workspaceId: workspace_id,
    userMessage: message.content,
    channel: 'telegram',
    contactId: message.contactId,
    threadId: message.threadId,
  });

  if (result.response) {
    await telegramAdapter.send(
      {
        channel: 'telegram',
        contactId: message.contactId,
        content: result.response,
        threadId: message.threadId,
      },
      creds
    );
  }
});
```

---

## Done When

- [ ] Telegram adapter `verify()` checks X-Telegram-Bot-Api-Secret-Token header
- [ ] `parse()` handles text messages in private chats; returns null for group chats and non-text
- [ ] `send()` calls sendMessage API with bot_token from credentials
- [ ] `registerTelegramWebhook()` called automatically when workspace owner saves a Telegram channel
- [ ] Per-worker webhook URL (`/api/channels/webhook/telegram/:workerId`) routes correctly
- [ ] `TELEGRAM_WEBHOOK_SECRET` env var added to .env.example
- [ ] `infrastructure/CHANNEL-SETUP.md` has Telegram setup section
- [ ] No em dashes in comments
