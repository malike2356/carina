# Carina AI Assistant

**Updated:** 2026-05-14 (added: Carina agent mode, platform training UI, CarinaWidgetController, rate limits config, carina_ui_help.php, cross-links to 108-lead-funnel; voice input wavelength/spectrum UI requirement documented)

## Overview

Carina is the embedded AI assistant inside Propreneur. It is a chat interface that provides investment analysis, property insights, deal evaluation, and general UK property knowledge. Carina uses a multi-provider architecture with a priority-based fallback chain.

**Carina mode split:**
- **Carina AI** (`BillingModule::CarinaAi`): standard chat + RAG - available on all plans.
- **Carina Agent** (`BillingModule::CarinaAgent`): tool-calling multi-step mode - Professional+ plans. Enables Carina to call system tools (search contacts, look up deals, create pipeline deals, close deals, etc.). See **`brain/knowledge/78-carina-agentic-architecture.md`** for the 12+ live tools and destructive tool gates.

**Service:** `App\Services\Carina\CarinaService`  
**Agent mode service:** `App\Services\Carina\CarinaAgentService` (tool-calling multi-step, Professional+ plans)  
**Routes:** `tenant.carina.*` (tenant); `admin.carina.*` (platform users on central domain - see `brain/knowledge/20-platform-carina-and-public-theme-endpoints.md`)  
**Filament (tenant DB admin):** `/filament` - RAG documents, Carina conversations, system prompts; workspace picker + `FilamentWorkspaceTenancy` - see **`brain/knowledge/26-filament-carina-rag-admin.md`**  
**Platform training UI:** `/admin/carina/knowledge-training` - upload documents, OCR, PDF, ZIP processing, AV scan, RAG queue  
**Config:** `config/ai.php` (`carina_persona`, `carina_product_inventory`, providers, Tavily, embeddings), `config/carina.php` (rate limits, RAG chunks, retention, masterbrain path, training options), `config/carina_ui_help.php` (UI help text)  
**Full system codex (ingest for smartest answers):** **`59-carina-propreneur-full-codex.md`** plus **`60`**-**`67`** (Artisan + schedule, models or tables, jobs + events, config index, **route index `64` + tenant/central route tables `66`/`67`**, subscription plan admin `65`)

## Architecture

### API Provider Chain

Carina tries providers in priority order until one responds. The live order comes from **`App\Services\Ai\AiRuntimeResolutionService`**: it starts from `config('ai.priority')`, merges **central `ai_providers`** and optional **tenant BYOK** (`tenant_ai_settings`), and may prepend platform or tenant default (see **`brain/knowledge/23-ai-runtime-and-provider-registry.md`**).

Default env string (when not overridden):

```php
env('AI_PRIORITY', 'deepseek,anthropic,groq,openrouter,openai,google')
```

If a provider's API key is missing or returns an error, Carina falls back to the next in the chain.

### Providers

Defaults and env keys live in `config/ai.php`. Platform-wide overrides for keys and routing also live in central **`platform_settings`** (see **Admin → Platform keys**).

