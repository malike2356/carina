# Deferred: Live NHS CIS / Smartcard Login

**Roadmap tier:** Deferred (contract)
**Prompt ID:** D02
**Priority:** P0 when unblocked
**Depends on:** CIS middleware access
**Target time:** 20-40h after CIS access
**Primary paths:** `app/api/nhs_cis*, docs/nhs-cis.md`
**Plan source:** Award-winning advice plan (Defer CIS; pending A05 / phase 23)

## Strategic intent

Replace sandbox CIS simulation with real authentication flows when middleware credentials exist.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Sandbox login is for demos only.

## Current baseline (read before coding)

Sandbox login endpoint; docs status sandbox.

## Required deliverables

1. Real OIDC/smartcard integration adapter.
2. Role mapping.
3. Fallback password policy interactions.
4. Claim firewall update.

## Architecture / design constraints

Adapter pattern behind existing auth.

## Implementation notes (advanced)

Remain sandbox if env missing.

## Files to create or change

nhs cis module, docs, tests

## Data model and API sketch

Existing routes gain live mode

## UI / UX requirements

Login button label CIS live vs sandbox.

## Safety, privacy, and trust requirements

Session binding; logout-all; audit.

## Acceptance criteria

Without creds stays sandbox; with creds documented handshake.

## Tests and validation

Mode selection tests.

## Demo / sales / awards proof

Sandbox path until live.

## Out of scope for this prompt

Procuring CIS access.

## Related prompts

`a05-nhs-cis-sso.md`, `23-nhs-cis-sso-integration.md`

## Handoff

Update `07-award-winning/README.md` for `D02`; note flags, and a 90-second demo beat.
