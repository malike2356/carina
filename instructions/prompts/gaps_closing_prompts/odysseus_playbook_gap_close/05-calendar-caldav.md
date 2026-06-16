# Prompt 05 - Calendar + CalDAV Sync

## Objective

Close the last named Odysseus workspace gap: real calendar with CalDAV sync, month/week/agenda views, and natural-language quick add ("call Telemachus tomorrow morning").

---

## Context

**Working directories:** `core.carinaai.uk` (CalDAV client exists), `app.carinaai.uk`

**Core today:** `src/integrations/caldav-client.ts`, `/api/calendar`, notes-based reminders.

**Files to inspect first:**
- `core.carinaai.uk/src/integrations/caldav-client.ts`
- `core.carinaai.uk/src/api/calendar-api.ts`
- `app.carinaai.uk/src/db/schema.ts`

---

## Step 1 - Cloud calendar cache schema

```ts
export const calendarEvents = pgTable('calendar_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  externalUid: text('external_uid'), // CalDAV UID when synced
  title: text('title').notNull(),
  description: text('description'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at'),
  allDay: boolean('all_day').notNull().default(false),
  source: text('source').notNull().default('local'), // local | caldav | note_reminder
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const calendarConnections = pgTable('calendar_connections', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull(),
  provider: text('provider').notNull(), // caldav | google (future)
  url: text('url'),
  username: text('username'),
  encryptedPassword: text('encrypted_password'), // use vault encryption like BYOK
  lastSyncAt: timestamp('last_sync_at'),
  lastSyncError: text('last_sync_error'),
  enabled: boolean('enabled').notNull().default(true),
});
```

---

## Step 2 - Sync service

`src/lib/calendar-sync.ts`:

1. Read workspace CalDAV connection from DB (or workspace env fallback for self-hosted bridge).
2. Call core internal endpoint `POST /api/internal/calendar/sync` with credentials reference id (never send raw password in logs).
3. Upsert events into `calendar_events` by `externalUid`.
4. Expose `POST /api/calendar/sync` for manual sync button.

Scheduled: workspace task "Calendar sync" every 30 min (paused by default).

---

## Step 3 - `/calendar` page

Views: Month (default), Week, Agenda list.

Features:
- Click day to quick-add event modal.
- NL quick add input at top: "Meeting with vendor Friday 2pm" calls `POST /api/calendar/parse` (small LLM or chrono-node parser); shows preview before save.
- Event detail drawer: edit, delete, open linked note.
- Settings gear links to `/settings/calendar` for CalDAV URL, username, password, Test connection.

Sidebar link: Calendar.

---

## Step 4 - Agent tools

Ensure chat agent can call calendar read/write when session is agent mode (skills already list calendar_read/write; wire to new API).

---

## Step 5 - Notes reminders merge

Existing note reminders with `reminderAt` appear as `source: note_reminder` events on calendar (read from `user_notes` table).

---

## Acceptance criteria

- [ ] Local events CRUD works without CalDAV.
- [ ] CalDAV test connection succeeds against Radicale/Nextcloud test instance.
- [ ] Sync imports events with stable UIDs.
- [ ] NL quick add creates event with reasonable start time (test with 5 phrases).
- [ ] Odysseus gap doc updated: CalDAV marked done for cloud.

## Env vars (document in settings UI)

```
CALDAV_URL=
CALDAV_USERNAME=
CALDAV_PASSWORD=
```

Per-workspace overrides stored encrypted in `calendar_connections`.
