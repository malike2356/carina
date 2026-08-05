# Family Conference Facilitator UI

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N03
**Priority:** P1
**Depends on:** Archived multiparty interpretation scaffolds
**Target time:** 12-18h
**Primary paths:** `web/js/multiparty.js, web/, app/api/, tests/`
**Plan source:** Award-winning advice plan (Nice #3)

## Strategic intent

Upgrade multiparty from a flag into a facilitated family conference: speaker roster, language per participant, shared plan projection, teach-back per family member.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`, `docs/`, `tests/`).
- Local run: `CLINICOM_SEED_DEMO=1 python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8600`.
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md`. Never invent Stripe prices unless the owner explicitly asks. Never paste secrets into chat, commits, docs, or UI.
- Google OAuth / signing: use files under `/opt/lampp/htdocs/verlox/.access/`. Never commit real `.env` secrets.
- Writing style: no em dashes (U+2014), no en dashes (U+2013), no emojis in code, docs, commits, or UI copy.
- Never recreate nested `carina/verlox/` trees.
- Claim firewall: never imply certified simultaneous BSL, live FHIR writeback, live NHS CIS, or completed external DTAC/DCB unless literally true.
- Extend existing surfaces; add tests; Riverside demo remains default.

## Problem this prompt solves

Family meetings are chaotic; product should choreograph communication, not just translate.

## Current baseline (read before coding)

multiparty.js, family mode, session participant models if any.

## Required deliverables

1. Participant roster UI (name, role, language).
2. Turn attribution to participant.
3. Shared "proposed plan" board visible to clinician.
4. Per-participant teach-back hooks.
5. Handoff includes family conference attendees section.

## Architecture / design constraints

Participants associated to session; messages gain participant_id.

## Implementation notes (advanced)

Consent: recording multiparty requires org policy acknowledgement once per session.

## Files to create or change

models/migration if needed, multiparty UI, APIs, tests

## Data model and API sketch

POST /api/sessions/:id/participants; PATCH participant; messages include participant_id

## UI / UX requirements

Roster rail; active speaker chip; plan board; mobile usable.

## Safety, privacy, and trust requirements

Do not auto-share minors data beyond linked patient rules; clinician remains facilitator.

## Acceptance criteria

Add 2 family participants with languages; attribute turns; handoff lists attendees.

## Tests and validation

Participant CRUD authz; message attribution.

## Demo / sales / awards proof

Family mode conference with two languages + shared plan.

## Out of scope for this prompt

True simultaneous multi-audio transcription DSP.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N03`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
