# Keprix Deep Tool Handlers (Real AI)

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI02  
**Priority:** P0  
**Depends on:** AI01  
**Target time:** 16-28h  
**Primary paths:** `keprix/domain-packs/clinicom/`, optional `keprix/apps/ml-service/`, tests  
**Plan source:** Phase 08 AI depth

## Strategic intent

Put real clinical AI depth into the Keprix Clinicom pack so Clinicom inherits platform power by calling tools, not by rewriting an LLM stack inside Clinicom.

## Context (do not skip)

- Product north star: HCI, not generic translation.
- Canonical Clinicom app: `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Keprix pack: `/opt/lampp/htdocs/verlox/keprix/domain-packs/clinicom/`.
- Start sidecar: `bash clinicom-ai/scripts/start-keprix-clinicom-sidecar.sh`.
- Prefer `KEPRIX_ML_SERVICE_URL` when available; else Gemini via `.access` keys loaded by start script (never commit keys).
- Writing style: no em/en dashes, no emojis.
- Claim firewall applies to outputs shown in product/docs.
- Never recreate nested carina trees.

## Problem this prompt solves

v2 tools exist on paper while handlers still stub or only cover translate/simplify. Clinicom cannot feel more powerful than a thin translator until Keprix handlers produce genuine clinical assists with honest `source` labels.

## Current baseline (read before coding)

- `keprix/domain-packs/clinicom/tools/handlers.py` (already has ML then Gemini then stub for core four)
- AI01 schemas and capabilities route
- Riverside Adaeze fixtures / demo scripts

## Required deliverables

1. Implement v2 handlers on Keprix pack with order: ML service → Gemini → labelled stub:
   - `clinicom_cultural_adapt`
   - `clinicom_teachback_score`
   - `clinicom_safety_triage_assist`
   - `clinicom_session_digest`
   - `clinicom_specialty_simplify`
   - `clinicom_confidence_explain`
2. Strengthen core four so text turns prefer Gemini/ML and never silently pretend stub is live.
3. Capabilities endpoint marks each tool `live` only when non-stub source returned in last smoke or health probe; otherwise `stub`.
4. Pack tests for each handler with fixture text (Yoruba/Arabic/Punjabi samples allowed as latin/UTF fixtures).
5. README update for tool table + env vars.

## Architecture / design constraints

- Handlers return JSON strings for registry dispatch (existing pattern).
- Safety assist must never auto-acknowledge or call emergency services.
- Teach-back score is assistive; clinician remains author.
- Cultural adapt returns candidates + rationale; does not rewrite the clinical record silently.
- Session digest is short (bounded tokens) and includes disclaimer field.

## Implementation notes (advanced)

- Reuse `_gemini_generate` / `_post_ml` helpers; extract shared prompt templates under `tools/prompts.py`.
- Structured JSON-only Gemini responses with parse+fallback.
- Add `source`: `keprix-ml-service` | `keprix-gemini` | `keprix-clinicom-stub`.
- Hard timeout budgets per tool (translate/simplify can be slower; digest must be fast).

## Files to create or change

- `keprix/domain-packs/clinicom/tools/handlers.py`
- `keprix/domain-packs/clinicom/tools/prompts.py` (create)
- `keprix/domain-packs/clinicom/tools/register.py`
- `keprix/domain-packs/clinicom/http_app.py`
- `keprix/domain-packs/clinicom/tests/test_clinicom_deep_tools.py` (create)
- `keprix/domain-packs/clinicom/README.md`

## Acceptance criteria

1. `POST /clinicom/tools/translate` with Yoruba sample returns `source` not ending in `stub` when Gemini key present.
2. Each v2 tool returns schema-valid JSON and honest source.
3. Pytest pack suite green offline (stubs) and optional live mark for Gemini.
4. Capabilities lists new tools.

## Tests and validation

- Unit handlers with mocked Gemini/ML.
- Golden string tests: stub path still works without keys.
- No secrets in logs.

## Demo / sales / awards proof

Run sidecar → curl teachback_score and cultural_adapt on Adaeze-like text → show non-stub source.

## Out of scope

Clinicom UI wiring (AI05); Carina parity (AI03); billing entitlements (AI09).

## Related prompts

AI01, AI04, N01, N06, N12.

## Handoff

1. Mark AI02 done in README.
2. Document env needed for live source badges.
3. Three-minute curl demo steps.
4. Claim-firewall if README overclaims.
