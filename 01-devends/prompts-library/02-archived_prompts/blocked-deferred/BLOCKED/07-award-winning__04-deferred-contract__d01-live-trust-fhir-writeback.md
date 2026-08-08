# Deferred: Live Trust FHIR Writeback (Contract Gate)

**Roadmap tier:** Deferred (contract)
**Prompt ID:** D01
**Priority:** P0 when unblocked
**Depends on:** Owner Trust FHIR contract + environment
**Target time:** 20-40h after contract
**Primary paths:** `app/api/fhir*, docs/`
**Plan source:** Award-winning advice plan (Defer FHIR; pending A04 / phase 22)

## Strategic intent

When a Trust contract exists, implement real writeback of Communication/Composition from structured handoff with delivery receipts and rollback.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Without contract, live writeback is vapor and dangerous to claim.

## Current baseline (read before coding)

Sandbox FHIR roundtrip; W05 mapping stub.

## Required deliverables

1. Live client config via secrets.
2. Writeback job with retries.
3. Delivery receipt UI.
4. Claim firewall status flips to live only after successful prod probe.
5. DPIA addendum.

## Architecture / design constraints

Outbound only after clinician accepts handoff (W04/W05).

## Implementation notes (advanced)

Stop if contract missing; leave clear blocked status in README.

## Files to create or change

fhir client, jobs, dashboard, docs, tests against sandbox until live creds

## Data model and API sketch

POST /api/fhir/writeback/:handoff_id

## UI / UX requirements

Writeback status chip per handoff.

## Safety, privacy, and trust requirements

No silent writes; clinician confirm; audit.

## Acceptance criteria

Blocked without config; with sandbox creds posts mock; claim status accurate.

## Tests and validation

Client unit; authz; no-op without config.

## Demo / sales / awards proof

Sandbox writeback receipt.

## Out of scope for this prompt

Building without Trust credentials.

## Related prompts

Keep sandbox; do not market as live. See `a04-fhir-r4-full.md`, `22-fhir-r4-integration.md`, W05 structured handoff.

## Handoff

Update `07-award-winning/README.md` for `D01`; note flags, and a 90-second demo beat.
