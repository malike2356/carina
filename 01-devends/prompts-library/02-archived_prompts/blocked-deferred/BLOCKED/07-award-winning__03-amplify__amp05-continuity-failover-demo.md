# Amplify Continuity / Sidecar Failover Stage Demo

**Roadmap tier:** Amplify (do not rebuild)
**Prompt ID:** AMP05
**Priority:** P1
**Depends on:** Existing shipped feature
**Target time:** 6-10h
**Primary paths:** `web/, app/, docs/sales-demo-script-3min.md, tests/`
**Plan source:** Award-winning advice plan (Amplify #7 + Rubric evidence failover)

## Strategic intent

Make degraded/continuity mode a deliberate awards beat: one-click demo failover, banner copy, and sales script section.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Resilience exists but is hard to show live.

## Current baseline (read before coding)

continuity banner; sidecar profiles; resilience phase 07.

## Required deliverables

1. Demo control: simulate sidecar down (demo_mode only).
2. Banner + timeline system event.
3. Sales script 30s failover beat.
4. Status page reflects degraded.

## Architecture / design constraints

Demo-only flag; never in production orgs.

## Implementation notes (advanced)

Guard with demo_mode + practice manager.

## Files to create or change

provider settings UI, health, docs script, tests

## Data model and API sketch

POST /api/demo/simulate-sidecar-outage {enabled}

## UI / UX requirements

Danger-free demo toggle in advanced settings.

## Safety, privacy, and trust requirements

Clearly labeled simulation.

## Acceptance criteria

Toggle forces continuity path on next interpret in demo; event logged; prod flag rejected.

## Tests and validation

Authz + demo_mode guard.

## Demo / sales / awards proof

Flip simulate outage -> send turn -> show continuity.

## Out of scope for this prompt

Chaos engineering in production.

## Handoff

Update `07-award-winning/README.md` for `AMP05`; note flags, and a 90-second demo beat.
