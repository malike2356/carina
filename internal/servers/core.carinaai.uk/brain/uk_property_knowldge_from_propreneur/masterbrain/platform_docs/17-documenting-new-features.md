# Documenting new features (agent and human workflow)

**Last updated:** 2026-05-03  
**Audience:** Developers and AI agents working in this repository

---

## Addendum (mandatory for agents)

When you **finish building a new product feature** (not a typo fix or a one-line tweak to existing behaviour), you **must** add a **new** `brain/knowledge/NN-topic.md` file for it, then index and log. Do not only append a paragraph to an unrelated doc and stop. If the feature extends an existing module in a large way, you may both update the module doc **and** add a focused new file when Carina needs a clean retrieval unit (example: `65-platform-subscription-plans-admin.md` for plan CRUD alongside `15-platform-admin.md`).

---

## Rule: new shipped feature, new knowledge file

When a **new product feature** is implemented (routes, migrations, services, UI, or behaviour that Carina or support staff should describe accurately):

1. **Add a new numbered file** under `brain/knowledge/` (next free index in `00-README.md`, e.g. `35-*.md`). Prefer a **new file** over stuffing unrelated sections into an old doc, unless the change is a one-line correction to an existing topic.
2. **Index it** in `brain/knowledge/00-README.md` (table row + refresh **Last updated**).
3. **Cross-link** from related entries (e.g. `22-tenant-route-map.md`, `13-routes.md`, module-specific `04-*` / `06-*`) with one sentence, not large duplication.
4. **Record the milestone** in `memory.md` (**Stage log** and, if appropriate, **Current Build Status** checkboxes).

RAG ingestion reads these files; scattered notes in random markdown paths outside `brain/knowledge/` are easy to miss.

---

## What belongs in the new file

- **What shipped:** scope, feature flags or billing module keys, main URLs or route names.
- **Data:** tenant vs central tables, important columns, JSONB casts if any.
- **How to operate:** one or two happy-path examples (HTTP or UI), not a full API dump unless the module is API-first.
- **Out of scope / next:** follow-ups so agents do not re-plan completed work.

Avoid competitor real names in corpus text; use internal umbrella labels such as **BenchStack** where a generic “researched alternative” is meant (see `CLAUDE.md` competitive section).

---

## Code and tests (unchanged policy)

- No feature without a **Pest** test (project rule).
- Controllers stay thin; logic in `app/Services/`.
- After schema changes, tenant vs central migration paths stay explicit (`database/migrations/` vs `database/migrations/tenant/`).

---

## Related

- `00-README.md` - knowledge index  
- `memory.md` - build status and stage log  
- `14-fixes.md` - defect and environment lessons (e.g. testing DB drift, migrate lock)
