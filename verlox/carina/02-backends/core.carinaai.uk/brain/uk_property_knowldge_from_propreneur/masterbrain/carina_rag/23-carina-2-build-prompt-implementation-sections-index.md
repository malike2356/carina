---
source: `brain/prompts/08-carina-2-0-complete.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

# Carina 2.0 build prompt - implementation sections index

**Full source:** `brain/prompts/08-carina-2-0-complete.md`

The following sections are **implementation specifications** (migrations, models, services, controllers, routes, tests, Filament, `carina:verify`, brain modifier file bodies, rate limits). They were **not** duplicated into `brain/masterbrain/` to avoid multi-thousand-line drift from the canonical prompt.

| Sections | Topics |
|----------|--------|
| 4-13 | Database migrations through Pest tests |
| 20 | Implementation sequence checklist |
| 21-28 (and duplicate block after line ~2255) | `carina:verify`, `_folder_index`, ethics log, brain modifiers, `CarinaAccessGate`, seeders, Filament, corrections |

**Extracted to masterbrain:** Sections 1-3, 14-15, 16 (folder map), 17 (CAP-01-17), 18-19 - see `Carina_RAG/19-*.md` through `22-*.md`.

For **Carina product behaviour**, prefer `brain/knowledge/08-carina.md`, `config/ai.php`, and shipped `App\Services\Carina\` over this build prompt when they disagree.
