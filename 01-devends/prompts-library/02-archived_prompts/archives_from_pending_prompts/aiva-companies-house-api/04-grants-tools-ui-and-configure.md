# 04: Grants, Tools UI, and configure

**Status: COMPLETED 2026-08-04**
**What was built:**
- Catalog, grants, configure domain, CTAs, cloud Guide Me, OPS `/companies-house`.
**Priority:** P0
**Depends on:** 02, 03
**Unlocks:** 05, outreach 14

## Goal

Operators can enable Companies House for a worker like other Tools; users get connect/configure CTAs when the key is missing; optional BYOK later.

## Requirements

1. Add tool slug `companies-house` (or per-tool grants if that is the existing pattern) to:
   - Tool surface catalog / inventory
   - Risk registry (read-only; not dangerous for search/get; enrich batches stay rate-limited)
   - Session tool resolution for Aiva workers
2. Cloud Tools page entry: `/aiva/tools?tool=companies-house` (or under Integrations) with short copy + link to Developer Hub for platform ops.
3. Platform default: use env `COMPANIES_HOUSE_API_KEY` when set (Hire Aiva / Carina shared key for trials).
4. Optional P1 BYOK: workspace/settings via `configure` domain `integration:companies-house` (mirror Notion pattern in `configure-tool.ts`) with test action `GET /company/00000006` or similar smoke number.
5. Conversational integration setup: extend `conversational-integration-setup.ts` for companies house intents when unavailable.
6. Empty-reply / intent fallback: companies house / "UK company register" asks must not hit Unable / fake greeting.
7. Persona / platform knowledge: update brief note that Aiva can query Companies House via tools (not "go check the website yourself" as the only answer when the integration is live).
8. Docs: Core `docs/` short page linking to official hub.

## Acceptance criteria

- [ ] Granted worker sees CH tools in session; ungranted worker does not.
- [ ] Missing platform key: user told how ops enables it (or BYOK if shipped).
- [ ] Tools URL appears in conversational CTA when applicable.

## Deploy

Core + cloud app for Tools UI.
