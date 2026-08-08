# Amplify Consent Gate as Auditable Clinical Ritual

**Roadmap tier:** Amplify (do not rebuild)
**Prompt ID:** AMP02
**Priority:** P1
**Depends on:** Existing shipped feature
**Target time:** 6-10h
**Primary paths:** `web/, app/api/, tests/`
**Plan source:** Award-winning advice plan (Amplify #3)

## Strategic intent

Make consent feel like a clinical ritual: clearer methods, expiry/reconfirm rules, timeline event cards, and auditor-visible consent column polish.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Consent works but under-communicates seriousness for awards.

## Current baseline (read before coding)

Consent gate UI; patient consent fields; GDPR patient export.

## Required deliverables

1. Consent event card in timeline.
2. Reconfirm prompt when switching to ambient (if N07) or recording after long idle.
3. Dashboard patient consent freshness indicator.
4. Copy pass for method explanations.

## Architecture / design constraints

Events already in timeline; standardize event_type.

## Implementation notes (advanced)

Do not block anonymous unlink mode.

## Files to create or change

consent APIs if needed, web, dashboard patients, tests

## Data model and API sketch

Existing consent record; ensure events emitted

## UI / UX requirements

Gate visual upgrade matching clinical console; timeline card.

## Safety, privacy, and trust requirements

Audit every consent record/revoke.

## Acceptance criteria

Recording consent writes timeline event; freshness shows on patients table.

## Tests and validation

Event emission test.

## Demo / sales / awards proof

Maria Santos path from sales script.

## Out of scope for this prompt

Full nationwide NHS consent standards mapping.

## Handoff

Update `07-award-winning/README.md` for `AMP02`; note flags, and a 90-second demo beat.
