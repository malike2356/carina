# 11: Telegram ops channel and alerts

**Status:** PENDING
**Priority:** P0
**Depends on:** 01
**Unlocks:** 12, 13

## Goal

Jak runs outreach by talking to Jakstar on Telegram and receives real-time alerts for bookings, hot replies, no-shows, and daily/weekly digests.

## Why

Tonight’s ask on the discovery call: connect IVA to Telegram. Web works; Telegram is the daily driver.

## Reuse first

- Worker Telegram channel (BotFather token paste)
- `employee-comms` / workspace message handler parity with web
- Never-embarrass empty-reply parity (prompt set sibling)
- Alert helpers that send to the worker’s bound Telegram chat

## Requirements

1. Document BotFather steps for Jak (Start → token → paste Channels → Telegram). Keep short; no emoji.
2. Alert events (minimum):
   - Hot reply (`interested`)
   - New booking (time + Meet/Zoom)
   - Reminder sent (optional quiet)
   - No-show detected
   - Daily send summary
   - Cadence blocked (cap hit, auth fail, missing grant)
3. Alerts must work even when owner is not mid-chat (outbound channel message).
4. Commands Jak can type:
   - "pause outreach"
   - "resume outreach"
   - "how many sent this week"
   - "show booked"
5. Shared Hire Aiva Telegram deep-link (P1 product): reduce BotFather friction for future trials; not required to finish Jak pilot if token path works.
6. Parity: blank reply bans from never-embarrass still apply on Telegram.

## Acceptance criteria

- [ ] Jakstar Telegram channel verified.
- [ ] Simulated booking fires a Telegram alert to Jak’s chat.
- [ ] "pause outreach" stops daily_cap sends until resume.
- [ ] Auth failure on Gmail alert includes Tools reconnect URL.

## Deploy

Mostly config + alert plumbing in Core; cloud UI only if Channels UX changes.
