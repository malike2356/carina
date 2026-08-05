# Session Memory + Encounter Context Pack

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI06  
**Priority:** P0  
**Depends on:** AI04  
**Target time:** 12-18h  
**Primary paths:** `app/lib/`, `app/api/`, `keprix/domain-packs/clinicom/` (`session_digest`), tests  
**Plan source:** Phase 08 AI depth

## Strategic intent

Give interpretation short-horizon memory so later turns know prior language, meds discussed, safety flags, and teach-back gaps, without copying full chat history into every LLM prompt blindly.

## Context (do not skip)

- Memory stays encounter-scoped and org-tenant scoped.
- GDPR erase must scrub digests with messages (extend erase path).
- Writing style / claim firewall / no nested Carina trees.

## Problem this prompt solves

Each turn is mostly stateless to the sidecar. That wastes platform memory capabilities and causes repetitive or context-blind assists.

## Current baseline (read before coding)

- Session logger / messages / events tables
- `clinicom_session_digest` tool schema from AI01/AI02
- Patient erase redaction already expanded for message text

## Required deliverables

1. Build a **context pack** from last N messages + events + active safety state + languages.
2. Send pack into translate/simplify/deep tools as bounded `context` field.
3. Call `clinicom_session_digest` on cadence (every K turns or on handoff open); store digest on session row or event.
4. Context pack redaction rules: drop raw audio; truncate long strings; strip erased markers.
5. Erase patient also clears digests / context caches for linked sessions.

## Architecture / design constraints

- Prefer server-side pack assembly in Clinicom; sidecar digests text, does not own multi-tenant DB.
- Digests are assistive; clinician handoff remains authored.
- Hard size budget (e.g. <= 2-4k chars) for sidecar context.

## Files to create or change

- `app/lib/context_pack.py` (create)
- `app/lib/pipeline.py` / `deep_ai.py`
- `app/db/models.py` + migration if digest column added
- `app/api/patients.py` erase path
- `tests/test_context_pack.py`

## Acceptance criteria

1. Second Adaeze turn receives digest mentioning prior chest pain discussion.
2. Erase redacts stored digests.
3. Capability missing → context pack still ships local summary without deep digest tool.

## Demo / sales / awards proof

Two-turn encounter → open handoff → digest summarizes languages + safety without leaking unrelated patients.

## Out of scope

Long-term cross-encounter patient memory product; Aiva ops memory (N11).

## Related prompts

W03 encounter integrity, AI07 dashboard briefs.

## Handoff

Mark AI06 done; document retention of digests in privacy docs if needed.
