# Production Auth Resilience (OAuth Redirect SoT, Magic Link, Recovery UX)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W09
**Priority:** P0
**Depends on:** Owner configures prod redirect URIs; M19 partial
**Target time:** 12-18h
**Primary paths:** `app/api/auth.py, web/dashboard/, docs/oauth-google-setup.md, .access/ (redirect labels)`
**Plan source:** Award-winning advice plan (Must #9; extends HCI M19)

## Strategic intent

Make sign-in boringly reliable for practices: correct Google redirect configuration docs/SoT, magic link consume robustness, password reset UX, clearer errors after SW fixes, recovery when SSO required.

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

Login flaked for operators; OAuth prod redirects incomplete; recovery paths uneven.

## Current baseline (read before coding)

Auth routes for login, google, magic link, reset; dashboard gui-wire-2 login hardening; sw.js shell isolation.

## Required deliverables

1. `docs/oauth-google-setup.md` + SoT checklist rows for Clinicom dashboard callback URLs (localhost + prod).
2. Dashboard auth UX: field-level errors, SSO-required branching, magic link demo URL display only in demo_mode.
3. Session revoke + logout-all already exist; ensure discoverable.
4. Optional backup codes for managers if TOTP not present: if too large, ship "recovery email magic link" polish only and document TOTP as future.
5. Health/status card: Google SSO configured boolean already in auth config; expose failure reasons safely.

## Architecture / design constraints

Keep JWT session model; do not invent a second auth system.

## Implementation notes (advanced)

Reconfirm SW never intercepts /api/auth/*. Add dashboard boot logs only in demo.

## Files to create or change

auth.py (minor), dashboard app.js, oauth docs, tests for magic consume + login errors

## Data model and API sketch

Existing auth endpoints; add GET /api/auth/diagnostics (manager) returning config booleans without secrets.

## UI / UX requirements

Login error visually persistent; signing-in button state kept.

## Safety, privacy, and trust requirements

Do not leak whether email exists beyond existing product policy; rate limit remains.

## Acceptance criteria

Documented redirects list; magic link happy path; SSO-required org shows Google path; password login error text visible.

## Tests and validation

Auth login failure message; magic link consume; diagnostics authz.

## Demo / sales / awards proof

Wrong password shows error; correct login enters overview; show diagnostics.

## Out of scope for this prompt

Full enterprise SAML (see N deferred A14); hardware WebAuthn.

## Related prompts

- Complements `m19-google-oauth-redirects-sot.md`. Do not duplicate secrets.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W09`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
