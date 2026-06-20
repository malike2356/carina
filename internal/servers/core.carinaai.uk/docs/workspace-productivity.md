# Workspace productivity: email, notes, calendar, scheduled work

Daily productivity surfaces in Carina reuse existing stores (notes SQLite, email inbound table, cron scheduler, TaskFlow engine). No duplicate notes or task system is added.

## Email triage

**Web:** `/email` (private instance workspace)

- Filter inbox, archive, spam, or **Unread**
- Search subject and sender
- **Sync IMAP** to pull mail (`IMAP_HOST`, credentials in `.env`)
- Triage actions: mark read/unread, urgency tags, archive, spam
- **Reply** and **AI draft reply** with compose modal
- **Ask agent about this** sends triage context to chat

Inbound webhooks: `POST /webhooks/email/inbound` (Resend). See [Email tools](./tools/email.md).

## Notes, tasks, and reminders

**Web:** `/notes`

Formats: `note`, `task`, `reminder`. Tasks support done checkbox; reminders support `remindAt` with web toast delivery when `CARINA_REMINDER_DELIVERY` is enabled.

- Deep link: `/notes?open=<note-id>`
- New reminder shortcut: `/notes?new=reminder` (also from Calendar **New reminder**)
- Sorted by most recently updated
- AI assist for selection or full body (same pattern as Documents)

Reminders appear on **Calendar** automatically.

## Calendar

**Web:** `/calendar`

Aggregates:

- **Notes reminders** (always available)
- **CalDAV** events when configured (`CALDAV_URL`, `CALDAV_USERNAME`, `CALDAV_PASSWORD`)

Sync status panel shows whether CalDAV is configured and last sync time. Click a note reminder to open it in Notes.

CalDAV is optional; notes-only calendar works without external sync.

## Scheduled work (cron and TaskFlows)

**Web:** `/scheduled`

Surfaces automation that previously lived only in CLI:

| Source | CLI | Web actions |
|---|---|---|
| Cron jobs | `carina cron list` | Pause / resume |
| TaskFlows | `carina taskflows list` | Run now, pause, resume |
| Runs | `carina taskflows runs` | Cancel queued/running |

**API:** `GET /api/scheduled/status`, `/cron`, `/flows`, `/runs`; `POST` trigger, pause, resume, cancel.

TaskFlows are enabled by default (`CARINA_TASKFLOWS_ENABLED=false` to disable). Worker pool: `CARINA_TASKFLOWS_WORKER_POOL`.

Cron jobs link to TaskFlows via `carina taskflows create <name> --cron <job-id>`.

## Workspace navigation

All surfaces appear in `/workspace` and the sidebar: Notes, Calendar, Scheduled, Email (private), plus Research, Compare, Documents from prompt 07.

## Related

- [Getting started](./getting-started.md)
- [Workspace research and compare](./workspace-research-compare.md)
- [Workspace personalization](./workspace-personalization.md)
- [Email tools](./tools/email.md)
- [Configuration](./configuration.md)
