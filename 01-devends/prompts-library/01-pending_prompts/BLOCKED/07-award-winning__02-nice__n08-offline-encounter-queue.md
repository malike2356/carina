# Offline Encounter Queue (PWA Store and Forward)

**Roadmap tier:** Nice to have (award)
**Prompt ID:** N08
**Priority:** P1
**Depends on:** SW shell isolation fix must remain intact (do not re-break dashboard/API)
**Target time:** 14-20h
**Primary paths:** `web/sw.js, web/js/, app/api/, tests/`
**Plan source:** Award-winning advice plan (Nice #8)

## Strategic intent

Queue interpret turns when offline and sync when online with conflict rules, without SW intercepting dashboard/API broadly.

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

Clinics have dead zones; losing turns is unacceptable.

## Current baseline (read before coding)

Current sw.js v2 shell-only; interpret API.

## Required deliverables

1. IndexedDB queue for outbound turns.
2. Sync manager with retry/backoff.
3. Conflict policy: server wins on ack; mark local duplicate.
4. UI queue badge.
5. SW remains non-intercepting for /api and /dashboard.

## Architecture / design constraints

Queue is app logic, not SW rewriting POSTs. SW only caches /app shell GET.

## Implementation notes (advanced)

Revisit claim: offline audio may be too heavy; allow text turns offline first, audio second if feasible.

## Files to create or change

queue.js, sw.js (careful), UI badge, tests

## Data model and API sketch

Idempotency-Key header on interpret POST

## UI / UX requirements

Offline chip; pending count; fail reasons.

## Safety, privacy, and trust requirements

Do not sync until consent rules still hold; revalidation on sync.

## Acceptance criteria

Go offline -> queue text turn -> online sync -> message appears once; SW still ignores /api/auth/login.

## Tests and validation

Idempotency; queue unit; regression that dashboard assets not claimed wrongly.

## Demo / sales / awards proof

DevTools offline -> send -> online -> appears.

## Out of scope for this prompt

Full CRDT multi-tab editing.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `N08`.
2. Note env vars, feature flags, migrations, and owner blockers.
3. List a under-3-minute demo path.
4. Run claim-firewall / writing-style checks on touched copy.
