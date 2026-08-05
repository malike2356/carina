# Carina documentation classification inventory

**Date:** 2026-07-28  
**Scope:** `/opt/lampp/htdocs/verlox/carina`  
**Method:** Path heuristics + code reference check for root/`docs/` candidates  
**Goal:** Separate active code from planning fluff without breaking RAG or Docusaurus

## Summary counts (pre-move scan)

| Class | Approx count | Action |
|---|---:|---|
| Runtime RAG / brain | 1404 | **KEEP** |
| `01-devends` prompts/planning | 1074 | **DEFER** (already mostly correct home) |
| Nested `verlox/` duplicate tree | 1005 | **DEFER** (needs live-vs-nested decision) |
| Package README / AGENTS / SECURITY | 13 | **KEEP** |
| Operator package docs under backends/frontends | 11+ | **KEEP** (near code) |
| Runtime-loaded prompts in `src/` | 7+ | **KEEP** |
| Shipped legal | 3+ | **KEEP** |
| Public Docusaurus (`03-frontends/marketing/docs.carinaai.uk`) | present | **KEEP** (do not move) |
| Root / thin `docs/` planning fluff | 13 | **MOVED** this pass |

## KEEP (do not move)

- `brain/**` and any path used as RAG/runtime knowledge
- `03-frontends/marketing/docs.carinaai.uk/**` (public Docusaurus)
- `resources/carina/skills/**`, `resources/carina/workspace-templates/**` (product resources)
- `resources/docs/help/**` (in-app help content)
- `**/content/legal/**` (customer-facing legal)
- `**/src/**/system-prompt.md`, `builtin-profiles/**`
- Package `README.md`, `AGENTS.md`, `SECURITY.md`, deploy docs next to servers
- `01-devends/prompts-library/**` for now (already the prompt home)

## MOVED this pass (safe)

### From repo root → `product/planning/`

| From | To |
|---|---|
| `AIVA_CARINA_SCOUT_BUSINESS_PLAN.md` | `strategy/` |
| `Ai_Workspac_Brief_McMensa.md` | `strategy/` |
| `BUSINESS_PLAN.md` | `strategy/` |
| `CARINA_SYSTEM_DESCRIPTION.md` | `strategy/` |
| `carina_the_tollbooth_end_game_strategy_discussion.md` | `strategy/` |
| `CODER_STANDARDS.md` | `standards/` |
| `LEGAL.md` | `shared/legal/LEGAL-OVERVIEW.md` (company spine; Aiva docs in `content/legal/`) |
| `MANUAL_STEPS.md` | `operations/` |
| `SELF_HOSTED.md` | `operations/` |

### From `docs/` → `product/planning/`

| From | To |
|---|---|
| `docs/CARINA_SALES_DEMO_CHECKLIST.md` | `operations/` |
| `docs/deploy-glenn-adam-checklist.md` | `operations/` |
| `docs/carina-mobile-architecture.md` | `architecture/` |
| `docs/PROPCALC_COMPETITOR_BENCHMARK.md` | `competitive/` |

Reference updates:

- `app/Support/Propcalc/CompetitorBenchmark.php`
- `resources/views/public/calculators/compare.blade.php`

## DEFER (next phases)

1. **Nested `verlox/carina` tree:** MERGED 2026-07-28 into top-level `02-backends/` / `03-frontends/`. Archive at `archive/carina-nested-merge-20260728/`. See `LIVE-VS-NESTED-TREE-DECISION.md`.
2. **Frontend copied brain** under SDKs / clients if any remain: dedupe toward `brain/` only.
3. **Mobile SPEC-*.md** under `carinaMobile/`: move to `product/planning/` after checking no CI/docs site links.
4. **Root Laravel `resources/docs/help`**: keep unless proven unused by the help UI.
5. **Mass move of `01-devends`**: already correct-ish; only tidy duplicates into `product/planning` if desired.

## Safety rules used

- No moves under `brain/`
- No moves under Docusaurus marketing docs
- No moves of files loaded as system prompts / skills / legal content
- Only moved files with zero runtime loaders (filename mention in PHP comment/Blade path text was updated)

## Validation after this pass

```bash
# Root should no longer hold strategy fluff
ls /opt/lampp/htdocs/verlox/carina/*.md

# Planning home
ls /opt/lampp/htdocs/verlox/carina/product/planning/*/
```

Expected root markdown: `AGENTS.md`, `README.md` (and similar package meta only).
