# Deferred: External DTAC / DCB0129 Audit Engagement Pack

**Roadmap tier:** Deferred (owner)
**Prompt ID:** D03
**Priority:** P0 when unblocked
**Depends on:** W01 internal pack; owner selects auditor
**Target time:** Owner + vendor schedule; eng support 10-20h
**Primary paths:** `docs/compliance/, W01 outputs`
**Plan source:** Award-winning advice plan (Defer A07 / phase 34 external audit)

## Strategic intent

Support external audit with evidence drops, question log, and remediation tickets wired to control registry.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Billing SoT in `.access/.stripe-credentials-and-price-id.md`; never invent prices; never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- No nested `carina/verlox/`.
- Claim firewall honesty required.
- This folder amplifies strengths already shipped; do not rebuild from scratch.

## Problem this prompt solves

External audit cannot be coded into existence.

## Current baseline (read before coding)

W01 pack; hazard docs.

## Required deliverables

1. Auditor Q&A tracker markdown/DB.
2. Remediation issue template linking control_id.
3. Status page: audit engagement state.
4. Eng checklist for evidence refresh.

## Architecture / design constraints

Process + light tooling.

## Implementation notes (advanced)

No fake 'certified' badge.

## Files to create or change

docs/compliance/audit-engagement.md, optional API, dashboard status

## Data model and API sketch

Optional audit status

## UI / UX requirements

Trust page engagement state

## Safety, privacy, and trust requirements

Honesty on status enums.

## Acceptance criteria

Status enum draft|engaged|remediating|certified_external only advances with owner confirmation file.

## Tests and validation

Status gate test.

## Demo / sales / awards proof

Show engagement tracker template.

## Out of scope for this prompt

Paying the auditor / signing certificates.

## Related prompts

`a07-dcb0129-0160-external-audit-dtac.md`, phase `34-full-clinical-safety-case-and-external-audit.md`

## Handoff

Update `07-award-winning/README.md` for `D03`; note flags, and a 90-second demo beat.
