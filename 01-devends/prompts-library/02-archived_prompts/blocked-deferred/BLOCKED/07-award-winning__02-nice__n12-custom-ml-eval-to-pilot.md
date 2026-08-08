# Custom ML Models Eval-to-Pilot Path

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N12
**Priority:** P2
**Depends on:** Existing eval harness; no trained models yet
**Target time:** 16-24h
**Primary paths:** `docs/ml/, app/, services/, tests/`
**Plan source:** Award-winning advice plan (Nice #12; overlaps A11 / phase 32)

## Strategic intent

Advance from eval harness to a gated pilot path: labeled dataset format, offline eval scorecard automation, model registry stub, and shadow-mode predictions that never auto-apply clinically.

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

Custom ML is promised; without gated path it becomes unsafe hype.

## Current baseline (read before coding)

docs/ml/plan.md, eval-scorecard.md, existing tests/test_ml_eval.py

## Required deliverables

1. Dataset schema + sample labeled utterances.
2. `python -m app.ml.eval_run` producing scorecard JSON/MD.
3. Model registry table: name, version, metrics, status (`lab|shadow|pilot|retired`).
4. Shadow mode: store prediction beside sidecar output; UI optional compare for managers.
5. Explicit non-application to patient-facing text until status pilot + org flag.

## Architecture / design constraints

Offline-first; shadow predictions never mutate translated_text automatically.

## Implementation notes (advanced)

Do not train heavy models in CI; ship tiny baseline or stub predictor with metrics path.

## Files to create or change

ml package, docs scorecard updates, registry API, tests

## Data model and API sketch

GET /api/ml/models; POST /api/ml/shadow/run (dev)

## UI / UX requirements

Manager ML lab page showing scorecard; claim: lab only.

## Safety, privacy, and trust requirements

Shadow only by default; claim firewall phrases.

## Acceptance criteria

Eval run produces scorecard artifact; shadow output stored; patient text unchanged.

## Tests and validation

Eval run smoke; registry authz.

## Demo / sales / awards proof

Run eval_run -> open scorecard -> show shadow compare.

## Out of scope for this prompt

GPUs, production model training, auto-cutover.

## Related prompts

`a11-custom-ml-models.md`, `05-cathedral/32-custom-ml-models-and-pipeline.md`

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N12`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
