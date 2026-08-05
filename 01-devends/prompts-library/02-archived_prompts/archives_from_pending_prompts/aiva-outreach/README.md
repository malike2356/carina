# Phase 09: Outreach Funnel for Leads

**Status:** O01-O06 shipped in product (2026-08-04); O07 still optional  
**Date:** 2026-08-04  
**Archive:** `02-archived_prompts/archives_from_pending_prompts/09-outreach-funnel/`  
**Goal:** Build an end to end outreach funnel so Aiva and Clinicom can intake leads, run sequences, detect replies, book calls, remind prospects, and track the whole pipeline from one place.

## Product surface

Canonical UI: `/aiva/outreach` (Hire Aiva admin + Carina Cloud shared app).
YouTube Channel is nested at `/aiva/outreach/channels/youtube`.

## Execution order

| ID | Prompt | Theme | Priority | Status |
|---|---|---|---|---|
| O01 | Lead intake, campaign, and pipeline model | Data | P0 | Done |
| O02 | Outreach sequence engine (Soft Wall) | Automation | P0 | Done |
| O03 | Reply router and interest detection | Inbound | P0 | Done (`/aiva/outreach/replies`) |
| O04 | Booking and calendar integration | Booking | P0 | Done (`/aiva/outreach/bookings`; local slots + busy window hook) |
| O05 | Reminder and follow-up scheduler | Lifecycle | P0 | Done (24h / 1h / operator alert) |
| O06 | Kanban board and lead timeline UI | Ops UI | P0 | Done (filters + quick actions + summary) |
| O07 | Post-call handoff and fulfillment trigger | Handoff | P1 | Pending |

## Handoff rule

1. Keep the funnel state auditable on lead timeline.
2. Soft Wall before any outbound email send.
3. Google free/busy can be passed via `busyWindows` on booking APIs without redesign.
