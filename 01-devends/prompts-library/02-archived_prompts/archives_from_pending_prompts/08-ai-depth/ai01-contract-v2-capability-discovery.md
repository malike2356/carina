# Contract v2 + Capability Discovery

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI01  
**Priority:** P0  
**Depends on:** none  
**Target time:** 10-16h  
**Primary paths:** `docs/sidecar-production.md`, `clinicom-ai/app/ai_provider/`, `keprix/domain-packs/clinicom/`, `carina/.../packs/clinicom/`, `tests/`  
**Plan source:** Phase 08 AI depth

## Strategic intent

Replace the implicit four-tool sidecar assumption with a versioned, discoverable Clinicom AI contract so Clinicom can consume deeper platform skills without forking providers per host.

## Context (do not skip)

- Product north star: Healthcare Communication Intelligence (HCI), not generic translation.
- Canonical app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Local run: `python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8600`.
- AI sidecars: Keprix first, Carina switchable, local-clone continuity only.
- Billing SoT: `/opt/lampp/htdocs/verlox/.access/.stripe-credentials-and-price-id.md`. Never invent prices. Never paste secrets.
- Writing style: no em dashes, no en dashes, no emojis.
- Never recreate nested `carina/verlox/` trees.
- Claim firewall: never imply certified BSL, live FHIR, live CIS, or completed DTAC/DCB unless true.
- Prefer extending existing contract over parallel private APIs.
- Demo clinic: Riverside Family Practice.

## Problem this prompt solves

Clinicom only knows four tools. Deeper AI cannot land cleanly because there is no capability discovery, version negotiation, or shared schema pack for new tools.

## Current baseline (read before coding)

- `docs/sidecar-production.md`
- `app/ai_provider/base.py`
- `keprix/domain-packs/clinicom/http_app.py` + `tools/handlers.py`
- Carina `packages/packs/clinicom` handlers
- Existing smoke: `scripts/smoke-sidecar.sh`

## Required deliverables

1. **Contract v2 spec** in `docs/ai-contract-v2.md`:
   - Auth header rules
   - Error envelope
   - Tool list (v1 retained + v2 additions as optional)
   - Idempotency / timeout expectations
2. **`GET /clinicom/capabilities`** on Keprix and local-clone sidecars (Carina parity may stub until AI03):
   - `contract_version`
   - `tools[]` with `{name, status: live|stub|disabled, latency_class, requires_auth}`
   - `provider_sources` honesty (e.g. keprix-gemini, keprix-ml-service, stub)
3. Clinicom app: on boot / settings refresh, fetch capabilities and store in runtime settings (no crash if missing; assume v1).
4. Shared JSON schemas for new tool payloads (even if handlers return stub until AI02).
5. Update smoke script to assert capabilities endpoint when profile supports it.

## Architecture / design constraints

- v1 tools must keep working unchanged (`transcribe`, `translate`, `simplify`, `speak`).
- New tools are optional; Clinicom must degrade gracefully.
- Capabilities response must label stubs honestly (`source` / `status`).
- No proprietary Keprix-only or Carina-only path names in Clinicom app code.

## Implementation notes (advanced)

Proposed optional v2 tools (define schemas here; implement in AI02/AI03):

| Tool | Purpose |
|---|---|
| `clinicom_cultural_adapt` | Cultural note candidates for medication/explanation wording |
| `clinicom_teachback_score` | Score patient teach-back text vs plan |
| `clinicom_safety_triage_assist` | Suggest safety reasons + clinician checklist (not auto-ack) |
| `clinicom_session_digest` | Short session memory digest for next turn |
| `clinicom_specialty_simplify` | Specialty pack plain language (GP/pharmacy/etc.) |
| `clinicom_confidence_explain` | Breakdown of confidence factors for UI |

## Files to create or change

- `docs/ai-contract-v2.md` (create)
- `docs/sidecar-production.md` (update)
- `keprix/domain-packs/clinicom/http_app.py` (capabilities route)
- `clinicom-ai/sidecar/main.py` (capabilities route)
- `app/ai_provider/base.py` + settings (consume capabilities)
- `scripts/smoke-sidecar.sh` (change)
- `tests/test_ai_contract_v2.py` (create)

## Data model and API sketch

```
GET /clinicom/capabilities
-> {
  contract_version: "2.0",
  profile: "keprix",
  tools: [{ name, status, requires_audio?: bool }],
  provider_honesty: { translate: "keprix-gemini"|"stub"|... }
}
```

## Acceptance criteria

1. Smoke against Keprix `:3353` returns capabilities with `contract_version`.
2. Clinicom Settings shows discovered tools without requiring restart crash on older sidecars.
3. v1 interpret path unchanged and green.
4. Spec documents which tools are optional.

## Tests and validation

- Contract schema unit tests.
- Smoke script exit 0 for health + capabilities.
- Claim-firewall still green.

## Demo / sales / awards proof

Settings → Runtime: show profile keprix + tool list with live vs stub badges.

## Out of scope

Implementing deep handler intelligence (AI02), UI (AI05), memory orchestration (AI06).

## Related prompts

AI02-AI09; N01 specialty packs; N06 confidence coaching.

## Handoff

1. Mark AI01 done in `08-ai-depth/README.md`.
2. Note any owner decisions on tool naming.
3. Manual demo steps under 3 minutes.
4. Run claim-firewall if docs claim language changed.
