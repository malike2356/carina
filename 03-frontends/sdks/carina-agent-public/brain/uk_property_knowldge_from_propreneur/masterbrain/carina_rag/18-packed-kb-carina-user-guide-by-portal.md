---
source: `brain/reference/carina-knowledgebase-final-packed.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

## Documentation 5: Carina User Guide (By Portal)

**File name:** `carina_user_guide.pdf`

```markdown
# Carina User Guide (tenant workspace)

Aligned with `routes/tenant.php` (`tenant.carina.*`), `CarinaController`, and `brain/knowledge/08-carina.md`. Access requires the Carina AI feature on the workspace subscription.

## What is Carina?

A context-aware assistant. Typical entry points:

- Hub: `/carina/conversations`
- Deep links (examples): `/carina/open-property/{id}`, `/carina/open-deal/{id}`, `/carina/open-deal-calculator/{slug}`, `/carina/open-compliance/{id}`, `/carina/open-contact/{id}`, `/carina/open-pipeline-deal/{id}` (see the `carina` route group in `routes/tenant.php`). **`/carina/open-deal/{id}` expects the DealAnalysis id** (`deal_analyses` table), because `startFromDeal` loads `DealAnalysis`.

Each conversation stores a `context_type` (`property`, `deal`, `deal_calculator`, `compliance`, `contact`, `pipeline_deal`, `pipeline`, etc.) so answers stay tied to the record you opened.

## What to ask (realistic examples)

- **Property:** Summarise listing fields, EPC hints, and your notes. Photo analysis depends on what the client sends; there is no first-class "viewing report" PDF pipeline in core v2 yet.
- **Deal / calculator:** Ask Carina to explain numbers after you have run the calculator in the UI (server routes `POST /deals/calculate/{strategy}`). Carina should not invent spreadsheet maths that contradicts the service output.
- **Compliance:** Discuss the `compliance_items` you have captured. Carina does **not** replace Credas, title checks, or statutory filing.
- **CRM:** Use contact context for investor fit language; numeric fit uses `investment_score_*` fields when populated. Bulk "Day N KLT" sends are **not** implied unless your Comms Hub implementation is live for that tenant.
- **RAG:** Citations come from workspace `rag_documents` chunks. Ingest markdown from `brain/knowledge` only if an operator has run `php artisan rag:ingest-brain-knowledge` (see `00-README.md`).

## Incognito

Use the banner toggle on the Carina conversation page or natural phrases such as `incognito mode on` / `incognito mode off` (handled by `CarinaIncognitoService`). While on, learning writes are suppressed as described in the UI.

## Keyboard shortcuts

- **Ctrl+K / Cmd+K:** Opens **global workspace search** (`resources/js/alpine/global-search.js`), not Carina.
- There is **no** documented global shortcut that opens Carina from every screen; launch from module actions or the `/carina` routes above.

## Best practices

1. Start Carina from the entity you mean so `context_id` is populated.
2. For legal, tax, or AML outcomes, treat outputs as drafts for human review.
3. Keep API keys for **chat** and **embeddings** separate in mind: DeepSeek can power chat, but embeddings follow `AI_EMBEDDING_PROVIDER_PRIORITY` (see `config/ai.php`).
```

---

