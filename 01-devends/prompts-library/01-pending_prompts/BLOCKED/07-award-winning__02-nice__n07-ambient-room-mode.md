# Ambient Room Mode (Consent-Led Continuous Listen)

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N07
**Priority:** P2
**Depends on:** None
**Target time:** 16-24h
**Primary paths:** `web/js/audio.js, web/, app/api/, docs/`
**Plan source:** Award-winning advice plan (Nice #7)

## Strategic intent

Offer an ambient encounter mode with unmistakable arming state, consent gate, chunked transcription turns, and hard stop, suitable for busy clinics without hidden listening.

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

Hold-to-talk is safe but slow; ambient without UX honesty is unethical.

## Current baseline (read before coding)

audio.js recording; consent gate; Alt+R.

## Required deliverables

1. Ambient arming UI: big state LED (Idle / Armed / Listening / Paused) with aria live announcements.
2. Consent prerequisite stronger copy for ambient.
3. Chunk upload pipeline with backpressure and pause on safety overlay.
4. Auto-stop after idle timeout.
5. Audit: ambient_started/stopped.
6. Docs: when not to use ambient.

## Architecture / design constraints

Client state machine; server stores chunks as normal messages after interpret.

## Implementation notes (advanced)

Default off; feature flag. iOS mic constraints documented. No background listen when tab hidden.

## Files to create or change

audio/ambient modules, UI, flags, tests, docs

## Data model and API sketch

Reuse interpret audio endpoints; add session ambient audit events

## UI / UX requirements

Impossible to miss listening state; color + text + pulse; high contrast variants.

## Safety, privacy, and trust requirements

Hidden listening is forbidden. Tab blur pauses. Consent required for linked patients.

## Acceptance criteria

Cannot arm without consent when patient linked; blur pauses; safety overlay pauses; audit events exist.

## Tests and validation

State machine unit tests; consent gating.

## Demo / sales / awards proof

Arm ambient -> speak -> pause on blur -> stop -> timeline turns.

## Out of scope for this prompt

Always-on wall hardware appliance.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N07`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
