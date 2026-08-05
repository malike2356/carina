# Google OAuth Redirects + Clinicom Stripe SoT Entry

**Roadmap tier:** Must have
**Prompt ID:** M19
**Priority:** P0
**Depends on:** M06
**Target time:** 3-5h
**Primary paths:** `.access/, docs/`
**Outline coverage:** Must: OAuth redirects + Stripe SoT entry

## Strategic intent

Complete ecosystem must-haves outside app tree.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai` (`app/`, `web/`, `web/dashboard/`, `03-marketing-site/`, `sidecar/`).
- AI sidecars: Keprix and Carina via identical `/clinicom/tools/*` contract; local clone is for continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md` (never invent Stripe prices without owner ask; document Clinicom entries there when created).
- Google OAuth: platform client in `.access/.verlox-platform-google-oauth.md`.
- Writing style: no em dashes, no en dashes, no emojis in code, docs, or UI copy.
- Do not recreate nested `carina/verlox/` trees.

## Problem this prompt solves

OAuth/SoT gaps block real login and finance.

## Required deliverables

- Redirect URI checklist
- Callback path docs
- Clinicom SoT section stub
- SSO configured indicator

## Implementation notes

- No invented price IDs
- No committed secrets

## Files to create or change

- docs/oauth-google-setup.md
- docs/stripe-clinicom-sot-checklist.md

## Acceptance criteria

1. Docs list exact URIs
2. SoT checklist owner-ready

## Tests and validation

- Doc review

## Demo / sales proof

Show SSO configured state.

## Out of scope for this prompt

NHS CIS SSO.

## Handoff

When done: update `02-prompts/pending-prompts/06-hci-full-roadmap/README.md` status for `M19`, note env vars added, and list any owner decisions still blocking (Stripe price creation, DNS, OAuth redirect registration).
