# Aiva outreach discovery funnel (hands-free sales pipeline)

**Prompt set:** 15 prompt files (00-14) plus this README  
**Status:** PENDING  
**Created:** 2026-08-04  
**Owner surface:** Hire Aiva / Carina (shared runtime; Aiva product paths)  
**Pilot customer:** Jak Miah / Aiva Jakstar (`jmiah2012@gmail.com`, send-from target `admin@salesgridai.com`)

## Problem statement

Jak needs hands-free SEO / agency outreach:

1. Instruct Aiva (Mon) to find or ingest leads.
2. Cold email from his business mailbox at a controlled cadence (start ~10/day, weekly Sunday reach target).
3. On reply: move to book a **discovery Zoom** (high ticket £3k-£6k; do not close fulfillment in email).
4. Booking lands on his **existing Google Calendar** with no double-book, evening/strict slots, and owner alert.
5. Instant post-book email with a **prep video** (YouTube link preferred for mobile).
6. Reminders (1 day / ~50-30 min) with reschedule path so prospects do not ghost.
7. After the call: human fulfillment (invoices/docs Jak already has). Aiva prompts "how did that meeting go?" and updates the funnel.
8. **Kanban** visibility across contacted → booked → showed → won/dead, plus follow-ups for no-show / "get back in N days" / ghost.
9. Growing outreach list + YouTube outreach content over time; co-marketing ready.

Third-party GoHighLevel is expendable; wire Gmail, Calendar, Sheets, Trello/Notion, Telegram, Contacts, Documents, worker-automation, and (later) in-product kanban rather than inventing a second CRM OS.

## Design principle

Prefer **compose existing Aiva tool surfaces** into one funnel workflow. Build new product code only where composition cannot meet acceptance (public booking page, reply watcher, conflict-free slots, reminder jobs).

**Booking engine:** adopt Propreneur **viCal** on Carina/Aiva via sibling set `../aiva-vical-booking/` (prompts 05 and 07 should consume that engine after cutover 08; do not keep a permanent second booking SoT in outreach JSON).

## Build order (strict)

| ID | Prompt | Priority | Depends on |
|---|---|---|---|
| 00 | Overview and guardrails | ref | none |
| 01 | Pilot workspace tool grants and channels | P0 | 00 |
| 02 | Lead scrape + sheet ingest | P0 | 01 |
| 03 | Cold email send cadence and warm-up | P0 | 01, 02 |
| 04 | Reply detection and qualification | P0 | 03 |
| 05 | Discovery booking (Calendar + Zoom) | P0 | 01, 04 |
| 06 | Post-book prep video email | P0 | 05 |
| 07 | Appointment reminders and reschedule | P0 | 05, 06 |
| 08 | Kanban funnel (Trello first, native later) | P0 | 04, 05 |
| 09 | Follow-up sequences and owner prompts | P0 | 07, 08 |
| 10 | List nurture + YouTube outreach pipeline | P1 | 02, 03 |
| 11 | Telegram ops channel and alerts | P0 | 01 |
| 12 | Persona playbook and Jakstar instructions | P0 | 01-09 |
| 13 | End-to-end smoke on Jakstar | P0 | 01-09, 11, 12 |
| 14 | Companies House lead source (wire-in) | P0 | 02; `aiva-companies-house-api/` |

## Prompt files

- `00-overview-and-guardrails.md`
- `01-pilot-workspace-tool-grants-and-channels.md`
- `02-lead-scrape-and-sheet-ingest.md`
- `03-cold-email-send-cadence-and-warmup.md`
- `04-reply-detection-and-qualification.md`
- `05-discovery-booking-calendar-and-zoom.md`
- `06-post-book-prep-video-email.md`
- `07-appointment-reminders-and-reschedule.md`
- `08-kanban-funnel-trello-and-native.md`
- `09-follow-up-sequences-and-owner-prompts.md`
- `10-list-nurture-and-youtube-outreach-pipeline.md`
- `11-telegram-ops-channel-and-alerts.md`
- `12-persona-playbook-and-jakstar-instructions.md`
- `13-end-to-end-smoke-jakstar.md`
- `14-companies-house-lead-source.md`

## Definition of done (whole programme)

From Telegram or web, Jak can say roughly:

> This week find 50 UK SEO leads, add them to my sheet, send up to 10 cold emails a day from salesgrid, stop by Sunday when we hit X. When someone replies interested, offer my evening discovery slots. When they book, send the prep YouTube link, remind them, put them on the Kanban, and ping me.

…and Aiva executes that loop without silent failures, without double-booked calendar slots, and with every stage visible on Trello (or native kanban).

## Non-goals

- Do not rebuild GoHighLevel inside Carina in week one.
- Do not enable `shell-exec` for Aiva workers.
- Do not invent Stripe prices.
- Do not nest `carina/verlox/`.
- Do not paste secrets from `.access/` into prompts, commits, or chat.
- Do not replace Property Channel Phase B/C work; reuse YouTube connectors where useful for outreach content only.

## Progress

- [ ] 00 overview
- [ ] 01 pilot grants and channels
- [ ] 02 lead scrape + sheet
- [ ] 03 cold email cadence
- [ ] 04 reply detection
- [ ] 05 discovery booking
- [ ] 06 prep video email
- [ ] 07 reminders / reschedule
- [ ] 08 kanban
- [ ] 09 follow-ups
- [ ] 10 list nurture + YouTube
- [ ] 11 Telegram alerts
- [ ] 12 persona playbook
- [ ] 13 E2E smoke
- [ ] 14 Companies House lead source wire-in

## Related programmes

- `aiva-first-impression-never-embarrass/` (blank replies, connect CTAs, Google Sign-In testers) must stay green; outreach depends on honest Gmail/Calendar connect.
- `property-channel-media-pipeline/` for YouTube publish mechanics when outreach content ships as videos.
- `aiva-companies-house-api/` for official UK register search/enrich (required before prompt 14 can go live).

## When a prompt ships

1. Vitest for Core paths touched.
2. `python3 /opt/lampp/htdocs/verlox/scripts/fix-writing-style.py` on touched first-party copy.
3. Deploy Core (`carina-web`) and cloud UI if booking/kanban surfaces change.
4. Tick this README.
5. Archive whole folder under `02-archived_prompts/archives_from_pending_prompts/` when the set ships.
