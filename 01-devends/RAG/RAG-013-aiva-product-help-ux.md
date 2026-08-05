# Aiva product help UX (workspace surfaces)

Updated: 2026-07-31.

Use this document when answering how-to and stuck-user questions about the live Aiva workspace UI.
Prefer this over older onboarding notes when they conflict.

## Product hosts

- `app.carinaai.uk` and `admin.hireaiva.co.uk` serve the Aiva workspace product.
- Ask Carina (bottom-right help widget) is product guidance only. Hired workers do operational work.

## Schedules vs Automations vs personal tasks

| Surface | Route / place | Purpose |
|---|---|---|
| Schedules | `/tasks` (also `/scheduled`) | Workspace housekeeping cron: Calendar sync, Memory tidy, Session tidy |
| Worker Automations | AI Workers → worker → Automations | That employee's digests and recurring routines |
| Personal reminders / task list | Calendar note reminders + Notes panel | Items saved from Telegram/Work chat with a stable UUID |

Never tell users that Schedules is their personal todo list.

## Reminders and Notes

- Timed reminders appear on Calendar as note reminders.
- Notes panel: Ctrl+Shift+N (pinned notes).
- After create, workers must return `Task ID` or `Reminder ID` (UUID) for follow-up.
- Session `todo` lists are temporary agent scratchpads, not the workspace task store.

## Channels

- Per-worker Channels tab: Telegram, email, WhatsApp, Slack, social for that employee.
- Workspace Channels / Tools: shared connectors (Gmail, Drive, Calendar, Trello) granted to workers.
- Telegram: BotFather token on Channels; group chats usually need @mention.
- If Telegram is quiet after reconnect, treat as platform/LLM issue and escalate.

## Training vs Knowledge vs Ask Carina

- Worker Training tab: that employee's FAQ/docs (`aiva_knowledge_base`).
- Workspace Knowledge (`/knowledge`): shared uploads (pack `user-resources`).
- Platform pack `carina-rag`: product self-knowledge for Carina/Aiva agent sessions.
- Ask Carina help KB: in-app product guidance for stuck users (not Training content).

## Approvals, Email, Calendar, Documents

- Approvals: human review before outbound email/social send.
- Email Handler connects Gmail/Microsoft/IMAP/forwarding; prefer OAuth.
- Calendar: Google sync + local/Aiva events + note reminders.
- Documents: workspace vault; do not rewrite Google Drive content without approval.

## Billing and Scout

- Billing UI: `/billing/aiva`.
- Current plan labels: Starter, Growth, Business (limits differ by seats/channels/tasks).
- Scout Govern: audit trail and kill switch on paid plans; separate product from the hired Aiva.

## Escalation

Escalate when billing disputes, account lockout, data loss, OAuth still broken after steps, or a worker stays silent after channel reconnect.

## Outreach Program (safe product guidance)

- Path: More → Outreach Program (`/aiva/outreach`).
- Includes leads, pipeline, reply review, Soft Wall sequences, bookings, reminders.
- YouTube Channel nested under Outreach → Channels → YouTube.
- Never guide users to mass-send without Approvals / Soft Wall.

## Ask Carina safety

Ask Carina answers product how-to only. Never store or answer with API keys, OAuth secrets, Stripe secrets, database URLs, server hosts, deploy details, or monorepo paths. Refuse and escalate rather than inventing infrastructure steps.
