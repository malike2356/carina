# Certified BSL Partner Path (Honest Pipeline)

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N05
**Priority:** P1
**Depends on:** None
**Target time:** 10-14h
**Primary paths:** `web/js/bsl.js, app/api/, docs/, 03-marketing-site/`
**Plan source:** Award-winning advice plan (Nice #5)

## Strategic intent

Replace fake "certified" temptation with a partner-ready asset pipeline: licensed clip slots, partner LOI placeholder, quality checklist, and UI that upgrades from starter to partner when assets exist.

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

Starter clips must not be mistaken for certified BSL interpretation.

## Current baseline (read before coding)

bsl.js starter phrases; claim firewall.

## Required deliverables

1. Asset manifest schema: phrase_id, clip_url, license, partner, certification_level (`starter_demo|partner_licensed`).
2. UI badge switches by certification_level.
3. Docs: partner onboarding checklist + LOI template (non-legal).
4. Admin/demo reload that can swap manifest to partner fixtures without claiming clinical certification of simultaneous interpreting.

## Architecture / design constraints

Manifest driven; no hardcoded "certified" strings.

## Implementation notes (advanced)

Coordinate with W10 claim firewall rules.

## Files to create or change

bsl manifest, API, UI badges, docs/partners/bsl-partner.md, tests

## Data model and API sketch

GET /api/features/bsl/phrases returns certification_level

## UI / UX requirements

Badge text: Starter demo clips | Partner licensed clips. Never "certified simultaneous interpretation" unless true.

## Safety, privacy, and trust requirements

Disclaimer always visible in starter mode.

## Acceptance criteria

Starter badge on demo; partner fixture flips badge; firewall passes.

## Tests and validation

Manifest schema; UI copy assertions in tests via API.

## Demo / sales / awards proof

Show starter disclaimer; flip fixture; show partner licensed badge.

## Out of scope for this prompt

Signing a real BSL agency contract.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N05`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
