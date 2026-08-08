# Amplify Cultural Adaptation Notes Quality

**Roadmap tier:** Amplify (do not rebuild)
**Prompt ID:** AMP04
**Priority:** P2
**Depends on:** Existing shipped feature
**Target time:** 6-10h
**Primary paths:** `app/, sidecar contract usage, web/, tests/`
**Plan source:** Award-winning advice plan (Amplify #8)

## Strategic intent

Raise cultural note quality: structured types (lexicon, etiquette, family role), clinician confirm/dismiss, and analytics of note usefulness.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Notes can be free-text noise.

## Current baseline (read before coding)

cultural_notes on interpret; Adaeze drugs example.

## Required deliverables

1. Typed cultural note schema.
2. Confirm/dismiss on timeline.
3. Seed improved Yoruba/Arabic/Punjabi examples.
4. Filter obvious junk heuristics.

## Architecture / design constraints

Server validates note type enum.

## Implementation notes (advanced)

No stereotyping templates that assign traits to ethnicities; keep linguistic/contextual.

## Files to create or change

schema, pipeline, UI, fixtures, tests

## Data model and API sketch

notes include type, confidence; POST dismiss

## UI / UX requirements

Cultural chips with type label.

## Safety, privacy, and trust requirements

Avoid essentializing culture; linguistic context only.

## Acceptance criteria

Demo notes typed; dismiss audited; junk filtered in unit tests.

## Tests and validation

Filter heuristics; schema.

## Demo / sales / awards proof

Adaeze case cultural chip confirm.

## Out of scope for this prompt

Large cultural knowledge base licensing.

## Handoff

Update `07-award-winning/README.md` for `AMP04`; note flags, and a 90-second demo beat.
