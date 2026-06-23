# Sprint 4 - Prompt b/02: WhatsApp Business API Adapter

**Sprint:** 4 - Foundation
**Prompt number:** b/02
**Name:** WhatsApp Cloud API adapter - inbound, outbound, signature verification, 24h window handling
**Primary agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** b/01 (channel infrastructure) must be built first

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/b/`.

---

## Read First

1. `backends/servers/core.carinaai.uk/src/channels/types.ts` - ChannelAdapter interface from b/01
2. `backends/servers/core.carinaai.uk/src/channels/channel-router.ts` - the WhatsApp webhook handler from b/01; this adapter plugs into it

---

## External setup (document in infrastructure/CHANNEL-SETUP.md)

The workspace owner must complete these steps before connecting WhatsApp. Document them in
`infrastructure/CHANNEL-SETUP.md` and show condensed versions in the portal Channels tab help text.

```markdown
## WhatsApp Business API Setup

1. Create a Meta Business account at business.facebook.com
2. Go to developers.facebook.com -> My Apps -> Create App -> Business
3. Add WhatsApp product to the app
4. Add a phone number (must be a real number; virtual numbers are not accepted)
5. Verify the phone number via SMS OTP
6. In the WhatsApp configuration:
   - Webhook URL: https://core.carinaai.uk/api/channels/webhook/whatsapp
   - Verify token: [WHATSAPP_WEBHOOK_VERIFY_TOKEN from env]
   - Subscribe to: messages
7. Copy the Access Token (permanent token from System User, not a temporary token)
8. Copy the Phone Number ID (shown in the WhatsApp dashboard)
9. Copy the App Secret (from App Settings -> Basic)
10. Enter these in the portal Channels tab for your Aiva
```

---

## Step 1: Environment variables

Add to `.env.example`:
```env
WHATSAPP_WEBHOOK_VERIFY_TOKEN=   # random string you choose; set same in Meta webhook config
# Per-workspace credentials are stored encrypted in ai_worker_channels.credentials
# Keys stored there: { access_token, phone_number_id, app_secret }
```

---

## Step 2: WhatsApp adapter

Create `src/channels/adapters/whatsapp-adapter.ts`:

```typescript
import { ChannelAdapter, InboundMessage, OutboundMessage } from '../types';
import crypto from 'crypto';

