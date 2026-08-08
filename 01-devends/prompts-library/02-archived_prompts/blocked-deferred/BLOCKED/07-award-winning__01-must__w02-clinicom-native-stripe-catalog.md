# Clinicom-Native Stripe Catalog + Webhooks (Owner-Gated SoT)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must have (award)
**Prompt ID:** W02
**Priority:** P0
**Depends on:** Owner must approve Clinicom price IDs in SoT before any Stripe price creation
**Target time:** 10-16h
**Primary paths:** `app/api/billing.py, app/lib/plans.py, docs/stripe-*, web/dashboard/, .access/ (labels only)`
**Plan source:** Award-winning advice plan (Must #2; extends HCI M06)

## Strategic intent

Replace interim borrowed Verlox/Scout price identity with Clinicom commercial truth: labeled SoT entries, mapped plans, verified webhooks, invoice history, and demo-safe behavior when keys are absent.

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

Interim shared catalog undermines Trust procurement and finance. Webhooks and invoices may work, but plan identity is borrowed.

## Current baseline (read before coding)

- Read M06, stripe checklist, interim mapping, current `app/lib/plans.py` / billing router.
- Do **not** create Stripe prices in code or tests. If SoT lacks Clinicom rows, implement env override map + honest UI badge `Billing identity: interim`.
- Owner creates prices only after explicit ask; then document IDs/labels (never secrets) in SoT.

## Required deliverables

1. Plan matrix keyed by Clinicom plan_key with fields: price_id, amount_label, interval, entitlements, sot_status (`interim|clinicom_native`).
2. Webhook handler: signature verify, idempotency keys, checkout + subscription + invoice events.
3. Dashboard billing: current plan, upcoming invoice, invoice list, interim warning banner when not native.
4. Docs: update checklist status when SoT becomes clinicom_native.
5. Fake checkout path remains for `STRIPE_SECRET_KEY` absent (demo activation) and is clearly labeled.

## Architecture / design constraints

- Single source adapter `get_price_id(plan_key)` reading env overrides -> SoT file parse (if safe) -> interim map.
- Never parse secret keys from SoT into logs.
- Webhook idempotency table or unique constraint on event id.

## Implementation notes (advanced)

- Prefer completing M06 acceptance criteria rather than forking a second billing stack.
- Add structured logging for billing events without cardholder data.
- Test with Stripe CLI fixtures where available; otherwise recorded payload fixtures.
- If owner has not created prices: ship code paths + interim badge + checklist TODOs only.

## Files to create or change

- `app/lib/plans.py`
- `app/api/billing.py`
- `web/dashboard/` billing views
- `docs/stripe-clinicom-sot-checklist.md`
- `tests/test_billing_*.py`

## Data model and API sketch

```
POST /api/billing/checkout { plan_key }
POST /api/billing/webhooks/stripe  (raw body + signature)
GET  /api/billing/invoices
GET  /api/billing/catalog          -> plans with sot_status
```

## UI / UX requirements

- Billing page shows sot_status chip.
- Interim: amber notice "Using interim shared catalog until Clinicom Stripe prices are assigned".
- Native: remove amber; show Clinicom price labels only (amounts if already public in SoT).

## Safety, privacy, and trust requirements

- No secrets in UI or logs.
- PCI: do not touch raw PANs; Stripe-hosted checkout only.
- Audit `billing.checkout`, `billing.webhook_applied`.

## Acceptance criteria

1. Bad webhook signature -> 400/401.
2. Duplicate event id does not double-apply entitlement.
3. Catalog endpoint reports sot_status accurately.
4. No new Stripe prices created by agent/tests without owner ask.

## Tests and validation

Webhook signature unit tests; entitlement apply idempotency; catalog status tests.

## Demo / sales / awards proof

Billing page in demo mode shows interim badge OR native plan mapping; trigger test webhook fixture.

## Out of scope for this prompt

Creating live Stripe prices; changing NHS invoicing entities; multi-currency beyond SoT.

## Related prompts

- Extends and may close `06-hci-full-roadmap/01-must/m06-clinicom-stripe-catalog-webhooks.md`.
- Follow `docs/stripe-clinicom-sot-checklist.md` and `docs/stripe-clinicom-interim-mapping.md`.

## Handoff

When done:
1. Update `02-prompts/pending-prompts/07-award-winning/README.md` status for `W02`.
2. Note env vars, feature flags, migrations, and any owner decisions still blocking.
3. List manual demo steps that prove this item in under 3 minutes.
4. If claim language changed, run a claim-firewall grep across `web/`, `03-marketing-site/`, and `docs/`.
