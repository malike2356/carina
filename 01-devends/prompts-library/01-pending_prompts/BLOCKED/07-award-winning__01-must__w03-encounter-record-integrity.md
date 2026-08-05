# Encounter Record Integrity (Hydration, Titles, Facts, Flags)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W03
**Priority:** P0
**Depends on:** Recent gui-clinical handoff parsing work (extend, do not regress)
**Target time:** 12-18h
**Primary paths:** `web/js/app.js, web/, app/api/sessions*, app/services/, tests/`
**Plan source:** Award-winning advice plan (Must #3)

## Strategic intent

Make every loaded encounter clinically coherent: short title, structured facts, safety counts, timeline messages or a true handoff card, never an empty shell with a prose nuke in the H1.

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

Loaded sessions can show 0 messages, blob titles, and mismatched session ids while dumping AI summary text into chrome and recent lists. That breaks clinician trust instantly.

## Current baseline (read before coding)

- Review `web/js/app.js` parseHandoffSummary, updateCaseChrome, renderTimelineFromServer, bootstrapDemo, localStorage session id behavior.
- Trace API `getSessionTimeline` and how `summary` is written on session create/handoff.
- Reproduce with seeded Adaeze case and blank sessions.

## Required deliverables

1. Canonical **EncounterViewModel** on client (and optionally server DTO) with: id, short_title, lede, languages, message_count, safety_count, confidence, facts[], cultural[], safety[], timeline_items[], hydration_state.
2. Server endpoint or enriched timeline payload that returns structured handoff sections when messages empty but summary exists.
3. Closing the loop: when handoff is generated, persist structured JSON alongside plain summary.
4. Recent cases list always uses short_title (<=96 chars).
5. If localStorage points at orphan/empty id, offer recover featured case without silent mismatch.
6. Regression tests for blob vs short title and empty+summary hydration.

## Architecture / design constraints

- Prefer server-side structured summary (`handoff_json`) so all clients (PWA, dashboard, embed) share truth.
- Keep backward compatibility: parse legacy prose blobs when handoff_json missing.
- Timeline empty states: `hydrated_handoff | empty_new | error`.

## Implementation notes (advanced)

- Add DB column or JSON field if migrations pattern exists; else store in existing summary with a prefix marker only as last resort (prefer real JSON column).
- Unify title helper server-side for dashboard session lists too.
- Fix session pill vs lede mismatches.
- Ensure stat tiles reflect parsed or event-based safety counts consistently.

## Files to create or change

- `app/db/models.py` + migration if needed
- session/handoff API modules
- `web/js/app.js`, possibly dashboard sessions view
- `tests/test_encounter_integrity.py`

## Data model and API sketch

```
GET /api/sessions/:id/timeline -> includes session.handoff { title, patient[], clinician[], safety[], cultural[], created_at }
POST /api/sessions/:id/handoff -> writes handoff_json + prose
```

## UI / UX requirements

- H1 shows short_title only.
- Facts rail from structured bullets.
- Timeline shows handoff card when no turns.
- Visual hydration chip: "Handoff only" vs "Live turns".

## Safety, privacy, and trust requirements

Do not auto-promote AI summary into clinical record without clinician review label.

## Acceptance criteria

1. Fixture blob never appears in H1 or recent strong text.
2. Featured empty-message session shows structured handoff card.
3. Message/safety stats match visible content rules.
4. Dashboard sessions list truncates titles.

## Tests and validation

Parser unit tests (line + inline bullets); API fixture; Playwright optional smoke.

## Demo / sales / awards proof

Load demo case with only handoff -> show tidy title + card; send a turn -> stats update.

## Out of scope for this prompt

Full EHR writeback; rewriting the entire interpret pipeline.

## Related prompts

- Builds on short title / handoff card work already shipped in interpreter UI.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W03`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
