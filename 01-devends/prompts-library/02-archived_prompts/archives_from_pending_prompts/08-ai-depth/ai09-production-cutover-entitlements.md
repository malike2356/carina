# Production Cutover + Entitlements Switchbook

**Status: COMPLETED 2026-08-04**

**What was built:** AI depth switchbook, dashboard deep AI visibility, tool badges, deploy checklist link, and env bootstrap reference.

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI09  
**Priority:** P0  
**Depends on:** AI05, AI08  
**Target time:** 8-14h  
**Primary paths:** `docs/`, `.env.example`, billing/entitlements, runbooks  
**Plan source:** Phase 08 AI depth

## Strategic intent

Ship a repeatable cutover so a paying clinic gets Keprix deep AI by default, Carina remains switchable, and plan tiers gate deep tools honestly.

## Context (do not skip)

- Stripe SoT only; no invented prices.
- Demo mode must not fake paid deep AI in production.
- Keprix first; Carina later as profile switch.

## Problem this prompt solves

Depth work stays a lab demo unless ops, entitlements, and docs make it the default production path.

## Current baseline (read before coding)

- `docs/sidecar-production.md`, `docs/runbook-deploy.md`
- `scripts/start-keprix-clinicom-sidecar.sh`
- Plans Starter / Practice / Trust
- Billing fail-closed when demo off and Stripe missing

## Required deliverables

1. **Switchbook** `docs/ai-depth-cutover.md`:
   - Start Keprix sidecar with Gemini/ML
   - Set Clinicom profile keprix + capabilities check
   - Enable `deep_ai` for Practice/Trust (propose; implement flags)
   - Smoke + eval gates before go-live
   - Rollback to v1-only / stub-labelled continuity
2. Entitlements:
   - Starter: core four tools
   - Practice/Trust: deep tools (configurable)
3. Settings UI: deep AI on/off, tool badges, link to switchbook.
4. Update `.env.example` with required vars (no secrets).
5. Production checklist item in deploy go/no-go docs.

## Architecture / design constraints

- Entitlement denials return clear API errors; UI hides paywalled tools.
- Never show stub as live in production health.
- Carina cutover is documented as optional profile change after parity (AI03).

## Acceptance criteria

1. Fresh env following switchbook reaches non-stub translate on interpret.
2. Starter org cannot call paywalled deep tool (403/entitlement).
3. Rollback steps verified once.

## Demo / sales / awards proof

Show Settings entitlements + live source badge; flip deep_ai off and show graceful hide.

## Out of scope

Creating new Stripe prices; Trust procurement certifications.

## Related prompts

W02 Stripe catalog, AI03 Carina parity, deploy runbook.

## Handoff

AI09 is done; Phase 08 can be called cutover-ready.
