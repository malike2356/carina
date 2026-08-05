# Aiva / Carina: adopt viCal booking

**Updated:** 2026-08-04  
**Status:** NEARLY COMPLETE (10 intake + 11 deposits remain optional)

## Problem

Hire Aiva and Carina Core needed Propreneur-class **viCal** booking on the TS platform, integrated with outreach discovery so there is one slot engine.

## Shipped (archived)

Completed prompts live under:

`../02-archived_prompts/archives_from_pending_prompts/aiva-vical-booking/`

| ID | Prompt | Status |
|---|---|---|
| 00-09 | Domain → public/hub → cutover → sync → reminders/webhooks | COMPLETED 2026-08-04 |
| 12 | Tests, ops runbook, archive checklist | COMPLETED 2026-08-04 (smoke sign-off still open in runbook) |

## Still pending (owner optional)

| ID | Prompt | Status |
|---|---|---|
| 10 | Intake pools + routing | PENDING |
| 11 | Deposits / payments (Stripe from `.access` only; do not create prices) | PENDING until owner green-light |

## Ops

- Runbook: `carina/02-backends/core.carinaai.uk/docs/VICAL-OPS.md`
- Flag: `VICAL_OUTREACH_BACKEND=vical` (default) / `legacy` break-glass
- Nest guard + Core Vitest P0 paths green as of 2026-08-04

## Source boundary

Only `02-backends/`, `03-frontends/`, `scripts/`. Never nest `carina/verlox/`.
