# SOP 013: Brain Sync - Propreneur and Carina
**Classification:** Internal VERLOX only. Do not share externally.
**Source:** Migrated from planning/operations/BRAIN_SYNC.md
**Last reviewed:** 2026-06-25

---

# Brain sync: Propreneur and Carina standalone

**Updated:** 2026-06-24
**Principle:** One authoring tree; two ingest pipelines. Unity without merging runtimes.

---

## Owner / consumer

| Capability | Owner | Consumer | Mechanism |
|------------|-------|----------|-----------|
| Tenant-facing knowledge markdown | `propreneur/propreneur-v2/brain/knowledge/` | Propreneur RAG | `php artisan rag:ingest-brain-knowledge` |
| Carina RAG spec docs | `propreneur/propreneur-v2/brain/masterbrain/carina_rag/` | Propreneur training + mirror | same + admin training UI |
| Carina property mirror | `carina/02-backends/core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/` | Carina property-uk pack | `pnpm brain:sync-and-ingest` |
| Platform-only Carina docs | `core.carinaai.uk/brain/` (non-Propreneur) | Carina CLI/Aiva | edit in Carina; do not overwrite on sync |

---

## Canonical source

**Authoritative for UK property product knowledge:**
`propreneur/propreneur-v2/brain/knowledge/*.md`

**Sync direction (default):** Propreneur knowledge -> Carina mirror. Never edit the mirror by hand; changes will be overwritten on the next sync.

**Platform-only exception:** Files under `core.carinaai.uk/brain/` that are not under `uk_property_knowldge_from_propreneur/` stay Carina-owned.

**Naming:** Keep numbered prefixes (`NN-topic.md`). New files follow `99-template-knowledge-entry.md`.

---

## Workflow after editing knowledge

### Propreneur (in-app Carina RAG)

From `propreneur/propreneur-v2/`:

```bash
php artisan rag:ingest-brain-knowledge
php artisan carina:verify --tenant=xelox
```

Optional path override: `BRAIN_KNOWLEDGE_PATH` in `.env` (see `config/paths.php`).

### Carina standalone (property-uk pack + pgvector)

From `carina/02-backends/core.carinaai.uk/`:

```bash
pnpm brain:sync-and-ingest
```

Or step by step:

```bash
bash ../../scripts/sync-brain-from-propreneur.sh
pnpm ingest
```

Requires `DATABASE_URL` and embedding API keys for full RAG ingest.

### Drift check (CI or pre-release)

```bash
bash carina/scripts/check-brain-drift.sh
```

Exit code 1 when the Carina mirror differs from Propreneur source.

---

## What sync copies

| Source | Destination |
|--------|-------------|
| `propreneur-v2/brain/knowledge/*.md` | `core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/knowledge/` |
| `propreneur-v2/brain/masterbrain/carina_rag/*.md` | `core.carinaai.uk/brain/uk_property_knowldge_from_propreneur/masterbrain/carina_rag/` |

Sync also writes `.brain-skill-manifest.json` in the knowledge mirror (title/tags for property-uk skill bridge).

---

## SKILL.md bridge (auto-generation)

On each `pnpm brain:sync`, Carina writes:

- `.brain-skill-manifest.json` (metadata index)
- `.generated-skills/kb-*.skill.md` (one SKILL.md per knowledge file, `kb-` prefix avoids collision with hand-crafted property-uk skills)

**Runtime loading is opt-in:** set `BRAIN_KNOWLEDGE_SKILLS_ENABLED=true` when `property-uk` is in `ACTIVE_SKILL_PACKS`. Default is `false` so existing deployments are unchanged.

Skipped automatically: `00-README.md`, `99-template-knowledge-entry.md`, files with `skill: false` in frontmatter.

Opt in explicitly with frontmatter:

```markdown
---
skill: true
name: custom-kb-slug
tags: carina,compliance
---
```

Implementation: `src/skills/brain-knowledge-skills.ts`

---

## Related

- Convergence checklist: `SOP/015-carina-propreneur-convergence.md`
- Operator guide: `SOP/014-carina-propreneur-operator-guide.md`
