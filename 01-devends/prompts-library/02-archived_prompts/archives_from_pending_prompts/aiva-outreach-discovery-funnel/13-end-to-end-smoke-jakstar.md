# 13: End-to-end smoke on Jakstar

**Status:** PENDING
**Priority:** P0
**Depends on:** 01-09, 11, 12
**Unlocks:** programme archive

## Goal

Prove the full funnel on the live Jakstar pilot (or a staging clone) with a disposable test lead, then record pass/fail for cutover.

## Why

Composition bugs only show up in the loop: sheet → send → reply → book → video → reminders → Kanban → Telegram.

## Smoke script (manual + scripted where possible)

Use a safe test address you control. Never blast real scraped leads during first smoke.

1. **Connect:** grants for Gmail, Calendar, Sheets, Trello; Telegram verified.
2. **Ingest:** add 3 test rows to sheet (`status=queued`).
3. **Send:** run cadence with `daily_cap=2`, approval on; approve and send 2; confirm `contacted`.
4. **Reply:** from test mailbox reply "interested, can we book a call?"; watcher marks `replied`, Telegram alert fires, Trello moves.
5. **Book:** accept an evening slot; Calendar event created; sheet `booked`; Trello Booked; owner alert.
6. **Video:** confirmation email contains YouTube prep URL (or owner-warned if unset).
7. **Reminders:** jobs listed for T-24h / T-30m (or dry-run with shortened timers in staging).
8. **Outcome:** after fake meeting time (or forced), owner prompt; log "Won"; sequences stop.
9. **Pause:** "pause outreach" prevents further cold sends.
10. **Negatives:** duplicate email ingest skipped; conflict slot rejected; unsubscribe never re-queued.

## Evidence to capture

- Message ids / timestamps (no secrets)
- Sheet screenshots or row dumps redacted
- Calendar event id
- Telegram alert screenshots
- Trello board column after each stage
- Vitest green for helpers

## Acceptance criteria

- [ ] Steps 1-9 pass on Jakstar or staging clone.
- [ ] Failures filed as follow-up prompts; P0 blockers fixed before calling funnel "live".
- [ ] Parent README progress ticked; archive path noted.

## Deploy

Whatever was built in 01-12 must be on Contabo before smoke. Prefer `CARINA_ALLOW_DIRTY_DEPLOY=1` only with explicit reason when necessary.
