# Enterprise SSO Federation Across Trusts

**Roadmap tier:** Advanced to have
**Prompt ID:** A14
**Priority:** P2
**Depends on:** A05 P02
**Target time:** 16-24h
**Primary paths:** `app/api/auth`
**Outline coverage:** Advanced: Enterprise SSO federation

## Strategic intent

Cross-Trust identity + JIT provisioning.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

ICS/multi-Trust buyers.

## Required deliverables

- SAML/OIDC federation design
- JIT user provision
- Org mapping

## Implementation notes

- Sandbox first

## Files to create or change

- docs/federation.md
- app/api/federation.py

## Acceptance criteria

1. JIT creates clinician on first login in sandbox

## Tests and validation

- Integration test if IdP available

## Demo / sales proof

Architecture + sandbox login.

## Out of scope for this prompt

National identity providers beyond CIS.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A14`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
