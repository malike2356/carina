# Sprint 6 Convergence; Prompt 05: Complement Not Replace (Product Wiring)

**Status: COMPLETED 2026-06-24**

**What was built:**

- **T1:** `CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md` (decision tree, Glen checklist summary, troubleshooting, do-not list).
- **T2:** Propreneur tenant copy on email ingestion + Carina Remote setup guide; platform feature catalogue strings for `aiva_external_bridge` and event webhooks; feature flags admin info box.
- **T3:** `PropreneurBindingPanel` on Aiva Settings (property-uk / Property Manager); hire-flow callout in `AivaHireClient`; API proxy routes for bind/status.
- **T4:** Expanded `brain/knowledge/08-carina.md`; brain sync run.
- **T5:** Public docs `docs.carinaai.uk/user/integrations/propreneur-bridge.md` + sidebar entry.

**Sprint:** 6; Convergence
**Prompt number:** 05
**Name:** Document and UI wiring for dual-agent complementarity
**Primary agent:** Claude Code (docs), Cursor (UI copy)
**Estimated hours:** 6-8 h
**Depends on:** Prompt 01 (bridge functional)

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `01-devends/prompts/02-archived_prompts/archives_from_pending_prompts/sprint-6/`.

---

## Read First

1. `01-devends/planning/operations/CARINA_PROPRENEUR_CONVERGENCE_CHECKLIST.md` (section E)
2. `propreneur/propreneur-v2/app/Support/PlatformFeatureCatalogue.php` (`aiva_external_bridge`)
3. `03-frontends/marketing/docs.carinaai.uk/` (user-facing docs structure)
4. `propreneur/propreneur-v2/brain/knowledge/08-carina.md`

---

## Goal

Make it obvious to operators and tenants **which agent to use when**, without merging products.

**Unity principle:** Two faces of one intelligence family; shared bridge; separate runtimes.

---

## Owner / consumer / flags

| User need | Use | Owner | Flag |
|-----------|-----|-------|------|
| In-app deal analysis, CRM writes, calculators | Propreneur Carina | Propreneur | `carina_ai` / `carina_agent` |
| Telegram/WhatsApp daily brief, portfolio Q&A on phone | Aiva (Carina core) | Carina | `AI_WORKERS_ENABLED` + bridge flags |
| Email ingestion | Propreneur settings | Propreneur | existing email ingestion |
| Security audit on external agent tools | Scout | Scout | `LABYRINTH_ENABLED` |
| Property law RAG | Both (synced brain) | Shared | training / property-uk pack |

---

## Tasks

### T1. Operator runbook

Create `01-devends/planning/operations/CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md`:

- Decision tree (ASCII or mermaid): in-app vs Aiva vs both.
- Glen onboarding checklist (bind tenant, enable flags, Telegram, PP email only).
- Troubleshooting: bridge 401, empty portfolio, duplicate email polling.
- Explicit "do not" list (no engine replacement, no direct SQL, no force-merge).

### T2. Propreneur tenant admin copy

- In settings near email ingestion: note that external Aiva reads activity via bridge; do not connect same mailbox in Carina IMAP.
- Near Carina feature flags (if admin UI exists): link to complement guide.
- Platform feature `aiva_external_bridge` description updated in `PlatformFeatureCatalogue`.

### T3. Carina ops / employ portal copy

- Aiva hire flow: when `property-uk` pack selected, show "Bind Propreneur workspace" step (slug + API key).
- Explain read-only phase; writes coming later behind review queue.

### T4. Update `brain/knowledge/08-carina.md` (both mirrors)

Add section **"Carina in Propreneur vs Aiva workers"**:

- Table: capabilities per surface.
- Bridge endpoints list (read-only).
- Pointer to complement guide.

Run brain sync (prompt 02) after edit.

### T5. Public docs stub (optional)

- One page in `docs.carinaai.uk` under integrations: "Propreneur bridge" with flag names and architecture diagram (no secrets).

---

## Explicit SKIP

- Building a unified chat UI that embeds both agents in one widget
- Deprecating Propreneur Carina in favour of Aiva

---

## Done When

- [x] `CARINA_PROPRENEUR_COMPLEMENT_GUIDE.md` exists with decision tree
- [x] Propreneur admin/feature catalogue strings updated
- [x] Aiva hire UI mentions Propreneur binding (or API docs if UI not ready)
- [x] `08-carina.md` updated in Propreneur and synced to Carina brain
- [x] Checklist section E unchanged; operators can follow guide without reading source code

---

## Validation

Manual: follow Glen checklist on xelox test tenant end-to-end.

```bash
# After brain edit
bash carina/scripts/sync-brain-from-propreneur.sh --dry-run
```
