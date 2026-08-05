# Award Film + Site Media Pipeline

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N14
**Priority:** P2
**Depends on:** None
**Target time:** 8-14h engineering (+ production shoot outside)
**Primary paths:** `03-marketing-site/media/, docs/, scripts/`
**Plan source:** Award-winning advice plan (Nice #14 + Days 61-90 film)

## Strategic intent

Create an engineering pipeline and page slots for a 90-second award film and clinic-night stills, with captions, transcripts, and claim-safe titles, so media can drop in without redesign.

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

Demo script exists; media pipeline and placement lag.

## Current baseline (read before coding)

Marketing media folder, riverside case study, sales demo script.

## Required deliverables

1. `docs/gtm/award-film-brief.md` shot list + honesty constraints.
2. Media naming conventions + poster images placeholders.
3. Case study / home embedding components for video with transcript.
4. Script to optimize/compress media metadata checks.
5. Accessibility: captions track support.

## Architecture / design constraints

Static media under site-assets; no autoplay with sound.

## Implementation notes (advanced)

Do not fabricate patient footage; use licensed stock or staged consenting actors noted in brief.

## Files to create or change

brief, marketing html/css/js hooks, placeholders, media readme

## Data model and API sketch

N/A

## UI / UX requirements

Video with captions; reduced-motion respects prefers-reduced-motion (poster only).

## Safety, privacy, and trust requirements

No real patient PHI in media; consent checklist in brief.

## Acceptance criteria

Page renders video element with captions track; brief published; reduced-motion safe.

## Tests and validation

HTML contains track; writing-style on brief.

## Demo / sales / awards proof

Open case study film section with captions.

## Out of scope for this prompt

Actually filming (owner/production). Engineering stops at pipeline + placeholders.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N14`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
