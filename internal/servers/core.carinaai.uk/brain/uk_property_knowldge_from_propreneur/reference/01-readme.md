# Reference corpus (`brain/reference/`)

**Not build prompts.** Files here are packed source material (templates, e-resource specs, module backlogs, user-guide drafts). Do not tick them on `build-checklist.md` as if they were numbered prompts.

| File | Role |
|------|------|
| `carina-knowledgebase-final-packed.md` | Legacy Xelox/Carina pack: §1 module ideas (mostly backlog), §2-4 templates and guides. Splits live under `brain/masterbrain/`. |

**Carina RAG (checklist row 08):** `brain/prompts/08-carina-rag.md`  
**Carina core:** `brain/prompts/07-carina-core.md`  
**Shipped behaviour:** `brain/knowledge/08-carina.md`

After editing reference content that should reach Carina, run `php artisan rag:ingest-brain-knowledge --sync` only for files under `brain/knowledge/` (or re-split into masterbrain/knowledge per `brain/prompts/cursor-extraction-prompt.md`).
