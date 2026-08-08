# Helm / Microservices Readiness Without Premature Split

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N13
**Priority:** P3
**Depends on:** Archived microservices docs / helm stubs
**Target time:** 10-14h
**Primary paths:** `deploy/helm/, docs/architecture/, services/, docs/runbook-deploy.md`
**Plan source:** Award-winning advice plan (Nice #13)

## Strategic intent

Make deploy story award-credible for enterprise reviewers: harden Helm values, health probes, runbooks, and a clear "still monolith by default" architecture note, without forced service split.

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

Empty Helm charts signal immaturity; premature split burns time.

## Current baseline (read before coding)

deploy/helm, docs/architecture/microservices.md, services/README.md

## Required deliverables

1. Helm chart values for single-app deployment with sidecar optional.
2. Probes on /health and /dashboard/.
3. Runbook: backup, migrate, rollback.
4. Architecture decision record: when to split interpret vs billing.
5. Go/no-go checklist update.

## Architecture / design constraints

Default one Deployment + optional sidecar Deployment; shared secrets via k8s secrets template without real secrets committed.

## Implementation notes (advanced)

No requirement to run k8s locally for acceptance if `helm template` renders.

## Files to create or change

helm templates, ADR, runbook, checklist

## Data model and API sketch

N/A

## UI / UX requirements

N/A

## Safety, privacy, and trust requirements

Secret examples are placeholders only.

## Acceptance criteria

`helm template` succeeds; ADR merged; runbook lists rollback.

## Tests and validation

CI helm template dry-run if helm available; else documented.

## Demo / sales / awards proof

Show rendered manifest + ADR decision.

## Out of scope for this prompt

Actual multi-service rewrite.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N13`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
