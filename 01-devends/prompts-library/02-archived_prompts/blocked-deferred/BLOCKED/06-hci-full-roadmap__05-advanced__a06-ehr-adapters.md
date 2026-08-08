# EHR Adapters Epic Cerner Spine-shaped

**Roadmap tier:** Advanced to have
**Prompt ID:** A06
**Priority:** P2
**Depends on:** A04
**Target time:** 16-24h
**Primary paths:** `app/integrations/fhir/adapters/`
**Outline coverage:** Advanced: EHR adapters

## Strategic intent

Adapter pattern per EHR.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

One FHIR client insufficient.

## Required deliverables

- Adapter interface
- Epic/Cerner/Spine-shaped stubs
- Config per org

## Implementation notes

- Start with stubs + one real sandbox if available

## Files to create or change

- app/integrations/fhir/adapters/

## Acceptance criteria

1. Adapter selectable per org

## Tests and validation

- Interface tests

## Demo / sales proof

Switch adapter in settings.

## Out of scope for this prompt

Certified EHR partner program.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A06`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
