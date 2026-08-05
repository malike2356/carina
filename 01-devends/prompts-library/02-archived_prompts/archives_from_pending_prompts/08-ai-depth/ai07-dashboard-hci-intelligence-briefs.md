# Dashboard HCI Intelligence Briefs

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Should (AI depth)  
**Prompt ID:** AI07  
**Priority:** P1  
**Depends on:** AI04, AI06  
**Target time:** 10-16h  
**Primary paths:** `web/dashboard/`, `app/api/`, docs  
**Plan source:** Phase 08 AI depth

## Strategic intent

Show practice managers what deep AI is doing for the clinic: language mix, safety load, teach-back completion, sidecar honesty, without free-form medical advice chat.

## Context (do not skip)

- Dashboard overview already has team activity / next actions.
- Ask Clinicom FAQ help stays grounded separately.
- Writing style / claim firewall apply.

## Problem this prompt solves

Deep AI value is invisible to buyers who live in the dashboard, not the encounter.

## Current baseline (read before coding)

- Overview activity feed, analytics, HCI panels if present
- Session digests from AI06
- Provider health latency badge

## Required deliverables

1. Manager-only **Intelligence** strip or section on Overview/Analytics:
   - Sessions with deep assists used
   - Safety flags awaiting ack
   - Teach-back average score (illustrative, labelled)
   - Sidecar profile + % non-stub sources (honesty)
2. Optional “Brief this week” generated from org-scoped aggregates + session digests via `session_digest` / specialty simplify (not open chat).
3. Explicit non-claim: “Operational brief, not clinical advice.”
4. Links into sessions needing attention.

## Architecture / design constraints

- Aggregates only; no cross-org leakage.
- No auto outreach messages.
- If deep_ai disabled, section collapses to provider health only.

## Acceptance criteria

1. Riverside manager sees non-empty intelligence strip after sample encounters with deep_ai on.
2. Readonly auditor can view; clinician sees limited or none per roles.md update.
3. Claim-firewall passes on new copy.

## Demo / sales / awards proof

Dashboard Overview → Intelligence → click into safety-flagged session.

## Out of scope

Aiva nurse manager employee automation (N11); PCN rollup (N09).

## Related prompts

W08 pilot outcomes, N09 PCN rollup, AMP06 riverside spine.

## Handoff

Mark AI07 done; update FAQ entry for “intelligence brief”.
