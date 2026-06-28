# Sprint 6 Convergence; Prompt 02: Shared Knowledge Sync

**Status: COMPLETED 2026-06-24**
**Sprint:** 6; Convergence
**Prompt number:** 02
**Name:** Single brain source; dual RAG ingest
**Primary agent:** Claude Code
**Estimated hours:** 6-10 h
**Depends on:** None (can run parallel to prompt 01)

**What was built:**
- `01-devends/planning/operations/BRAIN_SYNC.md` runbook
- `carina/scripts/sync-brain-from-propreneur.sh` and `check-brain-drift.sh`
- `src/skills/brain-knowledge-meta.ts`, `brain-sync-manifest.ts`, tests
- `package.json` scripts: `brain:sync`, `brain:sync-and-ingest`, `brain:check-drift`
- Propreneur `brain/knowledge/01-architecture.md` and `08-carina.md` sync workflow sections
- Full knowledge + carina_rag mirror sync (146 knowledge files)

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

---

## Read First

1. `02-backends/core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/`
2. `propreneur/propreneur-v2/brain/knowledge/` and `brain/masterbrain/`
3. `propreneur/propreneur-v2/app/Services/Carina/CarinaKnowledgeTrainingService.php`
4. `02-backends/core.carinaai.uk/src/skills/packs/property-uk/`
5. `02-backends/core.carinaai.uk/package.json` (`pnpm ingest` script if present)

---

## Goal

Both agents answer property questions from the **same authored knowledge**, without sharing a single runtime engine.

**Unity principle:** One authoring tree; two ingest pipelines. Updating `08-carina.md` in one place propagates to both products.

---

## Owner / consumer / flags

| Capability | Owner | Consumer | Flag / mechanism |
|------------|-------|----------|------------------|
| Knowledge markdown source | `brain/` (canonical path in repo) | both | `BRAIN_KNOWLEDGE_PATH` (Propreneur), Carina `brain/` mount |
| Propreneur RAG ingest | Propreneur | In-app Carina | `carina:verify`, training jobs |
| Carina property-uk pack | Carina core | Aiva + CLI | `ACTIVE_SKILL_PACKS=property-uk` |
| SKILL.md format | Carina skills | Propreneur training importer | pack manifest |

---

## Tasks

### T1. Declare canonical source

Add `01-devends/planning/operations/BRAIN_SYNC.md` documenting:

- **Authoritative tree:** pick one (recommend `propreneur/propreneur-v2/brain/knowledge/` for tenant-facing docs; sync copy to Carina `brain/uk_property_knowldge_from_propreneur/knowledge/` via script).
- **Sync direction:** knowledge edits flow Propreneur brain → Carina brain mirror (or vice versa for platform-only docs); never fork silently.
- **File naming:** keep numbered `NN-topic.md` convention.

### T2. Sync script

Create `carina/scripts/sync-brain-from-propreneur.sh` (or `.py`):

- Rsync/copy `brain/knowledge/*.md` and selected `masterbrain/carina_rag/*.md` into Carina ingest tree.
- Dry-run mode; idempotent.
- No secrets; no `.env` content.

### T3. Propreneur ingest hook

- Document in `brain/knowledge/01-architecture.md`: after knowledge edit, run `php artisan carina:train` (or existing training command) on deploy.
- If `CarinaKnowledgeTrainingService` supports path override, ensure `BRAIN_KNOWLEDGE_PATH` is documented in `.env.example`.

### T4. Carina property-uk pack refresh

- After sync, run documented ingest: `pnpm ingest` or `node dist/src/skills/ingestion.js --pack property-uk`.
- Add npm script `brain:sync-and-ingest` chaining sync + ingest for local dev.

### T5. SKILL.md bridge (Tier 2 #10, partial)

- Map Propreneur `brain/knowledge/*.md` front-matter (if any) to Carina skill metadata (title, tags).
- Minimum: one test skill round-trips through sync without manual edit.

### T6. Drift detection

- Add `carina/scripts/check-brain-drift.sh`: compare checksums of mirrored files; exit 1 on mismatch in CI (optional job, non-blocking at first).

---

## Explicit SKIP

- Merging RAG databases into one Postgres instance
- Serving Propreneur chat from Carina pgvector
- Auto-sync on every git commit (manual/CI only for now)

---

## Done When

- [ ] `BRAIN_SYNC.md` exists with owner/consumer table
- [ ] Sync script runs clean on dev machine
- [ ] Carina property-uk pack re-ingests after sync without error
- [ ] Propreneur training command documented post-edit workflow
- [ ] Checklist C4 marked PARTIAL or DONE
- [ ] No em dashes or emojis in new docs (run `python3 scripts/fix-writing-style.py` if needed)

---

## Validation

```bash
bash carina/scripts/sync-brain-from-propreneur.sh --dry-run
cd carina/02-backends/core.carinaai.uk && pnpm test
cd ../../propreneur/propreneur-v2 && php artisan carina:verify
```
