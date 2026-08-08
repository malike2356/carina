# Clinician Authorship: Accept / Edit / Reject AI Turns

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W04
**Priority:** P0
**Depends on:** W03 recommended
**Target time:** 14-20h
**Primary paths:** `app/api/, app/db/, web/js/app.js, web/styles.css, tests/`
**Plan source:** Award-winning advice plan (Must #4)

## Strategic intent

Make the clinician the author of the clinical communication record. Every AI-assisted turn gets accept, edit, or reject with audit, before it is treated as confirmed output.

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

AI text currently lands as if it were the record. Awards and clinical safety require human authorship controls.

## Current baseline (read before coding)

Inspect renderMessage, interpret response shape, session message model fields, audit event types.

## Required deliverables

1. Message review_state: `ai_draft | accepted | edited | rejected`.
2. API endpoints to accept, edit (with new text), reject (with reason optional).
3. Timeline UI: draft badge, inline edit, Accept / Edit / Reject actions, keyboard Alt shortcuts where they do not collide with Alt+S/Alt+R.
4. Audit events for each transition with actor id.
5. Handoff generator prefers accepted/edited text; excludes rejected.
6. Optional org setting: `require_review_before_handoff`.

## Architecture / design constraints

- Store original_ai_text immutable; working_text mutable on edit.
- Rejection keeps row for audit but hides from patient-facing Easy Read packs.
- Soft delete not hard delete.

## Implementation notes (advanced)

- Backward compat: null review_state treated as accepted for legacy rows OR as ai_draft if created after feature flag on.
- Feature flag `clinician_authorship` default on for new orgs / demo.
- Prevent send of clinician-to-patient Easy Read pack from rejected content.

## Files to create or change

models + migration; interpret/session APIs; web timeline; tests

## Data model and API sketch

```
POST /api/sessions/:id/messages/:mid/accept
POST /api/sessions/:id/messages/:mid/edit { text }
POST /api/sessions/:id/messages/:mid/reject { reason? }
```

## UI / UX requirements

Draft chip; action row; edit textarea; high-contrast compatible; mobile friendly 44px targets.

## Safety, privacy, and trust requirements

Rejected unsafe phrasing remains in audit; clinician edit is attributed; AI label remains on drafts.

## Acceptance criteria

1. Rejected text absent from new handoff.
2. Edit stores both original and final.
3. Audit shows actor + timestamps.
4. Flag requiring review blocks handoff with clear error.

## Tests and validation

API state machine tests; UI unit not required if Playwright covering accept/edit.

## Demo / sales / awards proof

Generate turn -> edit dosage instruction -> accept -> handoff shows edited line only.

## Out of scope for this prompt

Full FHIR DocumentReference writeback (see deferred).

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W04`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
