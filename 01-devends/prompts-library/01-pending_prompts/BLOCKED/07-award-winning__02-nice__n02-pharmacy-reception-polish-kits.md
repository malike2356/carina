# Pharmacy and Reception Mode Polish Kits

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N02
**Priority:** P1
**Depends on:** Existing ambulance/pharmacy/reception/family modes
**Target time:** 10-16h
**Primary paths:** `web/js/modes/, docs/services/playbooks/, web/, tests/`
**Plan source:** Award-winning advice plan (Nice #2)

## Strategic intent

Turn mode presets into award-grade workflow kits: chrome, phrase starters, SOPs, and 60-second demo scripts per setting.

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

Modes are feature flags without operational depth.

## Current baseline (read before coding)

Read web/js/modes/* and docs/services/playbooks/pharmacy.md + reception.md.

## Required deliverables

1. Pharmacy kit: compact chrome, OTC/prescription talk tracks, medication identity assist surface, label-confusion templates.
2. Reception kit: triage-friendly language, booking/follow-up phrases, privacy desk mode (screen mute / hide timeline details).
3. In-app kit panel + printable SOP PDF/HTML per mode.
4. Demo script sections in docs/sales or playbooks.
5. Feature flags remain, but kits ship enabled in demo.

## Architecture / design constraints

Mode modules inject kit config objects; avoid separate apps.

## Implementation notes (advanced)

Privacy desk mode must blank patient identifiers when receptionist role uses shared screen.

## Files to create or change

modes/pharmacy.js, reception.js, CSS, playbooks, tests for mode chrome classes

## Data model and API sketch

Optional GET /api/modes/:id/kit

## UI / UX requirements

Kit checklist; phrase buttons; privacy desk toggle with visible state.

## Safety, privacy, and trust requirements

Reception privacy desk is a control; log toggles.

## Acceptance criteria

Switching to pharmacy changes chrome + phrases; reception privacy desk hides identifiers; SOP prints.

## Tests and validation

Mode apply DOM class tests via jsdom if present, else API kit JSON tests.

## Demo / sales / awards proof

Mode switch pharmacy -> use medication timing phrase; reception privacy desk on/off.

## Out of scope for this prompt

Full pharmacy EPS integration.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N02`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
