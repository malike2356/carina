# 02: Conversational connect for Calendar / Gmail / Drive

**Status:** PENDING
**Priority:** P0
**Depends on:** 01
**Unlocks:** 03, 04, 07, 09

## Goal

When a user asks to check calendar, search email, or pull Drive files before those tools are connected (or while `needs_reauth`), Aiva answers immediately with a secure connect/reconnect walkthrough. Do not wait for a blank tool loop.

## Why

Today `buildConversationalIntegrationSetupReply` only handles Trello. Salim asked for calendar with zero grants and got emptiness. Trello should not be the only guided tool.

## Files to change (expected)

- `carina/02-backends/core.carinaai.uk/src/workers/conversational-integration-setup.ts` (expand or split into multi-tool module)
- Call site already in `aiva-process-message.ts` before the heavy agent turn
- Optionally mirror copy links used in UI: `https://admin.hireaiva.co.uk/aiva/tools` and `https://app.carinaai.uk/aiva/tools`
- Vitest for intent detection

## Requirements

1. Detect intents (tolerate typos like `calender`):
   - Calendar: calendar, schedule, meeting, hospital appointment, free/busy
   - Gmail: email, gmail, inbox, retrospectively search mail
   - Drive: google drive, file in drive, from drive
   - Keep existing Trello setup path
2. Before agent turn, if intent matched AND worker grant missing or `needs_reauth` for that slug, return conversational setup reply and stop the turn.
3. Setup reply must:
   - Confirm the ask is understood
   - Forbid pasting OAuth secrets into chat
   - Point to Tools page
   - Say Grant to this Aiva after connect/probe
   - Invite them to re-ask the same question after grant
4. If grant is connected and probe-ok, do not intercept; let tools run.
5. If grant exists as `needs_reauth`, wording must say **reconnect**, not first-time connect.
6. Prefer reading grant status from existing product-tool account/grant stores (do not invent a parallel table).

## Acceptance criteria

- [ ] Salim-style first message with no calendar grant → connect Calendar CTA in under 2s, no blank.
- [ ] Same message with healthy calendar grant → normal tool path runs.
- [ ] Gmail `needs_reauth` + email ask → reconnect CTA.
- [ ] Trello path still works.
- [ ] Vitest covers calender typo + needs_reauth branch.

## Deploy

`carina-web` Core.

## Out of scope

OAuth client ID debugging for `unauthorized_client` root cause (covered in 03 for surfacing; full Google Console fix may be ops).
