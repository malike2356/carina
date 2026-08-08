# Pilot Outcome Measurement (KPI Board + Weekly Story)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W08
**Priority:** P0
**Depends on:** Existing analytics overview endpoints
**Target time:** 14-20h
**Primary paths:** `app/api/analytics*, app/jobs/weekly_report.py, web/dashboard/, docs/`
**Plan source:** Award-winning advice plan (Must #8 + Days 31-60 KPI strip)

## Strategic intent

Prove Clinicom improves communication outcomes: teach-back pass rate, safety flag rate, confidence trends, language mix, sessions, authorship edit rate. Ship a pilot KPI board and strengthen weekly report narrative.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`, `docs/`, `tests/`).
- Local run: `CLINICOM_SEED_DEMO=1 python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8600`.
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md`. Never invent Stripe prices unless the owner explicitly asks. Never paste secrets into chat, commits, docs, or UI.
- Google OAuth / signing: use files under `/opt/lampp/htdocs/verlox/.access/` (platform + Clinicom redirect SoT). Never commit real `.env` secrets.
- Writing style: no em dashes (U+2014), no en dashes (U+2013), no emojis in code, docs, commits, or UI copy. Prefer `;`, `:`, `,`, `-`, parentheses, or sentence breaks.
- Never recreate nested `carina/verlox/` trees. Canonical Carina is only under `carina/02-backends/`, `carina/03-frontends/`, `carina/scripts/`.
- Claim firewall: never imply certified simultaneous BSL, live FHIR writeback, live NHS CIS smartcard login, or completed external DTAC/DCB audit unless that status is literally true in code and docs.
- Prefer extending existing surfaces over parallel toys. Match local PSR / FastAPI / vanilla JS style. Add or update tests for changed behavior.
- Demo clinic remains Riverside Family Practice unless this prompt says otherwise.

## Problem this prompt solves

Awards and PCN buyers ask "so what?". Screenshots without KPIs lose.

## Current baseline (read before coding)

Analytics overview, HCI dashboards, weekly_report job, comprehension/teach-back APIs.

## Required deliverables

1. KPI schema + endpoint for range 7d/30d/90d.
2. Dashboard Overview strip + dedicated Pilot outcomes panel with sparklines (Chart.js already loaded).
3. Weekly report email/HTML includes KPI deltas and one "story" line templated (no emoji).
4. Seeded demo data produces non-zero interesting charts.
5. Export CSV for pilot sponsors.

## Architecture / design constraints

Compute from sessions/messages/events/comprehension tables; cache per org/day optional.

## Implementation notes (advanced)

Define teach-back pass threshold consistently with existing score API. Authorship metrics if W04 present else omit gracefully.

## Files to create or change

analytics modules, weekly_report job, dashboard overview, docs/gtm/pilot-kpis.md, tests

## Data model and API sketch

GET /api/analytics/pilot-kpis?range=30d; GET /api/analytics/pilot-kpis.csv

## UI / UX requirements

KPI cards + chart; empty states explain need for more encounters.

## Safety, privacy, and trust requirements

Aggregates only; no patient names in weekly email by default.

## Acceptance criteria

Demo org shows KPI cards; CSV downloads; weekly report job renders KPIs in fixture mode.

## Tests and validation

Aggregation unit tests; authz; job dry-run.

## Demo / sales / awards proof

Overview -> Pilot outcomes -> explain teach-back trend.

## Out of scope for this prompt

Causal clinical outcomes like hospital admission reduction RCTs.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W08`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
