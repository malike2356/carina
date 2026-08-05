# 06: Telegram + web empty-reply parity

**Status:** PENDING
**Priority:** P0
**Depends on:** 01, 03
**Unlocks:** 07, 09

## Goal

Web chat and Telegram must share the same empty-reply and reconnect behaviour. Founders demo on either channel without different failure modes.

## Why

Selorm Telegram showed greeting fallbacks; Salim web showed unable-to-respond. Different strings, same class of bug. Users do not care which code path fired.

## Files to change (expected)

- Shared helper already intended: `sanitize-aiva-reply.ts` (`aivaEmptyReplyFallback`)
- Ensure all entry points use it:
  - `employee-comms.ts` (web)
  - `workspace-message-handler.ts` / `router.ts` (Telegram and worker channels)
  - Any other `reply || '...'` patterns for Aiva
- Tests that web and Telegram helpers resolve identically for the same userMessage

## Requirements

1. Single source of truth for empty fallback copy.
2. Telegram must not show banned greeting for concrete asks.
3. Web must not show banned unable-to-respond string.
4. If `processAivaMessageStream` yields `limit` events, show the limit reason (already structured); do not replace with empty fallback that hides quota truth.
5. Preserve sanitize rules that strip tool-status chrome; fallback only when final prose is empty.

## Acceptance criteria

- [ ] Grep banned strings: only allowed in tests asserting absence, or archive notes.
- [ ] Same input message produces same fallback class on web and Telegram.
- [ ] Manual: Selorm Telegram email ask with needs_reauth → reconnect copy.

## Deploy

`carina-web`.
