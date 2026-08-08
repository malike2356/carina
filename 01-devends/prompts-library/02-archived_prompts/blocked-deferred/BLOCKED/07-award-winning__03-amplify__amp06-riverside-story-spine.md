# Amplify Riverside End-to-End Story Spine

**Roadmap tier:** Amplify (do not rebuild)
**Prompt ID:** AMP06
**Priority:** P1
**Depends on:** Existing shipped feature
**Target time:** 8-12h
**Primary paths:** `03-marketing-site/, web/, web/dashboard/, docs/sales-demo-script-3min.md`
**Plan source:** Award-winning advice plan (Amplify #10 + marketing continuity)

## Strategic intent

Tighten marketing case study -> live /app deep link -> dashboard proof so judges feel one product spine.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Surfaces can feel like three websites.

## Current baseline (read before coding)

riverside case study, demo script, bootstrap demo.

## Required deliverables

1. Case study CTAs carry query `?story=adaeze` into /app.
2. Interpreter honors story preset.
3. Dashboard deep link highlights matching session.
4. Demo script updated timings.

## Architecture / design constraints

Query/hash presets only; no PHI in URLs.

## Implementation notes (advanced)

Reuse seed IDs stable across reseed where possible.

## Files to create or change

marketing html/js, app bootstrap, dashboard sessions, docs

## Data model and API sketch

Optional bootstrap story param

## UI / UX requirements

Subtle story breadcrumb on app.

## Safety, privacy, and trust requirements

No extra patient data in URLs.

## Acceptance criteria

From case study CTA, app lands on Adaeze story; dashboard can open same session.

## Tests and validation

Preset mapping unit/integration.

## Demo / sales / awards proof

Marketing -> app -> dashboard in 3 minutes.

## Out of scope for this prompt

New cinematic production (see N14).

## Handoff

Update `07-award-winning/README.md` for `AMP06`; note flags, and a 90-second demo beat.
