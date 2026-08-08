# DCB0129 + DCB0160 External Audit + DTAC

**Roadmap tier:** Advanced to have
**Prompt ID:** A07
**Priority:** P2
**Depends on:** F07
**Target time:** multi-week
**Primary paths:** `docs/compliance/`
**Outline coverage:** Advanced: Full clinical safety + DTAC

## Strategic intent

Audit-grade safety case and DTAC evidence.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

Procurement requires it.

## Required deliverables

- Complete safety case
- External audit engagement checklist
- DTAC evidence binder structure
- Hazard controls linked to releases

## Implementation notes

- Mostly process + evidence; product hooks from F07/A08

## Files to create or change

- docs/compliance/dtac/

## Acceptance criteria

1. Binder completeness checklist green

## Tests and validation

- External review

## Demo / sales proof

Show binder index to Trust.

## Out of scope for this prompt

Post-market surveillance ops.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A07`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
