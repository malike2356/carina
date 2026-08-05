# 03: Tool grant honesty and reauth surfacing

**Status:** PENDING
**Priority:** P0
**Depends on:** 02
**Unlocks:** 06, 07, 09

## Goal

Aiva must never pretend tools work when grants are missing, errored, or `needs_reauth`. Tool results and system context must make status obvious to the model and to the human.

## Why

Selorm Gmail/Drive were `needs_reauth` (`Google token refresh failed HTTP 401: unauthorized_client`). Chat still looked "alive" then collapsed into blank/greeting. Product tools already return `grantStatus` / `needsOAuth` / `authUrl` in places; force that into every user-visible path.

## Files to change (expected)

- `carina/02-backends/core.carinaai.uk/src/workers/product-tools/invoke.ts`
- Worker capability / parity prompt builders (`spinnable-parity-store.ts`, `worker-capability-context.ts`, or equivalent inventory text)
- Hire Aiva Tools UI badges if status is unclear (`app.carinaai.uk` / admin hireaiva Tools pages)
- Optional OPS alert when a demo workspace grant enters `needs_reauth`

## Requirements

1. On tool failure with `needs_reauth` / `needsOAuth`, user-facing synthesis must include reconnect guidance and auth URL when present.
2. Capability context injected into the worker prompt must list tool_slug + status (`connected` / `needs_reauth` / missing), not only "connected tools."
3. Morning briefing / email digest paths must soft-fail with reconnect language if Gmail is dead, not empty chat.
4. Tools UI: Selorm-style rows show needs_reauth prominently with one-click reconnect.
5. Add a focused test that a mocked needs_reauth gmail-list result cannot be summarised as "I found no emails" without mentioning reconnect.

## Ops note (founder's action, document only)

`unauthorized_client` on refresh often means Google OAuth client/secret mismatch or revoked client. After code honesty ships, verify prod `GOOGLE_CLIENT_ID` / secret against Cloud Console and `.access` sources. Do not paste secrets into the prompt file.

## Acceptance criteria

- [ ] Prompt inventory shows needs_reauth tools explicitly.
- [ ] Web Tools UI does not look "all green" for broken grants.
- [ ] Telegram email ask with needs_reauth yields reconnect language (with 02+01 shipped).
- [ ] Vitest for invoke/capability honesty.

## Deploy

Core `carina-web`; cloud if Tools UI changes.
