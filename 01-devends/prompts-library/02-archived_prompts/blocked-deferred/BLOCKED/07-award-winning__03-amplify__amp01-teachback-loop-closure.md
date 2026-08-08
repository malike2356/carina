# Amplify Teach-Back Into Clinical Loop Closure

**Roadmap tier:** Amplify (do not rebuild)
**Prompt ID:** AMP01
**Priority:** P1
**Depends on:** Existing shipped feature
**Target time:** 8-12h
**Primary paths:** `web/, app/api/*comprehension*, web/dashboard/, tests/`
**Plan source:** Award-winning advice plan (Amplify #2 + Rubric human communication)

## Strategic intent

Deepen teach-back so scoring visibly changes next clinician actions: suggested re-explain script, gate handoff optionally, and surface rates on KPI board.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Teach-back exists but can feel bolted on.

## Current baseline (read before coding)

teachback UI in interpreter; postComprehension API; W08 KPIs if present.

## Required deliverables

1. After score, show 'gaps' checklist and one insertable re-explain template.
2. Session meta teachback_status.
3. Dashboard widget unfinished teach-backs.
4. Optional org setting block handoff until teach-back attempted.

## Architecture / design constraints

Reuse comprehension endpoints; extend payload.

## Implementation notes (advanced)

Keep clinician control; never auto-send re-explain to patient.

## Files to create or change

app comprehension modules, web teachback card, dashboard widget, tests

## Data model and API sketch

Extend POST comprehension; GET sessions?teachback=pending

## UI / UX requirements

Gap chips; Insert re-explain; clear score result.

## Safety, privacy, and trust requirements

Teach-back failure is not a diagnosis.

## Acceptance criteria

Low score offers insertable script; dashboard lists pending; setting blocks handoff when enabled.

## Tests and validation

Comprehension gap shaping; setting enforcement.

## Demo / sales / awards proof

Score weak teach-back -> insert script -> rescore.

## Out of scope for this prompt

Replacing entire comprehension model.

## Handoff

Update `07-award-winning/README.md` for `AMP01`; note flags, and a 90-second demo beat.
