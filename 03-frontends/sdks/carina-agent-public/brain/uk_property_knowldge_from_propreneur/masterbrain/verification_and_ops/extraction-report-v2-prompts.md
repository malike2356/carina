# Extraction Report - brain/prompts (historical label: v2-prompts)

Date: 2026-05-15

## Files Processed: 60

All numbered markdown build prompts under `brain/prompts/` were verified against the former sibling folder **`../v2-prompts/`** (recursive `diff -rq`: identical). The three files that existed only under `v2-prompts/` (**`cursor-extraction-prompt.md`**, **`readme-prompts.md`**, **`99-test-scratchpad.md`**) were copied into `brain/prompts/` before **`v2-prompts/`** was deleted. Meta files are no longer "skipped" for preservation; they live in `brain/prompts/` for the next extraction pass.

## Build Prompts Filed → `brain/prompts/`

| File | Action |
|------|--------|
| `01-foundation-multitenancy.md` through `52-vical-implementation-status.md` (entire numbered set including `08-carina-2-0-complete.md`, gap files `42`-`48`, status `49`/`52`, workflow `50`/`51`) | **Canonical** in `brain/prompts/` (synced from former `v2-prompts/` on 2026-05-15; folder since removed). |
| `brain/reference/carina-knowledgebase-final-packed.md` | **Reference corpus** (relocated 2026-05-15 from `brain/prompts/`; not a numbered build prompt). |
| Pre-existing `carina-2-0-build-prompt-complete.md` | **Unchanged** (not in the numbered v2 drop; left in place). |
| Prior `07-carina-core.md` / `08-carina-rag.md` | **Overwritten** when the v2 drop was newer during sync. |

## Knowledge Files Created → `brain/masterbrain/`

| Path | Description |
|------|-------------|
| `Carina_RAG/15-v2-prompts-business-journey-and-nav-principles.md` | Distilled journey from `50-propreneur-workflow-correction-deepseekclaw.md` |
| `Carina_RAG/16-packed-kb-preamble-and-codebase-alignment.md` | Split from `brain/reference/carina-knowledgebase-final-packed.md` (lines 1-27) |
| `Carina_RAG/17-packed-kb-carina-module-prompts-1-through-7.md` | Split: packed KB Prompts 1-7 |
| `Carina_RAG/18-packed-kb-carina-user-guide-by-portal.md` | Split: Documentation 5 from packed KB |
| `Carina_RAG/19-carina-2-sections-1-3-identity-environment-read-order.md` | Split from `08-carina-2-0-complete.md` Sections 1-3 |
| `Carina_RAG/20-carina-2-sections-14-15-security-and-incognito.md` | Split: Sections 14-15 |
| `Carina_RAG/21-carina-2-section-17-capability-specifications-cap-01-through-17.md` | Split: Section 17 (CAP-01-17) |
| `Carina_RAG/22-carina-2-sections-18-19-output-rules-and-baseline-system-prompt.md` | Split: Sections 18-19 |
| `Carina_RAG/23-carina-2-build-prompt-implementation-sections-index.md` | Pointer to Sections 4-13, 20-28 (not duplicated) |
| `legal/21-sourcing-aml-onboarding-templates-from-packed-kb.md` | Split: packed KB Section 2 templates (reservation, AML, onboarding, complaints, privacy, introducer letters) |
| `legal/22-hmo-compliance-manchester-extract-from-packed-kb.md` | Split: Documentation 4 HMO Manchester extract |
| `algorithms/07-e-resources-calculators-and-dd-pack-from-packed-kb.md` | Split: packed KB Section 3 E-resources |
| `deals/25-property-viewing-guide-abridged-from-packed-kb.md` | Split: Documentation 1 |
| `deals/26-area-due-diligence-guide-from-packed-kb.md` | Split: Documentation 2 |
| `deals/27-deal-packaging-guide-from-packed-kb.md` | Split: Documentation 3 |
| `marketing/29-social-media-content-guide-from-packed-kb.md` | Split: Documentation 6 |
| `process_and_workflow/51-masterbrain-folder-map-and-organisation-format.md` | Split from `08-carina-2-0-complete.md` Section 16 |
| `verification/build-checklist.md` | Master build checklist |
| `verification/extraction-report-v2-prompts.md` | This report |
| `Carina_RAG/24-carina-capabilities-reference-module-41.md` | Folded from former `carina2.0/41-*.md` (2026-05-15) |
| `Carina_RAG/25-carina-advanced-capabilities-reference-module-42.md` | Folded from former `carina2.0/42-*.md` |
| `Carina_RAG/26-carina-advanced-capabilities-reference-module-43.md` | Folded from former `carina2.0/43-*.md` |

## Build prompts added from former `carina2.0/`

