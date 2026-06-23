# Sprint 4 - Prompt b/03: Email Channel Adapter

**Sprint:** 4 - Foundation
**Prompt number:** b/03
**Name:** Email channel - inbound via Postmark inbound, outbound via Resend, thread tracking
**Primary agent:** Claude Code
**Estimated hours:** 5-6 h
**Depends on:** b/01 (channel infrastructure), a/01 (email service - Resend must be set up)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/b/`.

---

## Context

Each Aiva with an email channel gets a dedicated inbound email address:
`[workerSlug]@mail.carinaai.uk`

For example, a property manager Aiva named "Alex" gets `alex-propman@mail.carinaai.uk`. Clients
email that address. The email is delivered to the backend via Postmark Inbound webhook.

The Aiva replies from that same address so the thread stays coherent for the client.

---

## Step 1: Postmark Inbound setup

Use Postmark's inbound email processing (`postmarkapp.com`).

1. Create a Postmark account (or add an inbound server to the existing Resend/Postmark account)
2. Add a Postmark Inbound Stream
3. Set the inbound webhook URL: `https://core.carinaai.uk/api/channels/webhook/email`
4. Set the inbound domain: `mail.carinaai.uk`
5. Add a MX record at DNS provider: `mail.carinaai.uk MX 10 inbound.postmarkapp.com`
6. Add this to `infrastructure/CHANNEL-SETUP.md`

Add to `.env.example`:
```env
POSTMARK_INBOUND_WEBHOOK_TOKEN=   # from Postmark dashboard, used to verify inbound webhooks
# Outbound email already handled by Resend (from a/01)
# Replies are sent FROM [workerSlug]@mail.carinaai.uk VIA Resend
```

---

## Step 2: Aiva email address generation

When a workspace owner adds an email channel to an Aiva:

```typescript
// POST /api/channels body: { workerId, channel: 'email', identifier: 'alex-propman@mail.carinaai.uk' }
// The identifier IS the inbound email address.
// Generate a slug on the backend from the worker name if the owner does not provide one.

function generateEmailSlug(workerName: string, workerId: string): string {
  const base = workerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 20);
  const suffix = workerId.slice(0, 6);
  return `${base}-${suffix}@mail.carinaai.uk`;
}
```

Show the generated address in the portal Channels tab: "Your clients can email your Aiva at
[address]. Share this address with them."

---

## Step 3: Email adapter

Create `src/channels/adapters/email-adapter.ts`:

```typescript
import { ChannelAdapter, InboundMessage, OutboundMessage } from '../types';
import { sendEmail } from '../../email/email-service';
import crypto from 'crypto';
import React from 'react';

// Postmark Inbound payload shape (partial)
interface PostmarkInboundPayload {
  From: string;
  FromFull: { Email: string; Name: string };
  To: string;
  ToFull: Array<{ Email: string; Name: string }>;
  Subject: string;
  TextBody: string;
  HtmlBody: string;
  MessageID: string;
  Headers: Array<{ Name: string; Value: string }>;
  ReplyTo: string;
}

export const emailAdapter: ChannelAdapter = {
  channel: 'email',

  verify(headers, rawBody) {
    // Postmark signs inbound webhooks with a token in the X-Postmark-Inbound-Token header
    // OR you can use a basic auth username/password on the webhook URL.
    // Simplest: check a shared token header.
    const token = headers['x-postmark-inbound-token'];
    return token === process.env.POSTMARK_INBOUND_WEBHOOK_TOKEN;
  },

  parse(payload: unknown, workerId: string, workspaceId: string): InboundMessage | null {
    const p = payload as PostmarkInboundPayload;
    if (!p.From || !p.TextBody) return null;

    const content = stripQuotedReply(p.TextBody);
    if (!content.trim()) return null;  // empty after stripping quoted reply

    const inReplyTo = p.Headers.find(h => h.Name === 'In-Reply-To')?.Value;

    return {
      channel: 'email',
      workerId,
      workspaceId,
      contactId: p.FromFull.Email.toLowerCase(),
      contactName: p.FromFull.Name || undefined,
      content: content.trim(),
      rawPayload: payload,
      timestamp: new Date(),
      threadId: inReplyTo || p.MessageID,  // use In-Reply-To for threading, or MessageID for new threads
    };
  },

  async send(message: OutboundMessage, credentials: Record<string, string>): Promise<void> {
    const { from_address, worker_name } = credentials;
    // from_address: the Aiva's inbound email (e.g. alex-propman@mail.carinaai.uk)
    // worker_name: the Aiva's display name (e.g. "Alex")

    await sendEmail({
      to: message.contactId,
      subject: buildReplySubject(message.metadata?.originalSubject),
      template: <PlainEmailTemplate content={message.content} />,
      replyTo: from_address,
      tags: [{ name: 'channel', value: 'aiva-email' }],
    });
    // The Resend from address must be verified; use from_address as the reply-to
    // and a verified VERLOX address as the From. This means replies come back to the Aiva address.
  },
};

function stripQuotedReply(text: string): string {
  // Remove common email reply quote patterns:
  // "On [date] [name] wrote:" and everything after it
  // Lines starting with > (quoted)
  return text
    .replace(/\n>.*$/gm, '')                           // lines starting with >
    .replace(/\n?On .+wrote:\n?[\s\S]*$/m, '')         // "On X wrote:" onwards
    .replace(/\n?[-_]{3,}.*Original Message.*$/im, '') // "--- Original Message ---"
    .trim();
}

function buildReplySubject(original?: string): string {
  if (!original) return 'Re: Your enquiry';
  return original.startsWith('Re: ') ? original : `Re: ${original}`;
}
```

