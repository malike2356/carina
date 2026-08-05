# Eval Harness, Golden Transcripts, Honesty

**Roadmap tier:** Must (AI depth)  
**Prompt ID:** AI08  
**Priority:** P0  
**Depends on:** AI02, AI04  
**Target time:** 12-18h  
**Primary paths:** `tests/`, `docs/`, `scripts/`, claim firewall  
**Plan source:** Phase 08 AI depth

## Strategic intent

Prove deep AI is better than stubs with measurable checks, and prevent sales language from overclaiming platform depth.

## Context (do not skip)

- Claim firewall is mandatory.
- Golden transcript sandbox prompt N10 exists; extend rather than fork if overlap.
- Writing style rules apply.

## Problem this prompt solves

Without evals, “more powerful” is anecdotal. Without honesty updates, FAQ/marketing will lie about AI depth.

## Current baseline (read before coding)

- `scripts/check-claim-firewall.py`
- `docs/help/faq.json` which-llm / sidecar entries
- N10 golden transcript prompt

## Required deliverables

1. Golden transcript fixtures (Adaeze + one Arabic/Punjabi path) with expected:
   - safety flag present/absent
   - translation contains key clinical fact
   - source not stub when live env marked
2. `scripts/eval-clinicom-ai-depth.sh` (or pytest marker `deep_ai_live`) runnable locally.
3. CI-safe stub mode tests always green without Gemini keys.
4. Update claim firewall rules:
   - Ban “full Carina brain inside Clinicom”
   - Ban “powered by Carina” when profile is keprix
   - Allow “uses Keprix/Carina Clinicom sidecar tools” when true
5. FAQ + status page honesty for live vs stub sources.

## Acceptance criteria

1. Stub suite green in CI.
2. Live eval documents pass/fail clearly when keys present.
3. Firewall catches overclaim strings in marketing/help.

## Demo / sales / awards proof

Show eval summary table: stub baseline vs live Gemini translation quality on Adaeze line.

## Out of scope

Training custom models from scratch (A11/N12 remain separate).

## Related prompts

N10, N12, W10, AI02.

## Handoff

Mark AI08 done; paste eval command into Phase 08 README.
