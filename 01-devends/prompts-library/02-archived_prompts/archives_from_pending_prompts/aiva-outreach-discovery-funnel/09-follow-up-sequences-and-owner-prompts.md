# 09: Follow-up sequences and owner prompts

**Status:** PENDING
**Priority:** P0
**Depends on:** 07, 08
**Unlocks:** 12, 13

## Goal

Aiva runs follow-ups for soft interest, no-shows, and "get back to you in a few days", and prompts Jak after calls so the Kanban stays truthful.

## Why

Jak called out ghosting and post-meeting silence. Follow-up is as valuable as first send. Aiva should ask: "What happened with that meeting?" then update Miss Hen / Kanban / sheet.

## Reuse first

- `worker-automation` delayed jobs
- `gmail-send` / draft-for-approval
- Trello comments + list moves
- Telegram owner prompts
- Notes tasks if useful

## Requirements

1. Sequence packs (Documents or config):
   - No reply after cold send: day 3, day 7 (max 2 follow-ups unless owner extends)
   - Interested but not booked: day 1, day 3 booking nudge
   - No-show: day 0 evening + day 2
   - Post-call "we'll get back to you": prompt owner at day 2 if no outcome logged
2. Owner prompt template after event end:
   - Ask outcome: Won / Proposal sent / Follow-up date / Dead / No-show
   - Apply answer to sheet + Kanban
3. Never follow up `dead` or unsubscribed.
4. Every follow-up updates `last_touch_at` and leaves a Trello comment.
5. Weekly owner digest: counts by stage + stale cards (>N days no touch).
6. Tests for sequence skip rules.

## Acceptance criteria

- [ ] No-show automatically schedules at least one follow-up and alerts Jak.
- [ ] After a booked event time passes, Jak gets a Telegram/web prompt to log outcome.
- [ ] Logging "Dead" stops further sequences for that lead.

## Deploy

Core sequences + automation templates; persona text in 12.
