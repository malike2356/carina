# Sprint 4 - Prompt d/01: VA Response Interface

**Sprint:** 4 - Foundation
**Prompt number:** d/01
**Name:** Human VA reply capability from admin queue, channel delivery, hand-back to Aiva
**Primary agent:** Cursor (UI) + Claude Code (backend send route)
**Estimated hours:** 4-5 h
**Depends on:** sprint-6/aiva-admin/03-va-queue-and-revenue.md (VA queue must exist); b/01-b/05 channel adapters (delivery depends on them)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-4/d/`.

---

## Read First

1. `frontends/client-apps/admin.carinaai.uk/src/app/(admin)/va-queue/page.tsx` - the VA queue page with the escalation detail panel; the reply interface goes into the bottom of that panel
2. `backends/servers/core.carinaai.uk/src/channels/channel-router.ts` - the send path; VA reply calls the same `adapter.send()` function
3. `backends/servers/core.carinaai.uk/src/channels/worker-registry.ts` - to look up channel credentials for the Aiva

---

## Context

The VA queue (sprint-6 prompt 03) shows escalations. A VA team member can assign and mark
resolved. But they cannot yet send a reply to the end client through the original channel.
Without this, the VA must contact the client via a separate tool (WhatsApp on their phone,
their own email, etc.) - breaking the audit trail and bypassing the Aiva system entirely.

This prompt adds a "Reply" input to the escalation detail panel and a backend route that
sends the VA's message via the same channel the client originally used.

---

## Step 1: Backend reply route

Add to `admin-router.ts`:

```
POST /api/admin/va/queue/:id/reply
```

```typescript
// Body: {
//   message: string;         (required, min 1 char)
//   handBackToAiva: boolean; (default false)
// }
// 1. Fetch the escalation by id: get worker_id, workspace_id, channel (from ai_worker_channels via activity)
// 2. Fetch the channel for this Aiva:
//    SELECT channel, identifier, credentials
//    FROM ai_worker_channels
//    WHERE worker_id = $workerId AND enabled = true
//    ORDER BY created_at ASC LIMIT 1
//    (use the primary/first channel if multiple)
// 3. Decrypt credentials
// 4. Call the correct adapter's send() method based on channel type
// 5. Log to ai_worker_activity:
//    action_type='va_reply', worker_id, workspace_id,
//    summary=`VA replied on ${channel}: ${message.slice(0, 100)}`
// 6. UPDATE aiva_escalations SET:
//    first_response_at = COALESCE(first_response_at, NOW()),
//    status = 'in_progress'
//    WHERE id = $escalationId
// 7. If handBackToAiva:
//    UPDATE aiva_escalations SET status='resolved', resolved_at=NOW(),
//           resolution_note='VA replied and handed back to Aiva'
//    WHERE id = $escalationId
//    Also set a flag in the worker/thread state so the next message from the client
//    routes back to the Aiva brain instead of staying in the VA queue.
//    Simplest: update channel_threads.va_override = false WHERE worker_id AND contact_id
// 8. Return: { sent: true, channel, handedBack: boolean }

// Auth: admin middleware (same as all admin routes)
// Audit log: action='va_reply', target_type='escalation', target_id=escalationId,
//            metadata: { channel, messagePreview: message.slice(0,100), handBackToAiva }
```

Add `va_override BOOLEAN DEFAULT false` to `channel_threads` table in migration:
```sql
ALTER TABLE channel_threads ADD COLUMN IF NOT EXISTS va_override BOOLEAN NOT NULL DEFAULT false;
```

When an escalation is created, set `va_override = true` for the thread so subsequent client
messages are NOT auto-routed to the Aiva (they stay in the VA queue).
When VA hands back, set `va_override = false`.

In `channel-router.ts`, check `va_override` before calling `processAivaMessage`:
```typescript
const thread = await db.query(
  'SELECT va_override FROM channel_threads WHERE channel = $1 AND worker_id = $2 AND contact_id = $3',
  [channel, workerId, contactId]
);
if (thread.rows[0]?.va_override) {
  // Route to VA queue instead of Aiva brain
  await createOrUpdateEscalation({ workerId, workspaceId, channel, contactId, newMessage: content });
  return { handled: true, response: undefined };
}
```

---

## Step 2: Next.js proxy route

Add to `frontends/client-apps/admin.carinaai.uk/src/app/api/admin/va/queue/[id]/reply/route.ts`:

```typescript
// POST - proxy to core /api/admin/va/queue/:id/reply
// Requires admin session; attaches X-Admin-Token
```

---

## Step 3: Reply UI in the escalation detail panel

In the escalation detail panel (`va-queue/page.tsx`), below the conversation context section:

```
[section heading] Reply as VA

[Channel context line]
  "Replying via [channel icon] [channel name] to [contactId or contactName]"
  E.g.: "Replying via WhatsApp to +44 7911 123456"

[Textarea]
  Placeholder: "Type your reply..."
  Min-height: 80px, max-height: 160px (auto-resize)

[Checkbox row]
  [ ] Hand back to Aiva after sending
  Small help text: "Your Aiva will handle subsequent messages from this client."

[Button row]
  [Send reply] button (disabled while sending, shows spinner)
  Keyboard shortcut hint: Ctrl+Enter to send

[Error message area]
  Shows inline if send fails; does not dismiss the panel
```

On send:
1. POST `/api/admin/va/queue/[id]/reply` with `{ message, handBackToAiva }`
2. On success:
   - Show a green flash in the panel: "Reply sent via [channel]."
   - Clear the textarea
   - If `handBackToAiva` was checked: show "Escalation closed. Aiva will handle future messages."
     and change the escalation status badge to "Resolved"
   - If not handed back: status stays "In progress"
3. On error: show the error message inline

---

## Step 4: Channel context lookup

The reply UI needs to know which channel to display. This comes from the escalation detail
response (added in sprint-6 prompt 03). Add to `GET /api/admin/va/queue/:id` response:

```typescript
// Add to the existing response:
channel: {
  type: 'whatsapp' | 'email' | 'slack' | 'telegram' | 'web' | null,
  identifier: string | null,  // masked: +44 7911 1**456 for phone, a****@domain for email
  displayLabel: string,       // "WhatsApp: +44 7911 1**456" or "Email" or "Web chat"
}
```

Masking: show partial identifier to avoid displaying full personal details in the admin UI.
- Phone: show first 5 and last 3 digits, mask middle: `+44 791** **456`
- Email: show first 2 chars and domain: `jo***@example.com`
- Slack: show team name if available
- Telegram: show first name from contactName
- Web: "Web chat visitor"

---

## Done When

- [ ] `POST /api/admin/va/queue/:id/reply` sends message via the correct channel adapter
- [ ] Reply is logged to `ai_worker_activity` with `action_type='va_reply'`
- [ ] `first_response_at` set on first VA reply
- [ ] `handBackToAiva=true` sets `va_override=false` and resolves the escalation
- [ ] `channel_threads.va_override` column exists; set to true on escalation, false on hand-back
- [ ] Inbound message router skips Aiva brain for threads with `va_override=true`
- [ ] Reply UI renders in the escalation detail panel below conversation context
- [ ] Channel context line shows masked identifier and channel type
- [ ] Textarea clears after successful send
- [ ] Spinner shown while send is in progress
- [ ] Error shown inline on failure
- [ ] "Hand back to Aiva" checkbox works; escalation closes on check
- [ ] Admin audit log entry created for every VA reply
- [ ] No em dashes in UI copy
