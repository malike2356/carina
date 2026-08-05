# NHS CIS Smartcard SSO + National RBAC

**Roadmap tier:** Advanced to have
**Prompt ID:** A05
**Priority:** P2
**Depends on:** P02
**Target time:** 20-30h
**Primary paths:** `app/api/auth nhs/`
**Outline coverage:** Advanced: NHS CIS SSO

## Strategic intent

Smartcard login + RBAC mapping.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

Trust SSO standard.

## Required deliverables

- CIS integration design + implementation spike to working sandbox
- Map national roles to Clinicom roles
- Fallback docs

## Implementation notes

- Likely partner dependency; document blockers

## Files to create or change

- docs/nhs-cis.md
- app/api/nhs_cis.py

## Acceptance criteria

1. Sandbox login path documented/working

## Tests and validation

- Contract tests if sandbox available

## Demo / sales proof

Architecture walkthrough.

## Out of scope for this prompt

Production CIS accreditation.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A05`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
