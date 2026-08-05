# Aiva Nurse-Manager Employee Bridge (Ecosystem)

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N11
**Priority:** P2
**Depends on:** A16 partial; Carina/Aiva soft separation rules
**Target time:** 16-24h
**Primary paths:** `docs/ecosystem/, app/api/, stubs toward Carina`
**Plan source:** Award-winning advice plan (Nice #11)

## Strategic intent

Define and stub a liveable bridge where Aiva acts as Clinicom practice ops employee: summarize HCI KPIs, chase incomplete teach-backs, never silent clinical advice.

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

Ecosystem story is docs-only; awards/investors like coherent fabric when honest.

## Current baseline (read before coding)

Ecosystem docs; Carina boundaries; no nested carina/verlox.

## Required deliverables

1. Bridge contract OpenAPI: tasks Aiva may call (get KPIs, list incomplete onboarding, draft outreach) with auth.
2. Stub server handlers returning demo data.
3. Policy: Aiva cannot acknowledge safety flags; cannot modify clinical notes.
4. Docs sequence diagram + soft-separation compliance note.

## Architecture / design constraints

Outbound webhooks/inbound task API; stub until Carina wiring funded.

## Implementation notes (advanced)

Mark status sandbox in claim firewall.

## Files to create or change

docs, api stub router, tests, status badges

## Data model and API sketch

POST /api/ecosystem/aiva/tasks; GET allowlist

## UI / UX requirements

Trust/ecosystem page shows Aiva bridge sandbox.

## Safety, privacy, and trust requirements

Hard deny clinical ack/edit routes for ecosystem tokens.

## Acceptance criteria

Allowlist enforced; deny safety ack; demo task returns KPI summary JSON.

## Tests and validation

Authz deny matrix.

## Demo / sales / awards proof

Call stub task -> show KPI summary.

## Out of scope for this prompt

Production Carina deployment wiring without owner ask.

## Related prompts

`a16-carina-skill-aiva-employee.md`; `docs/ecosystem/aiva-clinicom-employee.md`

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N11`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
