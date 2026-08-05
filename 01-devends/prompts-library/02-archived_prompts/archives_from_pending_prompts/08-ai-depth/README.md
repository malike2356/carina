# Phase 08: Deep AI Platform Depth (Keprix first, Carina switchable)

**Status:** AI01-AI09 archived 2026-08-04 (product path landed).  
**Date:** 2026-08-02  
**Updated:** 2026-08-04  
**Archive:** `02-archived_prompts/archives_from_pending_prompts/08-ai-depth/` (AI01-AI09)  
**Goal:** Make Clinicom consume real platform AI depth from Keprix (now) and Carina (later), without rebuilding those platforms from scratch, and without turning Clinicom into a generic chatbot.

## Why this phase exists

Today Clinicom is a strong clinical product shell that only rents four sidecar tools (`transcribe`, `translate`, `simplify`, `speak`). That is enough for basic interpretation. It is **not** full Keprix or Carina intelligence.

This phase widens the shared `/clinicom/tools/*` contract and wires Clinicom product surfaces to higher-value AI skills that already exist (or should live) inside Keprix/Carina packs: cultural coaching, teach-back scoring assist, safety triage assist, session memory, plain-language specialty packs, and clinician-facing insight briefs.

## Non-goals

- Do not rebuild Carina or Keprix runtimes inside `clinicom-ai/`.
- Do not create nested `carina/verlox/` trees.
- Do not turn Ask Clinicom (FAQ help) into an open medical LLM.
- Do not claim certified BSL, live FHIR, live CIS, or completed DTAC/DCB unless literally true.
- Do not invent Stripe prices; use `.access/.stripe-credentials-and-price-id.md`.

## Execution order (strict)

| ID | Prompt | Priority | Depends on |
|---|---|---|---|
| AI01 | Contract v2 + capability discovery | P0 | none |
| AI02 | Keprix deep tool handlers (Gemini/ML) | P0 | AI01 |
| AI03 | Carina pack parity for contract v2 | P1 | AI01 |
| AI04 | Clinicom provider/pipeline consume v2 | P0 | AI01, AI02 |
| AI05 | Interpreter UI for deep AI assists | P0 | AI04 |
| AI06 | Session memory + encounter context pack | P0 | AI04 |
| AI07 | Dashboard HCI intelligence briefs | P1 | AI04, AI06 |
| AI08 | Eval harness, golden transcripts, honesty | P0 | AI02, AI04 |
| AI09 | Production cutover + entitlements switchbook | P0 | AI05, AI08 |

**Default production path:** Keprix Clinicom sidecar with real ML/Gemini. Carina remains switchable via profile for the **same** contract.

## Architecture target

```
Clinicom App (product, tenancy, authorship, billing)
   |
   |  POST /clinicom/tools/{tool}   +  GET /clinicom/capabilities
   v
Keprix Clinicom pack  OR  Carina Clinicom pack
   |
   +--> Keprix ML service and/or Gemini (real AI)
   +--> pack-local clinical skills (cultural, teachback, safety assist, memory, specialty)
```

## Prompt files

Archived (do not re-run): AI01-AI09 under `archives_from_pending_prompts/08-ai-depth/`.

Still pending here: none.

## Related existing prompts

- `07-award-winning/02-nice/n01-specialty-packs-measured-lift.md`
- `07-award-winning/02-nice/n06-realtime-confidence-coaching.md`
- `07-award-winning/02-nice/n10-developer-golden-transcript-sandbox.md`
- `07-award-winning/02-nice/n11-aiva-nurse-manager-bridge.md`
- `07-award-winning/02-nice/n12-custom-ml-eval-to-pilot.md`
- `06-hci-full-roadmap/05-advanced/a11-custom-ml-models.md`
- `06-hci-full-roadmap/05-advanced/a16-carina-skill-aiva-employee.md`

Prefer extending those when overlapping; Phase 08 is the sequencing spine for **platform depth**, not a duplicate feature wishlist.

## Handoff rule

After each AI* prompt:
1. Mark status in this README.
2. Run claim-firewall.
3. Prove with Riverside demo in under 3 minutes.
4. Keep Ask Clinicom FAQ grounded; do not route free-form medical chat through deep tools.
