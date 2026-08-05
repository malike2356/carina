# Indoor Wayfinding Moments + Easy Read Continuity

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N04
**Priority:** P2
**Depends on:** Archived indoor wayfinding prompts / nav APIs if present
**Target time:** 10-16h
**Primary paths:** `web/, app/api/nav*, docs/, tests/`
**Plan source:** Award-winning advice plan (Nice #4)

## Strategic intent

Connect wayfinding directions to Easy Read symbol packs and encounter discharge: "how to get to phlebotomy" as accessible steps.

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

Wayfinding and Easy Read are separate toys unless chained.

## Current baseline (read before coding)

Search for nav directions APIs/tests (test_nav_directions.py).

## Required deliverables

1. Wayfinding moment object: steps[], symbols[], map hint, language.
2. Interpreter action: Insert wayfinding into composer / Easy Read pack.
3. Seed Riverside map moments (blood test, pharmacy, exit).
4. Printable patient sheet.

## Architecture / design constraints

Content fixtures + API; no dependency on live indoor SDK unless already present.

## Implementation notes (advanced)

Keep non-certification honesty if using demo maps.

## Files to create or change

fixtures, API, Easy Read integration, UI, tests

## Data model and API sketch

GET /api/nav/moments; GET /api/nav/moments/:id

## UI / UX requirements

Browse moments; insert; print.

## Safety, privacy, and trust requirements

Directions are assistive, not evacuation-critical unless labeled and reviewed.

## Acceptance criteria

Insert blood-test moment into Easy Read pack preview.

## Tests and validation

API list; pack includes symbols.

## Demo / sales / awards proof

After discharge advice, add wayfinding sheet.

## Out of scope for this prompt

Bluetooth beacon hardware.

## Related prompts

Extend archived A09 indoor wayfinding; bind to Easy Read.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N04`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