The `PlainEmailTemplate` component renders a simple text email layout (no marketing styling):

```tsx
// src/email/templates/plain-reply.tsx
import { Html, Body, Text } from '@react-email/components';
import React from 'react';

export function PlainEmailTemplate({ content }: { content: string }) {
  return (
    <Html>
      <Body>
        {content.split('\n').map((line, i) => (
          <Text key={i} style={{ margin: '0 0 8px', fontFamily: 'sans-serif', fontSize: '14px', color: '#111' }}>
            {line || ' '}
          </Text>
        ))}
        <Text style={{ marginTop: '24px', fontSize: '12px', color: '#6b7280' }}>
          This message was sent by an AI assistant. Reply to this email to continue the conversation.
        </Text>
      </Body>
    </Html>
  );
}
```

---

## Step 4: Wire into channel router

In `src/channels/channel-router.ts`:

```typescript
import { emailAdapter } from './adapters/email-adapter';

router.post('/api/channels/webhook/email', async (req, res) => {
  // Postmark sends JSON-parsed body
  const rawBody = Buffer.from(JSON.stringify(req.body));

  if (!emailAdapter.verify(
    Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
    rawBody
  )) {
    return res.sendStatus(401);
  }

  const payload = req.body as PostmarkInboundPayload;

  // The "To" field tells us which Aiva email address received this message
  const toEmail = payload.ToFull?.[0]?.Email?.toLowerCase();
  if (!toEmail) return res.sendStatus(200);

  const result = await routeInboundMessage(
    'email',
    toEmail,                  // the Aiva's inbound address is the identifier
    (workerId, workspaceId) => emailAdapter.parse(payload, workerId, workspaceId)
  );

  if (result.handled && result.response) {
    const entry = lookupWorker('email', toEmail);
    if (entry) {
      const credentials = decryptCredentials(entry.credentialBlob);
      // Add original subject and from address to metadata for the adapter
      const enrichedCredentials = {
        ...credentials,
        from_address: toEmail,
      };
      await emailAdapter.send(
        {
          channel: 'email',
          contactId: payload.FromFull.Email,
          content: result.response,
          replyToThreadId: payload.MessageID,
          metadata: { originalSubject: payload.Subject },
        },
        enrichedCredentials
      );
    }
  }

  res.sendStatus(200);
});
```

---

## Done When

- [ ] Postmark inbound webhook set up; MX record for mail.carinaai.uk documented
- [ ] `POSTMARK_INBOUND_WEBHOOK_TOKEN` env var added to .env.example
- [ ] Email adapter `verify()` checks x-postmark-inbound-token header
- [ ] Email adapter `parse()` strips quoted reply text; returns null for empty messages
- [ ] `In-Reply-To` header used for thread continuity
- [ ] `send()` sends reply via Resend with reply-to set to the Aiva's inbound address
- [ ] `PlainEmailTemplate` renders a simple readable reply (no marketing headers)
- [ ] "Reply disclaimer" line included in every reply
- [ ] Email channel router handler wires verify, parse, send correctly
- [ ] `generateEmailSlug()` creates a unique inbound address from worker name + ID
- [ ] Generated email address shown in portal Channels tab
- [ ] `infrastructure/CHANNEL-SETUP.md` has email setup section
- [ ] No em dashes in email body copy
