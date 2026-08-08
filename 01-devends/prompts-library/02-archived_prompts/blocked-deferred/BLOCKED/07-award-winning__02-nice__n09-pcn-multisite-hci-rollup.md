# PCN Multi-Site HCI Rollup

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N09
**Priority:** P1
**Depends on:** None
**Target time:** 14-22h
**Primary paths:** `app/db/, app/api/, web/dashboard/, docs/`
**Plan source:** Award-winning advice plan (Nice #9)

## Strategic intent

Allow a PCN / federation parent org to view rollup HCI and pilot KPIs across member practices without breaking tenant isolation.

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

PCN buyers want network view; single-surgery dashboards under-sell.

## Current baseline (read before coding)

Org model, entitlements, HCI APIs, federation stubs A14.

## Required deliverables

1. Org relation: parent_pcn_id or membership table.
2. Rollup endpoints enforcing membership authz.
3. Dashboard PCN view: sites table + HCI/KPI rollup.
4. Seed a demo PCN with two sites.
5. Docs for data sharing agreement note (draft).

## Architecture / design constraints

Strict allowlist of aggregate queries; no cross-tenant patient lists at PCN layer unless separate legal mode (default: aggregates only).

## Implementation notes (advanced)

Default deny patient export at PCN. Align with deferred enterprise federation without requiring SAML.

## Files to create or change

migrations, APIs, dashboard, seed, docs, tests

## Data model and API sketch

GET /api/pcn/sites; GET /api/pcn/kpis; GET /api/pcn/hci

## UI / UX requirements

PCN switcher for eligible users; sites table.

## Safety, privacy, and trust requirements

Aggregates only by default; audit PCN access.

## Acceptance criteria

Demo PCN user sees two sites' KPIs; cannot open other site's patient list.

## Tests and validation

Authz matrix tests.

## Demo / sales / awards proof

Login PCN manager -> rollup -> drill to site dashboard via support rules if allowed.

## Out of scope for this prompt

Live ODS directory sync.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N09`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
