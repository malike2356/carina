# Trust Share Pack (DPIA, DPA, Retention, DSPT Bundle)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W07
**Priority:** P0
**Depends on:** Existing draft docs under docs/compliance and docs/legal
**Target time:** 10-16h
**Primary paths:** `docs/compliance/, docs/legal/, web/dashboard/, 03-marketing-site/, app/api/`
**Plan source:** Award-winning advice plan (Must #7)

## Strategic intent

Produce one downloadable Trust Share Pack that procurement can receive today, watermarked for legal review, with an in-dashboard download and a public trust-hub teaser.

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

Drafts exist but are scattered; buyers cannot self-serve a coherent pack.

## Current baseline (read before coding)

Inventory dpia-draft, dspt-checklist, dpa-template, retention-policy, privacy page, status/health.

## Required deliverables

1. Pack assembler (HTML zip or single print HTML) with TOC.
2. Watermark: "Draft for legal / CSO review. Not solicitor-signed."
3. Dashboard Trust page Download pack.
4. Marketing trust hub links to request or gated download.
5. Version field + last updated date on every doc included.
6. Subprocessors / sidecar note (Keprix/Carina) without secrets.

## Architecture / design constraints

Static docs compiled by script `scripts/build-trust-pack.py` into `docs/compliance/trust-share-pack/`; API can stream the built artifact.

## Implementation notes (advanced)

Do not invent legal conclusions. Prefer accurate draft status. Owner can replace PDFs later.

## Files to create or change

build script, pack output gitkeep or generated artifact, dashboard link, privacy/status cross-links, tests for pack presence

## Data model and API sketch

GET /api/compliance/trust-pack (auth); optional public summary endpoint without sensitive appendices

## UI / UX requirements

Trust page card with contents list + download.

## Safety, privacy, and trust requirements

Exclude .access secrets; exclude real patient exports from pack.

## Acceptance criteria

Authenticated manager downloads pack; all listed docs present; watermark visible; marketing does not claim signed DPIA.

## Tests and validation

Script builds; pack file list assertion; writing-style on new copy.

## Demo / sales / awards proof

Trust page -> download -> open TOC.

## Out of scope for this prompt

Actual solicitor signing; cyber Essentials certificate purchase.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W07`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
