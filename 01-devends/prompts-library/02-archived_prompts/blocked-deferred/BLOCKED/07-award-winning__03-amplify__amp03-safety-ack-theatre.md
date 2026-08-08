# Amplify Safety Ack + Hazard Registry Theatre

**Roadmap tier:** Amplify (do not rebuild)
**Prompt ID:** AMP03
**Priority:** P1
**Depends on:** Existing shipped feature
**Target time:** 8-12h
**Primary paths:** `web/, app/, docs/compliance/, tests/`
**Plan source:** Award-winning advice plan (Amplify #4 + Rubric clinical safety)

## Strategic intent

Stage safety acknowledgements as award theatre without collapsing usability: show control ID, why terms, suggested actions, and link to W01 pack.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Safety overlay can look like a generic modal.

## Current baseline (read before coding)

safety overlay; hazard controls; explain drawer.

## Required deliverables

1. Overlay shows control_id + reason terms.
2. Ack writes structured audit.
3. Link 'View control in safety pack' when W01 exists (progressive).
4. Practice drill mode to demo without patient.

## Architecture / design constraints

Reuse A08 registry ideas; share with W01.

## Implementation notes (advanced)

Drill mode uses synthetic session.

## Files to create or change

safety UI, ack API fields, docs, tests

## Data model and API sketch

ack payload includes control_ids[]

## UI / UX requirements

Instrument overlay; keyboard operable; high contrast.

## Safety, privacy, and trust requirements

Drill mode clearly labeled non-clinical.

## Acceptance criteria

Ack stores control ids; overlay shows why; drill mode works.

## Tests and validation

Ack payload test.

## Demo / sales / awards proof

Trigger chest pain safety -> show control -> ack.

## Out of scope for this prompt

Emergency services dialing.

## Handoff

Update `07-award-winning/README.md` for `AMP03`; note flags, and a 90-second demo beat.