| Provider | Env key (fallback) | Default model (`config/ai.php`) | Notes |
|----------|--------------------|----------------------------------|--------|
| Anthropic | `ANTHROPIC_API_KEY` | `claude-sonnet-4-6` | Primary analysis |
| Groq | `GROQ_API_KEY` | `llama-3.3-70b-versatile` | Fast inference |
| DeepSeek | `DEEPSEEK_API_KEY` | `deepseek-v4-flash` | Also `pro_model` / `reasoner_model` in config |
| OpenRouter | `OPENROUTER_API_KEY` | `anthropic/claude-3.5-haiku` | Multi-model gateway |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` | Fallback chain member |
| Google (Gemini) | `GOOGLE_AI_API_KEY` | `gemini-2.0-flash` | OpenAI-compatible endpoint in config; invoked like other non-Anthropic providers |

**Cost estimates:** `config('ai.pricing_usd_per_million')` supports usage dashboards; not legal pricing for end customers.

**Runtime and DB registry:** `brain/knowledge/23-ai-runtime-and-provider-registry.md`.
### Rate limits

Configured in `config/carina.php`:
- `CARINA_RATE_TENANT_HOURLY` (default 500): max requests per tenant per hour
- `CARINA_RATE_TENANT_DAILY` (default 5000): max requests per tenant per day
- `CARINA_RATE_USER_HOURLY` (default 100): max requests per user per hour
- `CARINA_RATE_USER_DAILY` (default 1000): max requests per user per day

Redis tracks counters with per-window TTLs. `RateLimitExceededException` (429) is thrown before the controller when a limit is hit.

### Platform Carina knowledge training (admin UI)

The `/admin/carina/knowledge-training` UI lets platform operators upload documents (PDF, images, text, ZIP) for Carina's knowledge base. Features:
- **OCR**: Tesseract binary (`CARINA_TRAINING_OCR`, `CARINA_TRAINING_TESSERACT_BINARY`)
- **PDF fallback extraction**: `pdftotext` binary (`CARINA_TRAINING_PDF_FALLBACK`)
- **AV scan**: ClamAV integration (`CARINA_TRAINING_CLAMSCAN_BINARY`)
- **ZIP handling**: max 25MB uncompressed, 40 entries max
- **Strict MIME enforcement**: optional toggle (`CARINA_TRAINING_MIME_STRICT`)
- **RAG queue**: uploaded documents are processed into `rag_chunks` via the standard pipeline

### Tavily web search (2026-04-30; behaviour notes 2026-05-02)

Optional **live web** snippets appended by `TavilyWebSearchService` into the system prompt when **`ai.tavily.enabled`** is true **and** an API key is set. The GUI-backed `platform_settings` row is the normal control path; `TAVILY_API_KEY` plus `CARINA_TAVILY_ENABLED` in `.env` remain bootstrap fallback only and are merged in `AppServiceProvider`. Keyword mode only runs the HTTP search when triggers match (unless trigger is `every_message`). Deal narrative uses `augmentForQuery` (no keyword gate).

Instructions tell the model to prefer **numbered source excerpts** over Tavily’s optional **Summary** line, cite URLs when relying on a source, and avoid asserting regulated credentials unless excerpts explicitly support them. Full ops detail: **`brain/knowledge/18-carina-tavily-web-search.md`**.

### Masterbrain (brain/masterbrain/)

Directory `brain/masterbrain/` contains Carina's operational prompt library - persona definitions (accountant, coach, COO, investor, legal, marketing, sales, etc.) organised per use-case role. These are not auto-ingested into tenant RAG; they feed the `carina_persona` and `carina_product_inventory` strings in `config/ai.php` and are referenced by `config/carina.php` key `masterbrain_path`.

Subdirectories: `accounting/`, `algorithms/`, `Carina_RAG/`, `contacts/`, `deals/`, `document_vault/`, `genius/brains/` (13 brain personas), `investor/`, `leads/`, `legal/`, `marketing/`, `process_and_workflow/`, `sales/`, `verification/`.

### Tenant vector RAG (uploaded documents)

**Important:** Markdown under `brain/knowledge/` is **developer and Carina-help documentation** in git. It is **not** auto-ingested into tenant pgvector tables.

Per-workspace **vector RAG** lives in the **tenant** database: `rag_documents` + `rag_chunks` (embeddings). Content arrives when a workspace **uploads** a file via Filament (`/filament` RAG UI) or **`POST /api/rag/documents`** (`tenant.api.rag.documents.upload`). Ingestion runs **`App\Jobs\Rag\ProcessDocumentJob`** (or **`BatchEmbeddingJob`** for large files). Retrieval is `App\Services\Carina\RAGService::retrieveContext` (hybrid search via `RagSearchService`; chat currently requests **5** chunks per turn). Chunking defaults in **`config/carina.php`** (`chunk_size` 1000, `chunk_overlap` 200; embedding `text-embedding-3-small`, 1536 dims).

Admin UI and model: **`brain/knowledge/26-filament-carina-rag-admin.md`**, **`brain/knowledge/00-README.md`** (RAG subsection).

### System prompt stack (persona + product map + style)

- **`config('ai.carina_persona')`** (`config/ai.php`): UK property focus; **only state facts supported** by workspace context, cited web excerpts, knowledge-base chunks, or user messages; otherwise omit or say you do not know. VERLOX attribution when asked who built the product.
- **Canonical product module inventory** (`config('ai.carina_product_inventory')`): appended for tenant and platform system prompts so “what features does Propreneur have?” stays aligned with the real 13-module map.
- **`CarinaService::appendCarinaOutputStyleDirective()`**: plain markdown; no fake `<search>` / tool XML; biography and regulated-role guardrails; helpful tone when the web is thin.
- **Session identity blocks** (signed-in tenant `User` / platform `PlatformUser`): name and email for self-identity questions; do not invent further biography from similar names on the public web.
- **Platform-only:** optional SCOUT JSON appendix and backup briefing appendix (see module completion section below).

## Chat System

### Conversation Model (`CarinaConversation`)

```php
class CarinaConversation extends Model
{
    protected $fillable = ['user_id', 'title', 'context_type', 'context_id', 'total_tokens'];
    
