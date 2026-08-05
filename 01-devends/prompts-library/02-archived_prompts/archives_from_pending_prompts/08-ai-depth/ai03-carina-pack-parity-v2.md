# Carina Pack Parity for Contract v2

**Status: COMPLETED 2026-08-04**

**What was built:** See programme README and matching Clinicom/Carina implementation paths.

**Roadmap tier:** Should (AI depth)  
**Prompt ID:** AI03  
**Priority:** P1  
**Depends on:** AI01  
**Target time:** 12-20h  
**Primary paths:** `carina/02-backends/core.carinaai.uk/packages/packs/clinicom/`, Carina sidecar script  
**Plan source:** Phase 08 AI depth

## Strategic intent

Keep Clinicom switchable: the same contract v2 works on Carina without rewriting Clinicom. Carina hosts the pack; Clinicom stays the product.

## Context (do not skip)

- Canonical Carina only under `carina/02-backends/`, `carina/03-frontends/`, `carina/scripts/`.
- Soft separation: Clinicom is not Carina; Carina is optional sidecar host.
- Never create `carina/verlox/` nests.
- Writing style and claim firewall rules apply.
- Do not paste secrets.

## Problem this prompt solves

If only Keprix implements v2, “Carina later” becomes a rewrite. Parity keeps profile switching as config, not a project.

## Current baseline (read before coding)

- `carina/02-backends/core.carinaai.uk/packages/packs/clinicom/`
- `npx tsx scripts/clinicom-sidecar.ts` (or current script path in docs)
- AI01 contract spec

## Required deliverables

1. Implement `/clinicom/capabilities` and v2 tool routes/handlers on Carina Clinicom pack.
2. Map tools to Carina agent tools where natural (`clinicom-transcribe` etc.) with honesty labels.
3. If a tool is not yet deep, return explicit stub source `carina-clinicom-stub` and status `stub` in capabilities.
4. Update `docs/sidecar-production.md` Carina section for v2.
5. Minimal tests or smoke for Carina sidecar capabilities + one deep tool if live keys exist.

## Architecture / design constraints

- Identical HTTP paths and JSON shapes as Keprix.
- Prefer pack-local handlers; do not require full Carina multi-agent chat loops for Clinicom turns.
- No Clinicom app changes required beyond profile URL (AI04 already capability-aware).

## Acceptance criteria

1. With `CLINICOM_SIDECAR_PROFILE=carina`, capabilities returns `contract_version` 2.x.
2. v1 interpret still works.
3. Switching profile does not require code edits in Clinicom beyond env/settings.

## Tests and validation

- Pack unit tests for route registration.
- Smoke script profile matrix note (keprix/carina).

## Demo / sales / awards proof

Flip Settings profile keprix → carina → show capabilities panel still lists tools (stub or live badges honest).

## Out of scope

Building full Carina memory/platform into Clinicom UI; Aiva employee bridge (N11).

## Related prompts

AI01, AI09, N11, A16.

## Handoff

Mark AI03 done; note which tools are still stub on Carina vs live on Keprix.
