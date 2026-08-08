# Deferred: Live Enterprise SSO Federation (SAML/OIDC IdP)

**Roadmap tier:** Deferred (contract)
**Prompt ID:** D04
**Priority:** P1 when unblocked
**Depends on:** Customer IdP metadata
**Target time:** 16-30h
**Primary paths:** `app/api/auth*, docs/`
**Plan source:** Award-winning advice plan (Defer enterprise SSO; pending A14 / phase 33)

## Strategic intent

Complete enterprise SSO beyond Google: SAML/OIDC federation with org-level IdP metadata and enforced SSO.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

Scaffold without customer IdP is incomplete.

## Current baseline (read before coding)

SSO scaffolding; Google OAuth.

## Required deliverables

1. IdP metadata upload.
2. ACS endpoints.
3. Enforce SSO org setting interactions with W09.
4. Broken SSO recovery admin path.

## Architecture / design constraints

Use proven library; store metadata encrypted.

## Implementation notes (advanced)

Keep Google path.

## Files to create or change

auth federation modules, dashboard settings, tests

## Data model and API sketch

IdP CRUD; ACS

## UI / UX requirements

Settings enterprise SSO

## Safety, privacy, and trust requirements

Prevent lockout: break-glass manager codes/magic documented.

## Acceptance criteria

With fixture IdP metadata, SSO login works in test harness; lockout recovery documented.

## Tests and validation

Metadata validation; ACS fixture.

## Demo / sales / awards proof

Fixture IdP login in staging.

## Out of scope for this prompt

Configuring customer IdPs live without owner.

## Related prompts

`a14-enterprise-sso-federation.md`, phase 33

## Handoff

Update `07-award-winning/README.md` for `D04`; note flags, and a 90-second demo beat.