export const whatsappAdapter: ChannelAdapter = {
  channel: 'whatsapp',

  verify(headers, rawBody) {
    const sig = headers['x-hub-signature-256'];
    if (!sig) return false;
    // app_secret comes from the per-workspace credentials, not env
    // For the webhook receiver, we need the app secret of each workspace's Meta app.
    // However, at verify-time we don't know which workspace's app is being called.
    // Approach: store a global WHATSAPP_APP_SECRET for a single Meta app (simplest),
    // OR: look up the phone number ID from the payload first (parse before verify).
    // For v1: use a single Meta app for all workspaces (one WHATSAPP_APP_SECRET).
    // Enterprise multi-app support can be added later.
    const appSecret = process.env.WHATSAPP_APP_SECRET!;
    const expected = 'sha256=' + crypto.createHmac('sha256', appSecret)
      .update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  },

  parse(payload: unknown, workerId: string, workspaceId: string): InboundMessage | null {
    const body = payload as WhatsAppWebhookPayload;
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) return null;  // status update, not a message

    // Only handle text messages in v1
    if (message.type !== 'text') {
      // Acknowledge but do not process images, audio, documents
      return null;
    }

    return {
      channel: 'whatsapp',
      workerId,
      workspaceId,
      contactId: message.from,   // phone number in E.164 format
      contactName: value.contacts?.[0]?.profile?.name,
      content: message.text.body,
      rawPayload: payload,
      timestamp: new Date(parseInt(message.timestamp, 10) * 1000),
      threadId: message.id,
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const { access_token, phone_number_id } = credentials;
    const url = `https://graph.facebook.com/v19.0/${phone_number_id}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: message.contactId,
      type: 'text',
      text: {
        preview_url: false,
        body: message.content,
      },
      ...(message.replyToThreadId ? { context: { message_id: message.replyToThreadId } } : {}),
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      // Handle 24h window violation gracefully
      if (error?.error?.code === 131047) {
        throw new WhatsApp24hWindowError(message.contactId);
      }
      throw new Error(`WhatsApp send failed: ${JSON.stringify(error)}`);
    }
  },
};

class WhatsApp24hWindowError extends Error {
  constructor(public contactId: string) {
    super(`24h messaging window expired for ${contactId}`);
    this.name = 'WhatsApp24hWindowError';
  }
}
```

---

## Step 3: Wire into the channel router

In `src/channels/channel-router.ts` (built in b/01), import and use the adapter:

```typescript
import { whatsappAdapter } from './adapters/whatsapp-adapter';

router.post('/api/channels/webhook/whatsapp', express.raw({ type: '*/*' }), async (req, res) => {
  // ACK immediately - WhatsApp times out if response takes > 5 seconds
  res.sendStatus(200);

  const rawBody = req.body as Buffer;

  if (!whatsappAdapter.verify(Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])), rawBody)) {
    console.warn('[WhatsApp] Invalid signature - ignoring');
    return;
  }

  const payload = JSON.parse(rawBody.toString());

  // A single webhook call may contain multiple messages
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;
  const messages = value?.messages || [];

  const phoneNumberId = value?.metadata?.phone_number_id;
  if (!phoneNumberId) return;

  for (const rawMsg of messages) {
    const partialPayload = { ...payload };  // per-message payload

    try {
      const result = await routeInboundMessage(
        'whatsapp',
        phoneNumberId,
        (workerId, workspaceId) => whatsappAdapter.parse(partialPayload, workerId, workspaceId)
      );

      if (result.handled && result.response) {
        const entry = lookupWorker('whatsapp', phoneNumberId);
        if (entry) {
          const credentials = decryptCredentials(entry.credentialBlob);
          await whatsappAdapter.send(
            { channel: 'whatsapp', contactId: rawMsg.from, content: result.response, replyToThreadId: rawMsg.id },
            credentials
          );
        }
      }
    } catch (err) {
      if (err instanceof WhatsApp24hWindowError) {
        // 24h window expired: log and escalate to human VA
        await handleChannelEscalation({
          channel: 'whatsapp',
          contactId: rawMsg.from,
          reason: '24h messaging window expired. Client must message first to restart the conversation.',
          workerId: ...,  // from registry lookup
        });
      } else {
        console.error('[WhatsApp] Handler error:', err);
      }
    }
  }
});
```

---

## Step 4: 24h window handling

WhatsApp requires that a business can only send a free-form message within 24 hours of the last
message received from the contact. After 24 hours, only approved template messages can be sent.

For v1, VERLOX does not need to support template messages. The handling is:

1. When `WhatsApp24hWindowError` is thrown in the send step, call `handleChannelEscalation()`.
2. This creates an `aiva_escalations` row with `reason = '24h window expired'`.
3. The VA team sees it in the admin queue and can follow up with the client via another method.
4. Log the error to Scout as `channel_window_expired` info event.

Do not attempt to send template messages in v1. Document this limitation in `CHANNEL-SETUP.md`.

---

## Step 5: Message status webhooks

WhatsApp also sends delivery/read receipts as webhook calls to the same endpoint.
These arrive as `value.statuses` instead of `value.messages`. Handle them:

```typescript
const statuses = value?.statuses || [];
for (const status of statuses) {
  // status.id = message ID, status.status = 'sent' | 'delivered' | 'read' | 'failed'
  if (status.status === 'failed') {
    console.error('[WhatsApp] Message delivery failed:', status.id, status.errors);
    // Log to scout_signal_cache as a warning
  }
  // 'delivered' and 'read': can be used for future analytics - ignore in v1
}
```

---

## Done When

- [ ] `src/channels/adapters/whatsapp-adapter.ts` implements `ChannelAdapter` interface
- [ ] `verify()` checks X-Hub-Signature-256 header using HMAC-SHA256 of raw body
- [ ] `parse()` extracts text messages; returns null for non-text types
- [ ] `send()` posts to graph.facebook.com/v19.0/{phone_number_id}/messages
- [ ] `send()` throws `WhatsApp24hWindowError` on error code 131047
- [ ] 24h window error triggers `handleChannelEscalation()` with descriptive reason
- [ ] Status webhooks (delivered, read, failed) processed without throwing
- [ ] WhatsApp GET verification endpoint responds with hub.challenge when token matches
- [ ] Adapter registered in channel router; router calls it for /api/channels/webhook/whatsapp
- [ ] Per-workspace credentials (access_token, phone_number_id, app_secret) fetched from registry
- [ ] `infrastructure/CHANNEL-SETUP.md` created with WhatsApp setup instructions
- [ ] No em dashes in comments or copy
