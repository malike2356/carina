# Clinicom Provider + Pipeline Consume Contract v2

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI04  
**Priority:** P0  
**Depends on:** AI01, AI02  
**Target time:** 14-22h  
**Primary paths:** `clinicom-ai/app/ai_provider/`, `app/lib/pipeline.py`, `app/api/routes.py`, `tests/`  
**Plan source:** Phase 08 AI depth

## Strategic intent

Teach the Clinicom app to call deep tools behind feature flags and continuity rules, while clinician authorship and safety acknowledgement remain Clinicom-owned.

## Context (do not skip)

- Canonical app under `/opt/lampp/htdocs/verlox/clinicom-ai`.
- Provider chain + fallback policy already exist.
- Writing style / claim firewall / no nested Carina trees / Stripe SoT rules apply.

## Problem this prompt solves

Even with deep handlers available, Clinicom never calls them. Power stays stranded in the sidecar.

## Current baseline (read before coding)

- `app/ai_provider/base.py`, `app/lib/pipeline.py`, interpret route
- Authorship accept/edit/reject
- Safety overlay acknowledge flow

## Required deliverables

1. Extend `ClinicomProvider` with typed methods for each v2 tool; capability-gated.
2. Pipeline hooks:
   - After translate/simplify: optional cultural adapt + confidence explain
   - After teach-back input: teachback_score
   - On safety flag: safety_triage_assist suggestions (UI later)
   - End of turn / handoff: session_digest refresh
3. Feature flags / settings:
   - `deep_ai_enabled` (org or runtime)
   - Per-tool toggles
4. Persist assist outputs as **suggestions** / events, not silent clinical record mutations.
5. Continuity: if tool missing/stub and `sidecar_only`, show labelled degraded note; never invent clinical speech as live.

## Architecture / design constraints

- Safety ack remains a human Clinicom action.
- Working text authorship path unchanged.
- Metering/session logging must capture tool names + sources (redact audio).

## Files to create or change

- `app/ai_provider/base.py`
- `app/lib/pipeline.py`
- `app/lib/deep_ai.py` (create orchestration helpers)
- `app/api/routes.py` (interpret + teachback endpoints)
- `app/lib/feature_flags.py` / settings
- `tests/test_deep_ai_pipeline.py`

## Acceptance criteria

1. Interpret with deep_ai on attaches cultural note candidates when capability live.
2. With capability stub/disabled, interpret still succeeds.
3. Audit/session events record tool + source honesty.
4. No automatic accept of AI draft for new assists.

## Tests and validation

- Provider mocks for capabilities present/absent.
- Pipeline unit tests for degrade paths.
- Claim-firewall green.

## Demo / sales / awards proof

Adaeze sample turn → timeline shows cultural suggestion from keprix-gemini + confidence explain meta.

## Out of scope

Pixel-perfect UI (AI05); dashboard briefs (AI07).

## Related prompts

AI05, AI06, W04 authorship, AMP04 cultural notes.

## Handoff

Mark AI04 done; list flags and default-off vs default-on recommendation for Riverside demo.
