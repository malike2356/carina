# Specialty Packs with Measured Lift

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N01
**Priority:** P1
**Depends on:** Existing specialty packs / glossary / marketplace archives
**Target time:** 14-22h
**Primary paths:** `app/api/marketplace*, app/lib/, web/, docs/services/, tests/`
**Plan source:** Award-winning advice plan (Nice #1)

## Strategic intent

Make specialty packs scientifically demoable: install maternity or cardio pack, show glossary preference, and report confidence / teach-back lift versus baseline encounters.

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

Packs exist as entitlements but awards need measured communication lift, not a checkbox.

## Current baseline (read before coding)

Inspect marketplace APIs, glossary injection in interpret pipeline, entitlements specialty_packs.

## Required deliverables

1. Pack manifest schema: terms, preferred phrasings, teach-back prompts, Easy Read symbol hints, evaluation tags.
2. Interpret pipeline hook applying pack preferences with provenance note on turn meta.
3. Dashboard card: "Pack lift" comparing confidence/teach-back before/after install windows.
4. Seed maternity pack fully wired for Riverside demo.
5. Docs playbook for enabling a pack in a pilot.

## Architecture / design constraints

Pack content versioned in DB or JSON fixtures; never hardcode clinical advice as dogma; clinician authorship still applies.

## Implementation notes (advanced)

Lift metrics are observational, labeled as such. Minimum sample thresholds before claiming lift.

## Files to create or change

pack fixtures, pipeline hook, analytics lift endpoint, dashboard panel, tests

## Data model and API sketch

GET /api/packs; POST /api/orgs/me/packs/{id}/install; GET /api/analytics/pack-lift?pack_id=&range=

## UI / UX requirements

Marketplace install + lift chart; interpreter fineprint when pack active.

## Safety, privacy, and trust requirements

Packs are language support, not diagnostic protocols. Label clearly.

## Acceptance criteria

Installing maternity pack influences at least one glossary choice in demo transcript; lift endpoint returns structure even if sample small.

## Tests and validation

Pipeline unit with pack on/off; analytics empty-sample behavior.

## Demo / sales / awards proof

Install maternity pack -> run antenatal phrase -> show pack-active meta -> show lift panel.

## Out of scope for this prompt

Creating clinical guidelines; NICE guideline licensing.

## Related prompts

Builds on archived P08 specialty packs and marketplace A13.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N01`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
