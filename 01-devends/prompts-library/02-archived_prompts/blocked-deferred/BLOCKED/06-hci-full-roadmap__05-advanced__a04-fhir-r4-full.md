# FHIR R4 Full Read/Write

**Roadmap tier:** Advanced to have
**Prompt ID:** A04
**Priority:** P2
**Depends on:** P05
**Target time:** 16-24h
**Primary paths:** `app/integrations/fhir/`
**Outline coverage:** Advanced: FHIR R4 full

## Strategic intent

Patient/Encounter/Appointment read + Communication write.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

Interop requirement for Trusts.

## Required deliverables

- Read adapters
- Write Communication/DocumentReference
- OAuth client credentials
- Org config UI

## Implementation notes

- fhirclient or lightweight HTTP

## Files to create or change

- app/integrations/fhir/

## Acceptance criteria

1. Round-trip against test server

## Tests and validation

- Integration tests

## Demo / sales proof

Lookup patient; write communication.

## Out of scope for this prompt

Epic/Cerner specifics.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A04`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
