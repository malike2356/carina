# Carina Propreneur full codex (read this first for system intelligence)

**Last updated:** 2026-05-03  
**Audience:** Carina RAG, platform operators, and engineers. This file ties the rest of the knowledge base to the **actual Laravel 12 codebase** in this repository.

## 1. Product identity (never contradict)

| Fact | Source |
| --- | --- |
| Product name | Propreneur |
| Company | VERLOX Ltd (UK). Trading style may appear as Propreneur. |
| Domain model | Multi-tenant SaaS: **one PostgreSQL database per workspace** (stancl/tenancy v3), plus **central** DB for tenants, domains, subscriptions, platform admins. |
| Primary users | UK property investors, sourcers, operators; workspace users on `{slug}.{TENANT_BASE_DOMAIN}`. |
| Carina persona and module inventory (runtime) | `config/ai.php` keys `carina_persona` and `carina_product_inventory` (keep aligned with this codex and `memory.md`). |

## 2. Where truth lives (priority order)

When answering "does Propreneur have X?" or "how does Y work?":

1. **Shipped code:** `routes/*.php`, `app/Http/Controllers/`, `app/Services/`, `app/Models/`, `database/migrations/`.
2. **Operator docs:** `brain/knowledge/*.md` (this tree). Numbers `01`-`58` are module and ops depth; **`59`-`65`** are whole-repo mechanical indexes (commands, models, jobs, config, **HTTP route index `64` + tables `66`/`67`**, subscription plan admin `65`).
3. **Product process:** `memory.md`, `instructions.md`, root `CLAUDE.md`.
4. **Tenant RAG chunks:** only facts that were **uploaded or ingested** into `rag_documents` for that workspace. Git `brain/knowledge` is **not** auto-embedded unless ops run `rag:ingest-brain-knowledge`.

If (2) or (3) disagrees with (1), **the code wins**; treat stale prose as a doc bug.

## 3. Subscription gates (`BillingModule` and middleware)

`App\Billing\BillingModule` enum values are used as **`subscription.feature:{value}`** on tenant routes (see `routes/tenant.php`).

| Enum case | `->value` string | Typical paired `feature:*` flag (when used) |
| --- | --- | --- |
| DealEngine | `deal_engine` | `deal_engine` |
| Crm | `crm` | `crm` |
| Pipeline | `pipeline` | `pipeline` |
| Compliance | `compliance` | `compliance` |
| CarinaAi | `carina_ai` | `carina_ai` |
| MultiProperty | `multi_property` | `multi_property` |
| MentoringOs | `mentoring_os` | `mentoring_os` |
| CommunityLearning | `community_learning` | `community_learning` |
| Integrations | `integrations` | `integrations` |
| ReportingIntelligence | `reporting_intelligence` | `reporting_intelligence` |
| Accounting | `accounting` | `accounting` |
| Vcal | `booking_calendar` | `booking_calendar` |

Plan **module sets** (`starter`, `operator`, `mentor`, `trial_expanded`) live in `config/billing.php`. Stripe price env keys and checkout paths are there too.

## 4. Carina context model (tenant)

`carina_conversations.context_type` is validated for API-created threads; deep links set types in `CarinaController`.

**Critical:** `context_type` = `deal` uses **`deal_analyses.id`** as `context_id` for `startFromDeal`, not necessarily the pipeline deal row id.

Valid types include: `property`, `deal`, `deal_calculator`, `contact`, `investors_hub`, `pipeline`, `pipeline_deal`, `compliance`, `report`, `course`, `community_post`, `mentorship`, `journal_entry`, `vcal_booking`, and general chat (`null`). See `08-carina.md` and `CarinaController`.

## 5. AI stack (chat vs embeddings)

- **Chat provider order:** `config('ai.priority')` from env `AI_PRIORITY` (tenant BYOK can override via runtime resolution; see `23-ai-runtime-and-provider-registry.md`).
- **Embeddings:** OpenAI-compatible `/embeddings` only. Order: `config('ai.embedding_provider_priority')` from `AI_EMBEDDING_PROVIDER_PRIORITY`. **DeepSeek and Anthropic are not used for embeddings** in `AiRouterService`.
- **Tavily:** Optional web search; `18-carina-tavily-web-search.md`. Separate from RAG vectors.

## 6. Mechanical indexes (for exhaustive lookups)

| File | Contents |
| --- | --- |
| `60-artisan-and-scheduler-catalog.md` | Every `app/Console/Commands` Artisan signature + `routes/console.php` schedule |
| `61-eloquent-models-and-table-index.md` | Eloquent models and DB tables (central, tenant, RAG, Carina) |
| `62-jobs-and-events-catalog.md` | `app/Jobs` queue jobs + `app/Events` domain events |
| `63-config-php-inventory.md` | `config/*.php` files and env-driven keys (no secret values); points at repo `.env.example` |
| `64-api-route-consolidated.md` | Route knowledge **index** (links and counts); regenerate with `scripts/build-route-knowledge.py` |
| `65-platform-subscription-plans-admin.md` | Central subscription plan CRUD (renumbered from old `38-platform-*` to avoid duplicate `38` with `38-remote-access-and-support.md`) |
| `66-api-routes-tenant-subdomain.md` | Tenant subdomain route tables (`tenant.*`, `tenant.api.*`) |
| `67-api-routes-central-filament-misc.md` | Central, Filament, and other route tables |

## 7. Ingestion hint for operators

To make Carina **workspace-aware** of this codex:

```bash
php artisan rag:ingest-brain-knowledge --tenant=<slug> --fresh
php artisan rag:ensure-embedding-schema --tenant=<slug> --index-pending
```

Use an OpenAI-compatible embedding key in `AI_EMBEDDING_PROVIDER_PRIORITY` before expecting vectors.

## 8. Related knowledge (modules)

Architecture through UI: `01`, `02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `11`, `12`, `13`, `15`-`38`, `30`-`40`, `41`, `54`-`58`, UK practice `42`-`53`, `99`.
