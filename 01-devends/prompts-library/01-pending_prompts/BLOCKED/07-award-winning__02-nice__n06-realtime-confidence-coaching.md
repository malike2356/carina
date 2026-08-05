# Real-Time Confidence Coaching

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N06
**Priority:** P1
**Depends on:** Confidence scores on turns; explainability drawer
**Target time:** 10-16h
**Primary paths:** `app/lib/, web/js/app.js, tests/`
**Plan source:** Award-winning advice plan (Nice #6)

## Strategic intent

When confidence drops, coach the clinician with concrete clarifying questions or slower phrasing suggestions, without nagging or fake certainty.

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

Low confidence is shown but not actionable.

## Current baseline (read before coding)

confidence chips, explain drawer, interpret response fields.

## Required deliverables

1. Coaching rules engine: thresholds + reason terms -> suggestion cards.
2. Timeline/composer coaching tray (dismissible, audited if acted on).
3. Org setting for aggressiveness: quiet / standard / training.
4. Metrics: coach shown, coach accepted.

## Architecture / design constraints

Server-side suggestions preferred for audit; client can display.

## Implementation notes (advanced)

No post-hoc fake certainty (align A03). Suggestions are questions/phrasing, not diagnoses.

## Files to create or change

coaching lib, API field on interpret, UI tray, tests

## Data model and API sketch

Interpret response includes coaching?: { level, suggestions[] }; POST dismiss/accept

## UI / UX requirements

Non-modal tray; keyboard accessible; does not cover safety overlay.

## Safety, privacy, and trust requirements

Never auto-send coach text to patient; clinician must insert.

## Acceptance criteria

Force low-confidence fixture shows coach; accept inserts into composer; dismiss logged.

## Tests and validation

Rules unit tests; interpret fixture.

## Demo / sales / awards proof

Trigger low confidence on ambiguous pharmacy brand line -> coach -> insert clarify question.

## Out of scope for this prompt

Training a new ML calibrator (see N12/D).

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N06`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
