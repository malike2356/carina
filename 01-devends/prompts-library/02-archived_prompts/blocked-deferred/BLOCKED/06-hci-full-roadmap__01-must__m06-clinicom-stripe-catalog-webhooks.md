# Clinicom Stripe Catalog, Webhooks, Invoices

**Roadmap tier:** Must have
**Prompt ID:** M06
**Priority:** P0
**Depends on:** Phase 02 billing
**Target time:** 8-12h
**Primary paths:** `app/api/billing.py, .access/`
**Outline coverage:** Must: Real Stripe Clinicom prices + webhooks + invoices

## Strategic intent

Wire Clinicom commercial truth; stop borrowing unrelated prices.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

Borrowed price IDs confuse finance.

## Required deliverables

- Owner-approved Clinicom price IDs in SoT (create only if owner asks)
- Plan map update
- Webhook signature verification
- Invoice history UI
- Idempotent webhooks

## Implementation notes

- Env overrides until SoT filled
- Never paste secrets
- Handle checkout + subscription + invoice events

## Files to create or change

- app/lib/plans.py
- app/api/billing.py
- web/dashboard/

## Acceptance criteria

1. Bad signature rejected
2. Checkout updates org
3. Invoices list or empty state

## Tests and validation

- Webhook fixture tests

## Demo / sales proof

Billing page in test mode.

## Out of scope for this prompt

Creating prices without owner ask.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `M06`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
