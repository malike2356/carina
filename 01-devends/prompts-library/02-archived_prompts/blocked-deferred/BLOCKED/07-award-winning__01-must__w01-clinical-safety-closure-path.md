# Clinical Safety Closure Path (CSO-Ready Evidence Export)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W01
**Priority:** P0
**Depends on:** A08 hazard controls (archived), docs/compliance/dcb0129/*
**Target time:** 14-22h
**Primary paths:** `app/api/, app/lib/, docs/compliance/, web/dashboard/, tests/`
**Plan source:** Award-winning advice plan (Must #1)

## Strategic intent

Turn scattered hazard docs and in-product controls into a single, reproducible clinical safety closure pack that a Clinical Safety Officer can review, comment on, and eventually sign. Software proves controls; paperwork becomes exportable evidence rather than a Word cemetery.

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

Award and NHS buyers ask for DCB0129/0160 readiness. Clinicom has hazard logs, controls-map, and in-product hazard wiring, but not a one-click closure pack, versioned evidence trail, or dashboard workflow that shows control coverage gaps.

## Current baseline (read before coding)

- Read `docs/compliance/dcb0129/hazard-log.md`, `safety-case-outline.md`, `docs/compliance/controls-map.md`, and archived A08.
- Inventory control IDs (SC-01..SC-08 and any H* hazards) against live code paths: consent gate, safety overlay ack, continuity/fallback, medication identity, Easy Read labels, BSL honesty labels.
- Dashboard already has compliance / trust sandbox views; extend rather than fork.

## Required deliverables

1. Versioned **Safety Evidence Pack** generator (HTML + PDF) combining:
   - Hazard log snapshot
   - Control map (hazard -> control -> code path / test)
   - Recent safety flag + acknowledgement audit samples (redacted)
   - Residual risk statement template
   - Explicit list of controls NOT yet externally audited
2. Dashboard **Clinical safety** page for practice_manager + readonly_admin:
   - Coverage %, failing controls, last pack generated
   - Button: Generate pack (stores artifact metadata, not secrets)
3. Machine-readable `GET /api/compliance/safety-case` JSON for auditors.
4. Release checklist hook or docs script that fails CI/smoke when a mapped control lacks a test reference.
5. Update marketing/trust language to say "CSO evidence pack available; external DTAC/DCB audit pending" when true.

## Architecture / design constraints

- Treat evidence as derived from source of truth (markdown + code annotations + audit tables), not a manually copied blob.
- Prefer annotation markers in code comments or a Python registry `CONTROL_REGISTRY` mapping control_id -> {module, tests, ui_surface, severity}.
- PDF generation: reuse any existing report/PDF path if present; else HTML print stylesheet first, PDF second.
- Multi-tenant: pack is org-scoped for audit samples, but hazard/control taxonomy is product-global.

## Implementation notes (advanced)

- Add `app/lib/clinical_safety/registry.py` with frozen control definitions.
- Add `app/lib/clinical_safety/pack.py` to assemble markdown/HTML.
- Wire control IDs into safety_ack, consent_record, continuity mode transitions, and medication assistant if not already present.
- Do not invent a fake "signed by CSO" badge. Signature status is enum: `draft | internal_review | externally_audited`.
- Ensure pack includes timestamp, app version/git sha if available, and claim disclaimer.

## Files to create or change

- `app/lib/clinical_safety/registry.py` (create)
- `app/lib/clinical_safety/pack.py` (create)
- `app/api/compliance.py` or extend existing compliance router (change)
- `web/dashboard/app.js` + styles (change)
- `docs/compliance/dcb0129/README.md` (update)
- `tests/test_clinical_safety_pack.py` (create)

## Data model and API sketch

```
GET  /api/compliance/controls                 -> list controls + coverage
GET  /api/compliance/safety-case              -> JSON safety case snapshot
POST /api/compliance/safety-case/export       -> { format: html|pdf, include_samples: bool }
GET  /api/compliance/safety-case/exports/:id  -> download metadata / URL
```
Export records: id, org_id, created_by, created_at, format, control_coverage_pct, checksum.

## UI / UX requirements

- Dashboard nav item under Trust / Compliance: "Clinical safety".
- Instrument panel: coverage ring, table of controls, gap callouts.
- Export button with format select; show last export time.
- Readonly auditor can view and export; cannot mutate registry.

## Safety, privacy, and trust requirements

- Redact patient free text in sample events; prefer event_type + hashed session ids.
- Never include API keys, Stripe secrets, or full unredacted clinical narratives in downloads by default.
- Clear banner: not a substitute for external DCB0129/DTAC certification.

## Acceptance criteria

1. Manager can generate HTML pack in <30s on seeded demo.
2. Every shipped control ID appears in JSON with at least one code path and one test id or marked `gap`.
3. Export checksum is stable for identical content.
4. Marketing/trust pages do not claim external audit completion.
5. Auditor role can open the page.

## Tests and validation

- Unit: registry completeness; redaction helper.
- API: authz for manager vs clinician vs auditor.
- Snapshot test of pack HTML contains hazard + control sections.
- Writing-style check on new docs/UI strings.

## Demo / sales / awards proof

Open dashboard as manager -> Clinical safety -> Generate pack -> show coverage gaps honestly -> open HTML pack and highlight safety ack control.

## Out of scope for this prompt

Hiring external auditor, solicitor sign-off, live NHS DTAC submission portal integration.

## Related prompts

- Partially overlaps `06-hci-full-roadmap/05-advanced/a07-dcb0129-0160-external-audit-dtac.md` (blocked-owner for external auditor). This prompt ships the *internal* closure pack so a CSO can review.
- Related phase `04-system/26-dcb0129-clinical-safety-compliance.md`.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W01`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