| Path | Description |
|------|-------------|
| `brain/prompts/carina-2-0-build-prompt-final.md` | Historical FINAL export (see header note vs `08-carina-2-0-complete.md`) |
| `brain/prompts/carina-2-0-build-prompt-addendum.md` | Addendum sections (also embedded in `08-carina-2-0-complete.md`) |

## `carina-2-0-build-prompt-complete.md`

**Overlap:** `brain/prompts/carina-2-0-build-prompt-complete.md` overlaps **`08-carina-2-0-complete.md`** and the historical **`carina-2-0-build-prompt-final.md`**. Prefer **`08-carina-2-0-complete.md`** + **`Carina_RAG/19`**-**`23`** for implementation; use **`carina-2-0-build-prompt-final.md`** when you want the mid-length single-file export.

## Split tooling

- **`scripts/split-carina-packed-to-masterbrain.py`** - re-run to regenerate the slices from the two canonical prompt files (overwrites the split outputs).

## Knowledge Files Extended

- `Carina_RAG/10-readme.md` - rows **`15`**-**`26`** and consolidation note (former `carina2.0/` folded 2026-05-15).

Earlier note on **`brain/knowledge/`** vs **`masterbrain/`** still applies: developer truth remains in `brain/knowledge/`; these splits add RAG-friendly chunks under `masterbrain/` for ingestion or operator copy.

## New Folders Created

None. `booking/` was not added; viCal and booking rules remain under `process_and_workflow/` (`38-vcal-booking-module.md` and knowledge `31-vcal-booking-module.md` in the app `brain/knowledge/` tree).

## Build Checklist Status

- Total modules (numbered rows in checklist): **48** primary rows plus sub-prompts `19b`-`23b` and `41v` (tracked in same document).
- Done `[x]`: **36**
- To Do `[ ]`: **18** (includes partial sub-prompts `19b`-`23b` and `41v` where not verified complete)

## Skipped Files (first-pass rules only; obsolete after consolidation)

| File | Notes |
|------|--------|
| `cursor-extraction-prompt.md` | Now stored in `brain/prompts/` as the operator playbook (paths updated to `brain/prompts/`). |
| `readme-prompts.md` | Now stored in `brain/prompts/` as the prompt index. |
| `99-test-scratchpad.md` | Now stored in `brain/prompts/` (placeholder). |

## Notes on Source File 51

`51-propreneur-workflow-correction.md` in `brain/prompts/` is a **short conversational fragment**, not a structured correction spec. Canonical merged workflow content is in **`50-propreneur-workflow-correction-deepseekclaw.md`**. Carina-facing distillate is in **`Carina_RAG/15-*.md`**.

## Carina RAG Updated

- `_folder_index.txt` - **unchanged** (no new top-level folders).
- `Carina_RAG/10-readme.md` - **updated** with rows **`15`**-**`26`** and consolidation note.

**Operator note:** Vector RAG for tenants is refreshed by document ingestion (`rag:ingest-brain-knowledge` targets `brain/knowledge/` per `brain/knowledge/00-README.md`). To embed new `masterbrain/Carina_RAG` prose, mirror or ingest via the same pipeline your ops use for training docs.

## Folder retirement (2026-05-15)

The directory **`../v2-prompts/`** was removed after `diff -rq` confirmed all numbered `*.md` prompts matched `brain/prompts/` and the three extra files were copied there. Nothing was deleted without a copy under this repository.

## Former `carina2.0` sibling export (2026-05-15)

The directory **`../carina2.0/`** was removed. Content was **folded into canonical paths** (no `_legacy_*` subfolder):

| Original | Now |
|----------|-----|
| `41-carina-capabilities.md` | `brain/masterbrain/Carina_RAG/24-carina-capabilities-reference-module-41.md` |
| `42-carina-advanced-capabilities.md` | `brain/masterbrain/Carina_RAG/25-carina-advanced-capabilities-reference-module-42.md` |
| `43-carina-advanced-capabilities.md` | `brain/masterbrain/Carina_RAG/26-carina-advanced-capabilities-reference-module-43.md` |
| `carina-2-0-build-prompt-final.md` | `brain/prompts/carina-2-0-build-prompt-final.md` (historical shorter export; see header note vs `08-carina-2-0-complete.md`) |
| `carina-2-0-build-prompt-addendum.md` | `brain/prompts/carina-2-0-build-prompt-addendum.md` |
| `07-carina-core.md`, `08-carina-rag.md` | **Dropped** (byte-identical to `brain/prompts/07-carina-core.md` and `08-carina-rag.md`). |
| `Carina_AI_2.0_Master_Specification.md` | **Dropped** (byte-identical to `brain/masterbrain/Carina_RAG/13-carina-2-master-specification.md`). |
