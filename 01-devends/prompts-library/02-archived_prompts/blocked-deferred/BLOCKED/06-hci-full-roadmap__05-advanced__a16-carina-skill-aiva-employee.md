# Clinicom as Carina Skill / Aiva Employee

**Roadmap tier:** Advanced to have
**Prompt ID:** A16
**Priority:** P2
**Depends on:** F13
**Target time:** 12-20h
**Primary paths:** `carina canonical paths`
**Outline coverage:** Advanced: Carina skill / Aiva employee

## Strategic intent

Async HCI employee on Carina/Aiva.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

Verlox ecosystem leverage.

## Required deliverables

- Skill/tool registration in Carina
- Aiva employee persona for communication
- Clinicom API consumption
- Soft separation respected

## Implementation notes

- Use shared/workspace-governance/CARINA-AIVA-SOFT-SEPARATION.md
- No nested carina/verlox

## Files to create or change

- docs/ecosystem/aiva-clinicom-employee.md

## Acceptance criteria

1. Employee can simplify a letter via Clinicom contract

## Tests and validation

- Staging smoke

## Demo / sales proof

Ask Aiva to simplify clinic SMS.

## Out of scope for this prompt

Multi-employee orchestration.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `A16`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
