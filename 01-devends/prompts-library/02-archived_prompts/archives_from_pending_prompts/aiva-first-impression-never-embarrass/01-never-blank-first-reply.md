# 01: Never blank first reply (kill embarrassing fallbacks)

**Status:** PENDING
**Priority:** P0
**Depends on:** 00
**Unlocks:** 02, 04, 06, 07, 09

## Goal

No Hire Aiva web or worker turn may surface:

- `I am unable to respond right now.`
- `What would you like me to help with?` as a substitute for a failed concrete ask

Blank model/tool outcomes must become an honest, actionable fallback.

## Why

Salim's first web message returned the unable-to-respond string because `processAivaMessage` returned `''` and `employee-comms.ts` substituted it. That is demo-ending UX.

## Files to change (expected)

- `carina/02-backends/core.carinaai.uk/src/aiva/employee-comms.ts`
- `carina/02-backends/core.carinaai.uk/src/workers/sanitize-aiva-reply.ts` (extend `aivaEmptyReplyFallback`)
- `carina/02-backends/core.carinaai.uk/src/workers/workspace-message-handler.ts`
- `carina/02-backends/core.carinaai.uk/src/gateway/router.ts`
- Tests colocated with those modules

Search for remaining hardcoded strings before shipping.

## Requirements

1. Remove or replace the `reply || 'I am unable to respond right now.'` pattern. Use `aivaEmptyReplyFallback(userMessage)` (or shared helper imported from sanitize module).
2. `aivaEmptyReplyFallback` must cover at least:
   - calendar / schedule / hospital / meeting intents → connect Google Calendar
   - email / gmail / inbox / retrospective mail → reconnect/connect Gmail
   - drive / files in Drive → reconnect/connect Drive
   - docs / vault / pitch pack → use workspace-document-list guidance
   - generic blank → "I hit a blank reply that turn; please try again" plus Tools hint, never a greeting
3. If raw reply had only tool-status chrome that sanitize stripped to empty, still use intent-aware fallback (do not greet).
4. Log (server-side, no secrets) when empty fallback fires: workspaceId, workerId, channel, intent bucket, raw length before sanitize.
5. Unit tests for Salim's exact ask: `check my calender for hospital meetings` must mention Calendar connect, not unable-to-respond.
6. Unit tests that the two banned strings never appear from the fallback helper.

## Acceptance criteria

- [ ] Grep Core source: banned strings absent from user-facing fallbacks (comments OK).
- [ ] Vitest covers calendar misspelling (`calender`) intent.
- [ ] Manual: new trial workspace sends Salim's first message → connect-calendar CTA, not blank apology.

## Deploy

Patch/deploy `carina-web` (Core). Cloud may be unchanged if only Core strings change.

## Notes

Partial `aivaEmptyReplyFallback` already exists for email/Drive. Extend it; do not invent a second helper.
