# Structured EHR-Ready Handoff (JSON + Printable Clinical Summary)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W05
**Priority:** P0
**Depends on:** W03, W04 recommended
**Target time:** 14-20h
**Primary paths:** `app/lib/handoff*, app/api/, web/, docs/, tests/`
**Plan source:** Award-winning advice plan (Must #5)

## Strategic intent

Replace prose-only handoffs with a structured clinical communication object: problems/symptoms, meds/adherence, plan, safety, cultural notes, confidence, languages, plus clinician-printable PDF/HTML.

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

Prose dumps are hard to paste into EMIS/SystmOne mentally and fail awards for clinical craft.

## Current baseline (read before coding)

Existing createHandoff / handoff drawer; parseHandoffSummary on client; FHIR sandbox mappers if any.

## Required deliverables

1. Schema `HandoffDocument` v1 JSON (versioned).
2. Generator from session messages+events+authorship filter.
3. Drawer UI shows structured sections + Copy JSON + Copy plain + Print.
4. Optional one-click "Generate Easy Read pack from plan section".
5. Mapping stub to FHIR Communication / Composition for sandbox (not live writeback).
6. Docs for clinicians: where each section should land in notes.

## Architecture / design constraints

JSON schema file under `docs/schemas/handoff-document.v1.json`; server validates before persist.

## Implementation notes (advanced)

Include provenance: session_id, org_id, generated_at, model/sidecar profile, continuity_mode, claim disclaimer.

## Files to create or change

handoff lib, API, drawer JS, schema, tests, marketing/docs snippet

## Data model and API sketch

```
POST /api/sessions/:id/handoff/structured
GET  /api/sessions/:id/handoff/structured
GET  /api/sessions/:id/handoff/print.html
```

## UI / UX requirements

Sectioned drawer; print stylesheet; short title in header; safety flags visually escalated.

## Safety, privacy, and trust requirements

Watermark: AI-assisted; clinician review required. Never claim EHR filed unless writeback succeeded (it will not in this prompt).

## Acceptance criteria

Schema validates for Riverside demo; print view readable; Easy Read optional link works; FHIR stub returns mapped JSON without network write.

## Tests and validation

Schema validation tests; authorship filter tests; print HTML contains sections.

## Demo / sales / awards proof

After 2-3 turns, open structured handoff, copy JSON, print preview.

## Out of scope for this prompt

Live Epic/Cerner/EMIS writeback.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W05`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
