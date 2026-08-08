# WCAG AA Evidence Pack + In-Product Accessibility Hardening

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W06
**Priority:** P0
**Depends on:** Existing a11y.js high contrast / large print
**Target time:** 12-18h
**Primary paths:** `web/, web/dashboard/, docs/a11y-checklist.md, tests/`
**Plan source:** Award-winning advice plan (Must #6)

## Strategic intent

Convert the draft a11y checklist into verifiable AA-oriented product behavior plus an evidence folder awards/procurement can open.

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

Checklist is unchecked; keyboard and SR gaps undermine Trust and disability awards.

## Current baseline (read before coding)

Read `docs/a11y-checklist.md`, `web/js/a11y.js`, interpreter and dashboard focus styles.

## Required deliverables

1. Close critical checklist items in code: focus rings, skip link, aria names on icon buttons, live region discipline, 44px mobile targets.
2. Keyboard path script: complete one interpret turn without mouse.
3. `docs/a11y/evidence/` with methodology, results table, open issues.
4. Automated axe-core or similar smoke if feasible in CI; else documented manual + playwright keyboard test.
5. Dashboard and marketing pages inherit enough focus/contrast rules to not fail first glance.

## Architecture / design constraints

Keep vanilla JS; prefer progressive enhancement over new framework.

## Implementation notes (advanced)

Do not ship emoji. Ensure Alt+S / Alt+R still work and are documented in UI fineprint.

## Files to create or change

a11y.js, styles, index.html shells, docs/a11y/*, tests/test_a11y_* or playwright

## Data model and API sketch

None required unless storing org a11y prefs.

## UI / UX requirements

Visible :focus-visible; skip to composer; toolbar announce state.

## Safety, privacy, and trust requirements

Accessibility modes must not hide safety overlay or reduce its contrast.

## Acceptance criteria

Keyboard-only send works; icon buttons have accessible names; evidence doc lists pass/fail; high contrast still usable.

## Tests and validation

Playwright keyboard flow; optional axe scan on /app and /dashboard login.

## Demo / sales / awards proof

Toggle high contrast + large print; complete turn via keyboard; show evidence doc.

## Out of scope for this prompt

Formal third-party ATAC certification purchase.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W06`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