    public function user()      // belongsTo(User::class)
    public function messages()  // hasMany(CarinaMessage::class)
}
```

### Message Model (`CarinaMessage`)

```php
class CarinaMessage extends Model
{
    protected $fillable = [
        'carina_conversation_id', 'role', 'content',
        'input_tokens', 'output_tokens',
    ];
    
    public function conversation()  // belongsTo(CarinaConversation::class)
}
```

### Chat flow

```
User sends message →
CarinaService::chat(conversation, message) →
  Rate limits (tenant) →
  Builds message history from DB; appends user turn →
  buildSystemPrompt (persona + product inventory + session identity + context rows) →
  Optional RAG block (retrieveContext) →
  appendWebSearchContext (Tavily when enabled + triggers) →
  callWithFallback (Anthropic or OpenAI-compatible providers per AiRuntimeResolutionService) →
  finalizeAssistantReply (strip pseudo-tool markup; recover inner text if needed) →
  Persist messages when gate allows →
  Return assistant text (JSON for Blade/API)
```

**Errors:** `CarinaController` / `PlatformCarinaController` / `CarinaChatController` map common failures to **403** / **503** JSON with a `message` field where appropriate. Rate limits still use **`RateLimitExceededException`** (429) when thrown before the controller.

### Context-Aware Responses

`CarinaService::buildSystemPrompt()` reads `CarinaConversation` `context_type`, `context_id`, and `metadata` (array cast). Summary:

| `context_type` | `context_id` | System prompt behaviour (high level) |
|----------------|--------------|----------------------------------------|
| `property` | Property id | Address and property summary where role allows |
| `deal` | Deal analysis id | Deal title, strategy, metrics (gated for financial output) |
| `deal_calculator` | null | Metadata: `deal_calculator_slug`, `deal_calculator_kind`, optional `playground_last_run` |
| `contact` | Contact id | Contact type and safe summary |
| `pipeline` | Pipeline id | Pipeline name |
| `pipeline_deal` | Pipeline deal id | Kanban card title and stage context |
| `compliance` | Compliance item id | Item title and status |
| `report` | Report definition id | Saved report name |
| `course` | Course id | Course name (community learning) |
| `community_post` | Post id | Post title |
| `mentorship` | Mentorship relationship id | Relationship status |
| `journal_entry` | Journal entry id | GL journal lines, balances, property links (financial gates apply) |
| `vcal_booking` | Booking id | Event type, schedule, guest fields gated by role |
| null | null | General chat; **accounting hub** uses `metadata.accounting_hub` + `metadata.surface` (see below) |

**Accounting hub (no `context_type`):** conversations created by `GET /carina/open-accounting/{surface}` set `metadata` to `accounting_hub: true` and `surface` in `journals|chart|ledger|trial-balance|pnl`. `CarinaService` appends a live snapshot (active accounts, draft/posted journal counts) when the user may receive financial outputs.

**POST `/carina/conversations` (`tenant.carina.start`):** accepts optional `context_type` (subset validated in `CarinaController::startConversation`), `context_id`, `title`. Use this for programmatic or test starts (same validation as above). `deal_calculator` is not in this `in:` list; use GET `/carina/open-deal-calculator/{slug}` or POST `/carina/open-deal-calculator` for calculator threads.

### Standalone Completion Methods

**Deal Narrative Generation (`generateDealNarrative`):**

- Not tied to a conversation thread
- Takes a `DealAnalysis` object
- Generates 3-paragraph investment summary
- Returns text (not persisted - caller stores it)

**Quick Completion (`complete`):**

- One-shot query, no persistence
- Used for inline widgets and quick lookups

## Provider HTTP layer

Implementation: **`CarinaService::callWithFallback`**, **`callAnthropic`**, **`callOpenAiCompat`**. Anthropic requests use ephemeral **prompt caching** on the system block where supported; timeouts are set per provider in code (see service). Failed providers are logged and the chain continues; if all fail, a **`RuntimeException`** is thrown (surfaced as 503 in JSON chat endpoints).

## UI: Carina chat

Primary tenant views: **`resources/views/tenant/carina/index.blade.php`** (list) and **`resources/views/tenant/carina/show.blade.php`** (thread). Platform admin mirror: **`resources/views/central/admin/carina/show.blade.php`**.

Features:

- Conversation sidebar (list of previous chats)
- Chat message area (user + assistant bubbles), Markdown rendering for assistant content
- **Brain / response depth** row (saved per conversation via `PATCH` preferences or inline on send); `CarinaBrainModifierService` + `CarinaAccessGate`
- **Save transcript** links (Text / Markdown / JSON) calling `tenant.carina.transcript` or `admin.carina.transcript` with `?format=`
- **Voice input with live wavelength waveform (built 2026-05-14):** Tap mic icon → getUserMedia + MediaRecorder → a **real-time frequency spectrum canvas** renders the audio waveform as animated colour-coded bars (indigo at low intensity, shifting toward red at high intensity) during recording. The wavelength canvas replaces the textarea (hiding it so the composer stays clean) and the textarea reappears when recording stops. The waveform uses Web Audio API AnalyserNode (`fftSize: 256`) connected to the MediaStream source, drawn via `requestAnimationFrame` loop. Audio posts to `tenant.carina.speech-transcribe` or `admin.carina.speech-transcribe`; **`CarinaSpeechTranscriptionService`** calls OpenAI or Groq Whisper-compatible `audio/transcriptions`. Configure `OPENAI_API_KEY` or `GROQ_API_KEY` (and optional `AI_SPEECH_TRANSCRIPTION_PRIORITY`, default `openai,groq`). Implementation in `resources/js/carina-voice.js`; canvas in both `carina/show.blade.php` and `carina-floating-widget.blade.php`.
- **Floating widget:** authenticated tenant layout (`layouts/app`) shows a bottom-right Carina panel when Carina is in the nav; it lazy-loads **`GET /carina/widget/bootstrap`** (`tenant.carina.widget.bootstrap`) and chats against one **`floating_widget`** thread per user (`CarinaFloatingWidgetService`). Full Carina page routes hide the widget to avoid duplicate composers.
- Incognito (Section 15); headers **`X-Carina-Incognito`** on relevant API calls
- Typing indicator strip above composer; token usage where surfaced

**Export implementation:** `App\Services\Carina\CarinaTranscriptExportService`; controllers `downloadTranscript` on tenant, platform, and tenant API.

## Routes

Tenant host (`routes/tenant.php`). Blade UI and JSON API are gated by `feature:carina_ai` and subscription feature `carina_ai` (see `App\Billing\BillingModule::CarinaAi`).

### Blade (session UX)

| Method | URI | Name |
|--------|-----|------|
| GET | `/carina/conversations` | `tenant.carina.index` |
| POST | `/carina/conversations` | `tenant.carina.start` |
| POST | `/carina/speech-transcribe` | `tenant.carina.speech-transcribe` (multipart field `audio`; throttled) |
| GET | `/carina/widget/bootstrap` | `tenant.carina.widget.bootstrap` (JSON for layout floating panel; throttled) |
| PATCH | `/carina/conversations/{conversation}/preferences` | `tenant.carina.preferences` |
| POST | `/carina/conversations/{conversation}/messages` | `tenant.carina.message` |
| GET | `/carina/conversations/{conversation}/transcript` | `tenant.carina.transcript` (query `format=txt|md|json`; owner-only; throttled) |
| GET | `/carina/conversations/{conversation}` | `tenant.carina.show` |
| DELETE | `/carina/conversations/{conversation}` | `tenant.carina.destroy` |

### Tenant deep links (GET, same Carina middleware stack)

All under prefix `/carina/`, names `tenant.carina.from*`. Extra middleware on some routes matches module gates (e.g. accounting requires `subscription.feature:accounting`, `feature:accounting`, `tenant.accounting.permission:view`; viCal booking requires `subscription.feature` + `feature` for `Vcal`).

| Name | URI pattern | Purpose |
|------|-------------|---------|
| `tenant.carina.fromDeal` | `/carina/open-deal/{dealId}` | Deal analysis thread |
| `tenant.carina.fromDealCalculator` | `/carina/open-deal-calculator/{calculatorSlug}` | Calculator context |
| `tenant.carina.fromDealCalculator.post` | `/carina/open-deal-calculator` | Calculator with playground payload |
| `tenant.carina.fromProperty` | `/carina/open-property/{propertyId}` | Property thread |
| `tenant.carina.fromContact` | `/carina/open-contact/{contactId}` | CRM contact |
| `tenant.carina.fromPipelineDeal` | `/carina/open-pipeline-deal/{pipelineDealId}` | Kanban card |
| `tenant.carina.fromPipeline` | `/carina/open-pipeline/{pipelineId}` | Pipeline |
| `tenant.carina.fromCompliance` | `/carina/open-compliance/{complianceId}` | Compliance item |
| `tenant.carina.fromReport` | `/carina/open-report/{reportDefinitionId}` | Saved report definition |
| `tenant.carina.fromCourse` | `/carina/open-course/{courseId}` | Learning course |
| `tenant.carina.fromCommunityPost` | `/carina/open-community-post/{postId}` | Community post |
| `tenant.carina.fromMentorship` | `/carina/open-mentorship/{mentorshipId}` | Mentorship relationship |
| `tenant.carina.fromJournalEntry` | `/carina/open-journal-entry/{journalEntryId}` | GL journal (accounting gated) |
| `tenant.carina.fromAccountingHub` | `/carina/open-accounting/{surface}` | Accounting surface hub |
| `tenant.carina.fromVcalBooking` | `/carina/open-booking/{bookingId}` | viCal booking (host or admin) |

Deal narrative (not a conversation route): **POST** `tenant.deals.carina` on `/{deal}/carina-narrative` inside the deal engine route group; calls `generateDealNarrative`.

### JSON API (`/api/carina/*`)

| Method | URI | Name |
|--------|-----|------|
| POST | `/api/carina/chat` | `tenant.api.carina.chat` |
| POST | `/api/carina/chat/stream` | `tenant.api.carina.chat.stream` |
| GET | `/api/carina/conversations` | `tenant.api.carina.conversations` |
| DELETE | `/api/carina/conversations/clear` | `tenant.api.carina.conversations.clear` |
| GET | `/api/carina/conversations/{id}` | `tenant.api.carina.conversations.show` |
| GET | `/api/carina/conversations/{id}/transcript` | `tenant.api.carina.conversations.transcript` (`format=txt|md|json`) |
| DELETE | `/api/carina/conversations/{id}` | `tenant.api.carina.conversations.delete` |
| GET | `/api/carina/usage` | `tenant.api.carina.usage` |
| GET | `/api/carina/system-prompts` | `tenant.api.carina.system-prompts.index` |
| POST | `/api/carina/system-prompts` | `tenant.api.carina.system-prompts.store` |
| PUT | `/api/carina/system-prompts/{id}` | `tenant.api.carina.system-prompts.update` |
| DELETE | `/api/carina/system-prompts/{id}` | `tenant.api.carina.system-prompts.destroy` |
| POST | `/api/carina/system-prompts/{id}/default` | `tenant.api.carina.system-prompts.set-default` |
| GET | `/api/carina/settings` | `tenant.api.carina.settings` |
| PUT | `/api/carina/settings` | `tenant.api.carina.settings.update` |

### RAG JSON API (`/api/rag/*`)

See **`brain/knowledge/22-tenant-route-map.md`** and **`brain/knowledge/26-filament-carina-rag-admin.md`**. Route names: `tenant.api.rag.*`.

## Module completion (2026-05-01; refreshed 2026-05-03)

Carina AI is treated as **baseline-complete** for v2: multi-provider routing (`AiRouterService`, `AiRuntimeResolutionService`), `CarinaService` chat and streaming, `TokenTrackingService` / central usage logs, `RateLimitService` (Redis), `PromptCacheService`, tenant RAG pipeline (documents, chunks, pgvector, artisan commands), Section 14 `CarinaAccessGate`, Section 15 `CarinaIncognitoService`, platform staff Carina under `/admin/carina`, and super-admin anonymised benchmark `GET /admin/analytics/cross-tenant-benchmark`.

**Platform Carina appendices:**

- **Backups (2026-05-03):** `CarinaService::buildPlatformSystemPrompt()` appends a short, non-secret summary of recent central `backup_jobs` via `App\Services\Backup\BackupCarinaBriefing`. Detail: **`brain/knowledge/36-backup-disaster-recovery.md`**.
- **SCOUT (security console):** On `/admin/security/scout`, platform Carina chat calls `CarinaService::platformChat(..., $scoutSecurityAppend)` with a JSON posture snapshot. The system prompt gains SCOUT operating rules (remediation guidance, no live secrets, destructive-action warnings). Implementation: `App\Http\Controllers\Central\Admin\ScoutDashboardController`. Broader security posture: **`brain/knowledge/37-security-posture-and-scout.md`**.

Executable route checklist: `tests/Unit/Carina/CarinaModuleRoutesTest.php`. Prompt specs `brain/prompts/07-carina-core.md` and `08-carina-rag.md`: DB rate-limit table was not adopted (limits use Redis); otherwise endpoints and services align.

### Platform Carina transcript

Same pattern as tenant: **`GET /admin/carina/conversations/{conversation}/transcript`** (`admin.carina.transcript`), query `format=txt|md|json`, owner-only.

**Platform speech transcribe:** **`POST /admin/carina/speech-transcribe`** (`admin.carina.speech-transcribe`), multipart `audio`, same **`CarinaSpeechTranscriptionService`** as tenant (platform AI keys, `tenantId` null).

## Rebuilding tenant RAG embeddings

Commands live under **`App\Console\Commands\Rag`**. A **queue worker** (or Horizon) must be running so `ProcessDocumentJob` / `BatchEmbeddingJob` can finish embedding.

| Goal | Command |
|------|---------|
| Queue **all unindexed** documents across every tenant | `php artisan rag:index-pending` |
| Same for **one** central tenant (by UUID) | `php artisan rag:index-pending --tenant=<central-tenant-id>` |
| **Seed** one pending markdown file + `RagDocument` + `ProcessDocumentJob` (when nothing is pending) | `php artisan rag:create-starter-document` (optional `--tenant=<id-or-slug>`; default first active tenant) |
| **Bulk-ingest** git `brain/knowledge/*.md` into a workspace RAG corpus | `php artisan rag:ingest-brain-knowledge` (`--tenant=`, `--all`, `--fresh` to replace prior brain imports, `--sync` inline embed, `--limit=` for tests) |
| **Fix RAG schema** after `CREATE EXTENSION vector` (superuser once) | `php artisan rag:ensure-embedding-schema --tenant=<id-or-slug> --index-pending` |
| **Re-chunk and re-embed one** document inside a tenant DB | `php artisan tenants:run rag:reindex --tenants=<tenant-key> --argument=documentId=<id>` |
| Health: pgvector, schema | `php artisan carina:verify` |

**Filament:** `RagDocumentResource` exposes a per-row **Reindex** action (calls `RagIndexService::reindexDocument`). **API:** `POST /api/rag/documents/{id}/reindex` (`tenant.api.rag.documents.reindex`).

`rag:index-pending` only picks rows with **`indexed_at` null** (pending). Already-indexed corpora stay as-is until you **reindex** a document id or re-upload.

## Environment Variables

```
ANTHROPIC_API_KEY=
GROQ_API_KEY=
DEEPSEEK_API_KEY=
OPENROUTER_API_KEY=
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=
AI_PRIORITY=deepseek,anthropic,groq,openrouter,openai,google
AI_HTTP_CONNECT_TIMEOUT_SECONDS=5
AI_HTTP_TIMEOUT_SECONDS=25
```

## BYOK (Bring Your Own Key)

Tenants can configure their own API keys in the system settings. BYOK bypasses all platform caps and priority chains.

**Usage caps:**

- Trial tenants: 20 paid-tier messages before BYOK prompt
- Paid plan tenants: 50 paid-tier messages per month (platform-funded)
- Free models (Groq, Gemini, DeepSeek): unlimited
- BYOK: fully unlimited per tenant

## Security and incognito (2026-05-01)

### Section 14 role gates

`App\Services\Carina\CarinaAccessGate` centralises checks (RAG, uploads, financial outputs, chat persistence, brains). Property maths that expose cash flow to end users must use `PropertyCalculatorService::monthlyCashFlowForUser` / `annualCashFlowForUser` (not the raw `monthlyCashFlow` / `annualCashFlow` helpers) so `receiveFinancialOutputs` is enforced.

### Section 15 incognito (learning writes)

Session flag `carina.incognito` via `CarinaIncognitoService`. Code paths that skip durable learning when incognito:

- `RAGService::embedDocument`
- `RagIngestionService::ingestDocument` (does not dispatch `ProcessDocumentJob`)
- `BookkeepingService::learnFromCorrection` (skips masterbrain JSON writes)

Chat UX headers: `X-Carina-Incognito`; conversation metadata `incognito` drives shorter retention in `PruneOldConversations`.

### Cross-tenant benchmark (platform super admin)

`GET /admin/analytics/cross-tenant-benchmark` (`admin.analytics.cross-tenant-benchmark`), middleware `platform.super_admin`. Builds cohort rows from active central tenants and returns JSON via `CrossTenantAnalyticsAnonymiser::anonymiseCohortWithAudit` (minimum cohort size 5, PII stripped, structured audit log with hashed tenant ids only).

## Related

- Deal narratives: **POST** `tenant.deals.carina` (`/{deal}/carina-narrative`) uses `CarinaService::generateDealNarrative`
- **Human knowledge base (git):** `brain/knowledge/*.md` - maintain for operators and for future ingestion; **not** the same as tenant pgvector RAG unless you add a sync pipeline
- **Tenant RAG (vectors):** uploads + `rag:*` commands above; **`brain/knowledge/26-filament-carina-rag-admin.md`**
- Config: `config/ai.php` (persona, Tavily, product inventory), `config/carina.php` (RAG chunking, rate limits)
- Security posture and SCOUT console: **`brain/knowledge/37-security-posture-and-scout.md`**
