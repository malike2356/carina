# Hard Claim Firewall (Product + Marketing + Docs)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W10
**Priority:** P0
**Depends on:** None (or note related partial prompts)
**Target time:** 8-12h
**Primary paths:** `03-marketing-site/, web/, web/dashboard/, docs/, scripts/, tests/`
**Plan source:** Award-winning advice plan (Must #10 + Days 1-30 claim firewall)

## Strategic intent

Systematically prevent overclaims about BSL certification, live FHIR, live CIS, completed DTAC/DCB, and billed Clinicom-native Stripe when interim.

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

One overclaim can disqualify awards and Trust procurement.

## Current baseline (read before coding)

Known honesty labels in BSL rail; FHIR/CIS sandbox docs; interim stripe docs.

## Required deliverables

1. `docs/trust/claim-firewall.md` policy table: claim -> allowed wording -> forbidden wording -> code/docs owners.
2. Script `scripts/check-claim-firewall.py` scanning first-party trees for forbidden phrases (with allowlist paths for "not certified" sentences).
3. CI or local pytest invoking the script.
4. UI status chips for sandbox integrations (dashboard Trust sandbox).
5. Marketing + interpreter + dashboard copy pass fixing violations.

## Architecture / design constraints

Regex/phrase rules versioned in YAML; exit non-zero on violations.

## Implementation notes (advanced)

Align with writing-style script conventions; no emojis.

## Files to create or change

claim-firewall.md, check script, rules yaml, fix offending copy, tests

## Data model and API sketch

Optional GET /api/trust/claims-status for dashboard badges.

## UI / UX requirements

Sandbox chips: FHIR sandbox, CIS sandbox, BSL starter, Billing interim/native.

## Safety, privacy, and trust requirements

Honesty is a safety control (SC claim integrity).

## Acceptance criteria

Script passes on repo first-party clinicom paths after fixes; intentional "not certified" phrases allowed; dashboard shows chips.

## Tests and validation

Script unit on sample strings; full tree scan in CI dry-run.

## Demo / sales / awards proof

Run script; show Trust sandbox chips.

## Out of scope for this prompt

External counsel review of every sentence.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W10`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
