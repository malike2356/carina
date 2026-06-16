# Prompt 03 - Email Workspace + Auto-Reply Review

## Objective

Bring Odysseus-style email assistant to `app.carinaai.uk`: triage inbox, AI draft replies, human review before send. PewDiePie pitch: "AI already did the search and wrote the reply; I click review and send."

---

## Context

**Working directories:** `app.carinaai.uk`, `core.carinaai.uk`

**Core today:** `/email` triage on `inbound_emails` webhook table. Not a full IMAP client.

**Strategy:** Phase 1 = triage + draft review (matches Odysseus auto-reply flow). Phase 2 = IMAP integration (out of scope unless env configured).

**Files to inspect first:**
- `core.carinaai.uk/src/gateway/email-api.ts`
- `core.carinaai.uk/packages/web/src/workspace-chrome.ts` (email nav)
- `app.carinaai.uk/src/db/schema.ts`

---

## Step 1 - Schema extensions (cloud)

Add to `schema.ts`:

```ts
export const emailMessages = pgTable('email_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  externalId: text('external_id'),
  fromAddress: text('from_address').notNull(),
  subject: text('subject').notNull(),
  bodyPreview: text('body_preview'),
  bodyFull: text('body_full'),
  urgency: text('urgency').notNull().default('normal'), // low | normal | high | spam
  status: text('status').notNull().default('inbox'), // inbox | archived | draft_reply | sent
  aiDraftReply: text('ai_draft_reply'),
  aiDraftGeneratedAt: timestamp('ai_draft_generated_at'),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

Migration + drizzle generate.

---

## Step 2 - API routes

```
GET    /api/email              - list inbox (filter: status, urgency)
GET    /api/email/[id]         - detail + draft
PATCH  /api/email/[id]         - archive, mark spam, edit draft
POST   /api/email/[id]/draft   - trigger AI draft generation (calls core)
POST   /api/email/[id]/send    - send approved draft (requires explicit confirm body)
```

Draft generation:
- Call core `POST /api/internal/email/draft` with message id, workspace id, internal key.
- Core uses agent with web-search + read tools; returns draft text only (no auto-send).

Send:
- If `EMAIL_SEND_ENABLED !== 'true'` in env, return 501 with message "Outbound email not configured".
- When enabled, delegate to core SMTP or provider integration.

---

## Step 3 - `/email` page

Create `src/app/(workspace)/email/page.tsx`:

Layout:
- Left: filter tabs (Inbox, High urgency, Archived, Spam)
- Center: message list (from, subject, preview, urgency badge)
- Right: reading pane + draft editor

**Auto-reply review flow (Odysseus parity):**
1. User selects message.
2. Click "Generate draft" if no draft; shows spinner.
3. Draft appears in editable textarea (user can fix tone).
4. Buttons: **Send**, **Save draft**, **Discard**, **Archive**.
5. Send requires confirmation dialog: "Send this reply to {from}?"

Add sidebar link in `AppSidebar.tsx` under Tools: Email (envelope icon).

---

## Step 4 - Built-in scheduled task seed

In tasks system (existing `scheduled_tasks`), seed optional built-in row per workspace (paused by default):

- Name: Email AI Draft (every 2 hours)
- Task type: action
- Cron: `0 */2 * * *`
- Action: `email_draft_high_urgency` (process inbox items with urgency=high and no draft)

Document in tasks page as "Built-in Odysseus-style email assist".

---

## Step 5 - Webhook ingest (cloud)

`POST /api/webhooks/email/inbound` (HMAC verified):

- Parse inbound payload (match core webhook shape).
- Insert `email_messages` row for workspace resolved from routing key.

Per-tenant routing: use `workspace_settings.inbound_email_token` (add column if missing).

---

## Acceptance criteria

- [ ] `/email` lists messages; archive and spam work.
- [ ] Generate draft returns editable text; send requires confirm.
- [ ] No email sends without user clicking Send.
- [ ] Sidebar shows Email link.
- [ ] Tests for API auth and draft flow (mock core).

## Out of scope

- Full IMAP sync UI (defer to CalDAV/email integration prompt later).
- Reading user's Gmail without OAuth setup docs.
