---
source: `brain/reference/carina-knowledgebase-final-packed.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
---

# Propreneur + Carina: Complete Compilation

## AI Coding Agent Prompts | Templates | E-Resources | Documentation

---

# SECTION 1: AI CODING AGENT PROMPTS

These prompts are designed for an AI coding agent to build Carina features directly into the Propreneur SaaS platform.

### Codebase alignment (v2, PostgreSQL, 2026-05-03)

Read this before treating any SQL or PHP name below as literal repo truth.

| Topic | Shipped in repo | Not shipped (examples in this doc) |
| --- | --- | --- |
| DB engine | PostgreSQL; `properties.id` is `bigint`; FKs use `foreignId` | MySQL-style `UUID PRIMARY KEY`, generic `JSON` column types in sketches |
| Property + Carina | `properties.carina_summary` exists (`database/migrations/tenant/2026_04_07_000002_create_properties_table.php`) | `carina_viewing_summary`, `carina_repair_estimates`, `carina_risk_score`, `viewing_checks`, `viewing_reports` tables |
| Carina context | `CarinaConversation.context_type` strings: `property`, `deal`, `deal_calculator`, `contact`, `investors_hub`, `pipeline`, `pipeline_deal`, `compliance`, `report`, `course`, `community_post`, `mentorship`, `journal_entry`, `vcal_booking`, general `null` (`CarinaController`). When `context_type` is `deal`, `context_id` is a **`deal_analyses` row id** (`startFromDeal`). Route names like `tenant.carina.fromProperty` are URLs only. | Treating `fromDeal` / `fromProperty` as database enum values |
| Deal maths | `DealCalculatorRegistry`, `POST /deals/calculate/{strategy}`, `DealCalculatorRunService`, `deal_calculator_logs` | `deal_engine_tables`, `CarinaDealCalculatorService`, `calculation_presets` table |
| RAG | `rag_documents` / `rag_chunks`, `rag:ingest-brain-knowledge`, `App\Services\Carina\RAGService::retrieveContext` | Auto-indexing every `brain/knowledge/*.md` on boot |
| Embeddings | `AiRouterService` + `config('ai.embedding_provider_priority')` (default `openai,openrouter,groq,google`); DeepSeek and Anthropic skipped for `/embeddings` | Using DeepSeek first for embeddings |
| CRM depth | `contacts` + investor score columns (`investment_score_*` per tenant migrations) | `klt_campaign_emails`, `investor_criteria` tables as written |

**Canonical code references:** `app/Services/Carina/CarinaService.php`, `app/Http/Controllers/Tenant/CarinaController.php`, `routes/tenant.php`, `brain/knowledge/08-carina.md`, `brain/knowledge/04-deals.md`, `brain/knowledge/32-contact-intelligence-and-lead-scoring.md`.

---
