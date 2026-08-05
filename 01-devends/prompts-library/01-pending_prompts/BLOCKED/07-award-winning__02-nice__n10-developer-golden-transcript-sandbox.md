# Developer Golden Transcript Sandbox

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N10
**Priority:** P1
**Depends on:** Archived developer platform A12 / phase 28
**Target time:** 10-16h
**Primary paths:** `sdk/, docs/, app/api/, tests/, web/dashboard/ or /docs`
**Plan source:** Award-winning advice plan (Nice #10)

## Strategic intent

Ship a sandbox where developers replay golden transcripts against /api/interpret with deterministic fixtures and OpenAPI examples, raising integrator confidence.

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

SDK stubs without golden paths feel vapor.

## Current baseline (read before coding)

sdk/ stubs, OpenAPI tests, interpret pipeline.

## Required deliverables

1. Golden transcript fixtures (yo-en Adaeze path, ar pharmacy confusion, pa antenatal).
2. Replay endpoint or CLI `python -m app.tools.replay_transcript`.
3. OpenAPI examples attached.
4. Public docs page under docs/ or gated dashboard developer tab.
5. SDK README updated with first 5 minutes guide.

## Architecture / design constraints

Fixtures drive API in demo_mode; never call paid sidecar if CLINICOM_REPLAY_LOCAL=1.

## Implementation notes (advanced)

Deterministic fallback responses for CI.

## Files to create or change

fixtures, replay tool, openapi, sdk README, tests

## Data model and API sketch

POST /api/dev/replay { fixture_id } (manager/dev token)

## UI / UX requirements

Optional developer tab listing fixtures + run button.

## Safety, privacy, and trust requirements

Dev endpoints disabled when demo_mode false unless explicit env.

## Acceptance criteria

Replay Adaeze fixture returns expected safety flag shape; CI uses local replay.

## Tests and validation

Replay snapshot tests.

## Demo / sales / awards proof

Run replay -> show safety + cultural notes.

## Out of scope for this prompt

Public free unlimited production API.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N10`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
