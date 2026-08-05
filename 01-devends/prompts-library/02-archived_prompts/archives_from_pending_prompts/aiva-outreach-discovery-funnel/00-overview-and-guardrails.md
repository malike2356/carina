# 00: Overview and guardrails (outreach discovery funnel)

**Status:** PENDING (reference; do not implement this file alone)
**Depends on:** none
**Unlocks:** 01-13

## Context for the agent

Hire Aiva must run a complete B2B email outreach funnel for agency / SEO leads, piloted on **Aiva Jakstar** for Jak Miah, then productised for any Hire Aiva workspace.

Canonical split (do not renegotiate):

- Carina = shared platform runtime (agent loop, tools, memory, billing plumbing, deploy).
- Aiva = product surface (Hire Aiva branding, workers UI, pricing, onboarding).
- Reference: `shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md`
- Source boundary: only `carina/02-backends/`, `carina/03-frontends/`, `carina/scripts/`

Discovery conversation outcomes (2026-08-04 Laud + Jak):

```
Instruct (Mon target, Sunday reach goal)
  -> Scrape / ingest leads (Sheets master list)
  -> Cold email (Gmail business mailbox; start ~10/day; warm domain)
  -> Reply interested?
       yes -> Offer discovery Zoom booking (conflict-free Calendar)
            -> Confirm + YouTube prep video email
            -> Reminders (1 day / ~50-30 min) + reschedule
            -> Call happens -> owner fulfills offline
            -> Aiva asks meeting outcome -> update Kanban
       no / soft -> Follow-up sequence / nurture list
  -> Always update Kanban stage + alert owner (Telegram preferred)
```

## Existing Aiva surfaces to reuse (do not reinvent)

| Funnel need | Existing surface (start here) |
|---|---|
| Cold / transactional email | `gmail-list`, `gmail-get`, `gmail-send`; drafts via `workspace-email-draft-for-approval` |
| Lead store | `google-sheets-list`, `google-sheets-append`; Contacts (`contacts`); Documents vault |
| Scrape / research | `web-search`, browser toolset under policy; UK ltd/llp: Companies House tools (`aiva-companies-house-api/`, funnel prompt 14) |
| Calendar booking | `google-calendar-list`, `google-calendar-create`, `google-calendar-update` |
| Local reminders | `notes-manage` reminders + Calendar local-only |
| Recurring jobs | `worker-automation` (not host `cronjob`) |
| Kanban board | Trello tools (`trello-list-*`, `trello-create-card`); native `kanban-*` for in-product later |
| Notion (optional) | `configure` `integration:notion` (key test exists; product CRUD thinner than Trello) |
| Owner chat | Web employee chat + Telegram worker channel |
| Docs / pitch | `workspace-document-list` / `workspace-document-get` / create |
| YouTube outreach content | Property Channel / YouTube connector paths under `src/workflows/templates/property-channel/` and content media pipeline |
| Approvals | Existing email draft approval flow before bulk send |

## Failure modes this programme must close

1. Outreach sends from wrong mailbox or with no approval gate.
2. Double-booking or ignoring evening / blocked slots.
3. Reply arrives and dies in inbox with no stage move.
4. Booked call with no prep video and no reminders (ghost risk).
5. No Kanban visibility once volume exceeds memory.
6. Owner never alerted on book / no-show / hot reply.
7. Embarrassing blank Aiva replies mid-funnel (depends on never-embarrass programme).
8. Google OAuth Testing blocking `admin@salesgridai.com` send-from (founder Console action; document only).

## Technical guardrails

1. Never create `carina/verlox/` nests. Run `bash /opt/lampp/htdocs/verlox/scripts/guard-forbidden-carina-nests.sh` if unsure.
2. Writing style: no em dashes (U+2014), no en dashes (U+2013), no emojis in first-party copy.
3. Prefer Core + cloud product paths Aiva already uses; avoid a parallel agent OS.
4. Do not grant Aiva workers `shell-exec`.
5. Secrets stay in `/opt/lampp/htdocs/verlox/.access/` and VPS env. Never paste secrets into prompts, commits, or chat.
6. Stripe: never create new prices unless owner explicitly asks.
7. Tests: Vitest for Core; documented manual smoke in prompt 13 on Jakstar.
8. Deploy: surgical `carina-web` / compose as needed; keep `public_website` deploy hygiene.
9. Compliance: every cold send path must honour unsubscribe / stop language and daily caps; never spam.

## Architecture target

```
Owner instruction (Telegram / web)
  -> Outreach playbook persona + workflow state (workspace config / Documents)
  -> Lead ingest (browser/web-search OR manual sheet) -> Google Sheet + Contacts tags
  -> Cadence job (worker-automation): pick N unsent rows -> draft/approve/send via Gmail
  -> Reply watcher job: gmail-list query -> classify -> Kanban move + owner alert
  -> Booking: public or chat booking against Calendar free/busy + Zooms
  -> On book: gmail-send prep video; schedule reminder automations; Kanban "Booked"
  -> Reminder / no-show / follow-up jobs update Kanban + ping owner
  -> Outcome capture: owner reply in Telegram updates stage Won / Dead / Follow-up
```

## Out of scope

- Full accounting / invoicing rebuild (Jak keeps existing docs; may attach later).
- WhatsApp cold blast as primary (email first; WhatsApp only if Contacts + channel already healthy).
- Migrating Aiva to Keprix/Hermes.
- Publishing Google OAuth app (founder Console); only document unblock steps.

## When finished with any later prompt

1. Run relevant Vitest.
2. Fix writing style on touched copy.
3. Deploy required services.
4. Tick parent README checkboxes.
5. Archive this folder under `02-archived_prompts/archives_from_pending_prompts/` when the whole set ships.
