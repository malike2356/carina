# 04: Reply detection and qualification

**Status:** PENDING
**Priority:** P0
**Depends on:** 03
**Unlocks:** 05, 08, 09

## Goal

When a prospect replies to cold outreach, Aiva detects the reply, classifies intent, updates the funnel, alerts Jak, and starts booking when intent is positive.

## Why

Outreach without reply handling is a leaked pipeline. Discovery call is the next stage for big-ticket SEO work.

## Reuse first

- `gmail-list` / `gmail-get` with query operators (from:, newer_than:, subject threads)
- `worker-automation` poll (e.g. every 15-30 min during working hours)
- Trello / kanban move (prompt 08)
- Telegram / web alert (prompt 11)

## Requirements

1. Watcher matches replies to threads Aiva sent (Message-ID / In-Reply-To when available; fallback email+subject window).
2. Classification buckets (LLM or rules + LLM):
   - `interested` → offer booking
   - `question` → draft helpful reply (approval) + stay `replied`
   - `not_now` → `nurture` + schedule follow-up
   - `unsubscribe` / hostile → `dead` + suppress future sends
   - `ooo` → snooze follow-up
3. On `interested`: set sheet `status=replied`, create/move Kanban card, alert owner with snippet + one-tap "offer booking" instruction.
4. Do not auto-send sales pricing close on first reply for high-ticket; bias to discovery booking CTA.
5. Idempotent: same reply processed once.
6. Log classification for smoke tests (no full body secrets in logs).
7. Unit tests for classifier fixtures (short sample emails).

## Acceptance criteria

- [ ] Simulated inbound reply to a contacted lead marks sheet `replied` and fires owner alert.
- [ ] Unsubscribe classification never re-queues cold mail.
- [ ] Interested path proposes discovery booking next (prompt 05).

## Deploy

Core watcher + automation; optional cloud "Replies" inbox later (P2).
