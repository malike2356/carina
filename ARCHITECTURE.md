# Carina AI — Standalone Property Intelligence Platform

**Product:** Carina AI  
**Tagline:** The Brain for Property  
**Company:** VERLOX Ltd (UK)  
**Repository:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`  
**Status:** Pre-build — architecture & specification  
**Date:** 8 May 2026  

---

## Product DNA

Carina is a **property-specific AI platform** that lives independently in the cloud. She is trained on property data, speaks property fluently, and is accessible via web, mobile, PWA, and API. She is not a chatbot — she is an **intelligence layer** that any property application (Propreneur, Loom, third-party tools) can plug into via API, and that end users can talk to directly.

### The Separation

| | Carina Standalone (this product) | Carina Agent (in Propreneur) |
|---|---|---|
| **What it is** | The brain. Knowledge, analysis, advice. | The hands. Tools, actions, execution. |
| **Runs on** | Its own VPS | Inside Propreneur tenant |
| **Knows** | Property law, HMO licensing, tax, sourcing, deals, compliance, market data | Propreneur's specific tenant data (contacts, deals, pipeline) |
| **Does** | Answers, analyses, explains, forecasts, reports | Creates contacts, runs calculators, schedules sessions |
| **Relationship** | API provider | API consumer — calls standalone for intelligence |

---

## Architecture: Laravel Frame + Python ML Brain

```
┌──────────────────────────────────────────────────────────────────┐
│                  CARINA STANDALONE                                │
│                                                                  │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   LARAVEL APP         │    │   PYTHON ML ENGINE           │   │
│  │   (PHP 8.3+)          │    │   (FastAPI + Celery)         │   │
│  │                       │    │                              │   │
│  │  ┌─────────────────┐  │    │  ┌────────────────────────┐ │   │
│  │  │ Web UI (Blade)  │  │    │  │ Model Serving          │ │   │
│  │  │ PWA (service     │  │──►│  │ - Valuation prediction │ │   │
│  │  │      worker)     │  │    │  │ - Area scoring         │ │   │
│  │  ├─────────────────┤  │    │  │ - Portfolio analysis    │ │   │
│  │  │ REST API         │  │    │  │ - Trend detection       │ │   │
│  │  │ /v1/*            │  │    │  │ - Custom fine-tuning    │ │   │
│  │  ├─────────────────┤  │    │  │ - PDF/OCR extraction    │ │   │
│  │  │ Auth + Tenancy   │  │    │  └────────────────────────┘ │   │
│  │  │ (stancl/tenancy) │  │    │  ┌────────────────────────┐ │   │
│  │  ├─────────────────┤  │    │  │ Batch Processing        │ │   │
│  │  │ Billing (Stripe) │  │    │  │ - Market data crunch    │ │   │
│  │  ├─────────────────┤  │    │  │ - Report generation      │ │   │
│  │  │ RAG Engine       │  │    │  │ - Daily digest          │ │   │
│  │  │ (pgvector)       │  │    │  └────────────────────────┘ │   │
│  │  ├─────────────────┤  │    └──────────────────────────────┘   │
│  │  │ BYOK Provider    │  │                                      │
│  │  │ Registry         │  │    ┌──────────────────────────────┐   │
│  │  ├─────────────────┤  │    │   MOBILE APPS                │   │
│  │  │ Queue (Redis)    │  │    │  ┌────────┐  ┌─────────────┐│   │
│  │  ├─────────────────┤  │    │  │ Android│  │ iOS (Swift) ││   │
│  │  │ Admin Panel      │  │    │  │(Kotlin)│  │             ││   │
│  │  │ (Filament)       │  │    │  └────────┘  └─────────────┘│   │
│  │  └─────────────────┘  │    └──────────────────────────────┘   │
│  └──────────────────────┘                                        │
│                                                                  │
│  INFRASTRUCTURE (Single VPS or Docker Compose)                    │
│  ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐   │
│  │Postgres│ │  Redis  │ │Meilisearch│ │  Nginx  │ │  Python   │   │
│  │  + vec │ │        │ │          │ │        │ │ Workers   │   │
│  └────────┘ └────────┘ └──────────┘ └────────┘ └───────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Why Laravel for the frame

Already-built and proven in Propreneur:
- Multi-tenancy (stancl/tenancy) — database-per-tenant
- Multi-provider AI routing — `AiRouterService`, `AiRuntimeResolutionService`
- RAG engine — pgvector, chunking, embedding, retrieval
- Agent loop — `CarinaAgentService`, `CarinaToolRegistry`
- Filament admin panels — knowledge management, usage dashboards
- Stripe billing — subscription plans, feature gating
- BYOK system — runtime config merge from DB
- Type-safe HTTP layer — validation, middleware, permissions, audit

Rewriting these in Python gains nothing and costs months.

### Why Python for ML

Python owns everything that needs actual data science:
- **Model serving** — PyTorch, scikit-learn, XGBoost models for valuation prediction, area scoring, risk assessment
- **Batch analysis** — pandas/numpy on large datasets (market trends, portfolio health)
- **PDF extraction** — advanced OCR and document parsing
- **Fine-tuning** — custom property-specific models trained on opt-in user data
- **Reporting** — programmatic report generation with matplotlib/seaborn/plotly

### Communication

```
Laravel ───HTTP/gRPC───► Python (FastAPI)
                           │
                    Celery Workers (background)
                           │
                    Postgres (shared or own)
```

Python stores ML results back in Postgres. Laravel reads and serves them via API.

---

## Stack

| Layer | Technology | Why |
|---|---|---|
| **Framework** | Laravel 12 (fork or new) | Proven multi-tenancy, RAG, agent loop |
| **PHP** | 8.3+ | Type safety, performance |
| **Python** | 3.12+ | ML ecosystem |
| **Python Web** | FastAPI + Celery | Async, auto-docs, task queue |
| **ML** | PyTorch, scikit-learn, numpy, pandas | Property modelling |
| **Embeddings** | Google Gemini / OpenAI | Already configured |
| **Chat** | DeepSeek V4 Flash / Anthropic / whatever BYOK | Multi-provider chain |
| **Database** | PostgreSQL 16 + pgvector | RAG + tenant isolation |
| **Cache/Queue** | Redis | Session, job queue, rate limits |
| **Search** | Meilisearch | Document indexing |
| **Frontend** | Blade + Alpine + Tailwind v4 | Propreneur's existing frontend stack |
| **Mobile** | PWA first, then Kotlin (Android) + Swift (iOS) | Phase 1: PWA. Phase 2: native. |
| **PWA** | Service worker + manifest | Offline knowledge cache, home screen install |
| **Admin** | Filament | Already built and battle-tested |
| **Billing** | Stripe | Already integrated |
| **Auth** | Laravel Sanctum (API) + Password (Web) + OAuth (social) | API tokens for third-party agent connections |

---

## Multi-Tenancy Model

Same pattern as Propreneur: **database-per-tenant** via stancl/tenancy v3.

### Tenant Types

| Type | Description | Data Isolation |
|---|---|---|
| **Individual** | Single user, personal knowledge base | Own tenant DB |
| **Team** | Multiple users, shared knowledge base | Shared tenant DB |
| **Enterprise** | Multiple teams, hierarchical access | Tenant DB + team schema |
| **API Client** | App/agent with API key, no UI | Lightweight tenant (no DB, just key) |

### Tenant Onboarding

1. User signs up → tenant DB created → central DB row created.
2. Default knowledge seed: curated property knowledge base (from Propreneur's brain/knowledge/*).
3. User uploads own documents → RAG pipeline processes them.
4. Optional: user provides API key (BYOK) → runtime merge.

---

## Features — Full Breakdown

### 1. Web UI (Blade + Alpine + Tailwind v4)

| Page | Purpose |
|---|---|
| `/chat` | Full-page Carina conversation. Agent mode if enabled. |
| `/chat/{conversation}` | Threaded conversation view. |
| `/knowledge` | Browse, search, and manage your uploaded knowledge. |
| `/knowledge/upload` | Upload PDF, DOCX, markdown, URL. |
| `/knowledge/{id}` | View a document's chunks and embeddings. |
| `/analytics` | Portfolio analysis, deal comparison, market trends. |
| `/settings` | Profile, BYOK config, AI provider selection, theme. |
| `/settings/billing` | Subscription plan, usage, invoices. |
| `/settings/api-keys` | Generate and revoke API keys for agent connections. |
| `/settings/data` | Opt-in/opt-out for continuous learning. Export/delete data. |
| `/login`, `/register`, `/password/reset` | Standard auth. |
| `/admin/*` | Filament admin panel (super-admin only). |

### 2. PWA

| Feature | Detail |
|---|---|
| Service worker | Caches app shell and base knowledge for offline |
| Home screen install | Android/iOS add-to-home-screen |
| Push notifications | Background messages from Carina (digests, alerts) |
| Offline mode | Carina answers from cached knowledge when offline |

### 3. Mobile Apps (Phase 2)

| Platform | Language | Notes |
|---|---|---|
| Android | Kotlin + Jetpack Compose | Thin client — most processing server-side |
| iOS | Swift + SwiftUI | Same — thin client |

Mobile app screens: Chat, Knowledge Browser, Settings, Simple Dashboard.

### 4. API

| Endpoint | Method | Purpose |
|---|---|---|
| `POST /v1/chat` | Send message, get reply | Main chat interface |
| `POST /v1/chat/stream` | SSE streaming chat | Real-time response |
| `GET /v1/conversations` | List conversations | History |
| `POST /v1/query` | Direct knowledge query (no chat) | Programmatic RAG |
| `POST /v1/embed` | Get embedding for text | For external RAG |
| `GET /v1/knowledge/search` | Search your knowledge base | Direct access |
| `POST /v1/knowledge/upload` | Upload a document | Training |
| `POST /v1/analyze/deal` | Analyse a property deal | Calculator-style |
| `POST /v1/analyze/portfolio` | Analyse a portfolio | Portfolio health |
| `POST /v1/analyze/area` | Area market analysis | Trends and scoring |
| `GET /v1/usage` | Get usage stats | API consumption |
| `POST /v1/train` | Submit content for continuous learning | Opt-in only |

All endpoints require `Authorization: Bearer {api_key}`. Rate-limited per API key.

### 5. Multi-Provider AI (BYOK)

Same architecture as Propreneur's `AiRouterService`:

```
User message
     ↓
AiRuntimeResolutionService::resolve(tenantId)
     ↓
Merges: DB platform_settings?? .env ?? defaults
     ↓
Tries providers in priority order:
  1. Anthropic (tool_use native)
  2. Groq (if key set)
  3. DeepSeek (if key set)
  4. OpenRouter (if key set)
  5. OpenAI (if key set)
  6. Google Gemini (if key set)
     ↓
Fallback chain — if one fails, try next
     ↓
Return response + provider_used + token usage
```

**Provider types:**
- **Chat** — LLM providers
- **Embedding** — OpenAI-compatible `/embeddings` endpoints (Google Gemini, OpenAI, Groq)
- **Image** — Image generation (DALL-E, Imagen)
- **Speech** — Speech-to-text (Whisper, Groq)

All configurable per tenant. Tenant can bring their own keys or use platform-provided keys (billed at cost + margin).

### 6. RAG (Bring Your Own Content)

Same architecture as Propreneur's RAG:

```
Upload document (PDF, DOCX, TXT, MD, URL, audio)
     ↓
Document chunker (config/carina.php: chunk_size, chunk_overlap)
     ↓
EmbeddingService::getEmbedding(text)
     ↓
Store on rag_chunks (tenant DB) with vector embedding
     ↓
On query:
  Embed query → search rag_chunks via IVFFlat index → top-k results
     ↓
Inject into LLM system prompt as context
```

**Maximum document sizes:**
- Free tier: 10 documents, 50 MB total
- Pro tier: 500 documents, 5 GB total
- Enterprise: unlimited

**Supported formats:**
| Format | Extraction |
|---|---|
| PDF | pdftotext + OCR fallback |
| DOCX | python-docx or native parsing |
| Markdown | Direct read |
| Plain text | Direct read |
| URL | Jina Reader / Tavily / direct fetch |
| YouTube | Transcript extraction |
| Audio | Whisper transcription (Groq/OpenAI) |
| Images | OCR (future) |

**Document sources:**
- Manual upload
- URL fetch (public pages)
- RSS feed subscription (daily: embed latest)
- API push (`POST /v1/knowledge/upload`)
- Email-to-knowledge (forward to a Carina email)

### 7. Continuous Learning

Users can **opt in** to have their conversations and uploaded data used for model improvement.

**Opt-in levels:**
| Level | What's shared | What Carina gets |
|---|---|---|
| None | Nothing | No improvement from this user |
| Conversation only | Anonymised chat logs | Better response quality |
| Full training | Anonymised data + feedback scores | Fine-tuning + response quality |

**Privacy:**
- All data anonymised before any training pipeline
- Tenant isolation means data is NEVER shared between tenants
- API call payloads are never used for training of public models (only tenant's private fine-tune)
- Full GDPR data export/deletion on request

### 8. Agent Integration API

This is the bridge. External agents (Propreneur's Carina Agent, third-party apps) call Carina Standalone for intelligence.

**Agent flow:**
```
Propreneur Agent                Carina Standalone
       │                              │
       │── POST /v1/chat ────────────►│  "What's the yield on this BTL?"
       │   {message, context, tools}  │
       │                              │── RAG search
       │                              │── LLM call (BYOK chain)
       │                              │
       │◄── {reply, sources, tokens} ─│
       │                              │
       │── Run tool locally ──────►   │  "Run the calculator"
       │                              │
       │── POST /v1/chat ────────────►│  "Here's the BTL output"
       │   {tool_result}              │
       │                              │── LLM summarises
       │◄── {reply} ─────────────────│
```

This is already how Propreneur's agent loop works. The difference: instead of CarinaService doing local RAG + LLM, it calls the Standalone API.

---

## Python ML Engine

### Services

| Service | Framework | What It Does |
|---|---|---|
| `api` | FastAPI | HTTP interface. Routes ML requests from Laravel. |
| `models` | PyTorch / sklearn | Property valuation model, area scoring model, risk model. |
| `analytics` | pandas + numpy | Portfolio analysis, sensitivity analysis, what-if scenarios. |
| `reports` | matplotlib + weasyprint | PDF report generation (deal packs, area reports). |
| `ingestion` | Celery + python-docx + pdftotext | Document processing, OCR, structured extraction. |
| `training` | PyTorch + Optuna | Fine-tuning pipeline (opt-in user data). |

### ML Models (Roadmap)

| Model | Input | Output | Priority |
|---|---|---|---|
| Property Valuation | Address, specs, area data | Predicted market value + confidence | P1 |
| Area Score | Postcode, radius | Investment score (1-100) | P1 |
| Risk Assessment | Deal figures, area data | Risk rating + risk factors | P1 |
| Rental Yield Forecast | Property specs, area trends | Yield projection over 1-5 years | P2 |
| Portfolio Optimiser | Multiple properties | Sell/hold/buy recommendations | P2 |
| Compliance Risk | Property type, council, licence status | Non-compliance probability | P3 |
| Sentiment Analysis | News, council minutes, social | Market sentiment indicator | P3 |

### Batch Processing

Celery scheduled tasks:
- **Daily market digest** — Scrape Rightmove/Zoopla updates, generate area trends
- **Weekly portfolio report** — Analyse opt-in users' portfolios, email report
- **Monthly model retrain** — Retrain on opt-in data + new market data
- **Knowledge ingestion** — Process RSS feeds and URL subscriptions

---

## Billing & Pricing

Token-based metering (Cursor-style). Every AI request consumes tokens from a monthly allowance. See `architecture/BILLING_USAGE_METERING.md` for full schema, multipliers, and metering algorithm.

| Tier | Price/mo | Tokens/mo | API Calls/mo | Train My AI | BYOK | Team | White-Label |
|---|---|---|---|---|---|---|---|
| **Free** | £0 | 5,000 | 100 | ❌ | No | 1 user | No |
| **Pro** | £20 | 50,000 | 1,000 | ❌ | No | 1 user | No |
| **Pro+** | £60 | 150,000 | 3,000 | ✅ | No | 3 users | No |
| **Ultra** | £100 | 250,000 | 5,000 | ✅ | Yes | 10 users | No |
| **Enterprise** | £200 | 500,000 | 10,000 | ✅ | Yes | Unlimited | ✅ |

**Annual discount:** 25% off (pay 9 months, get 12).

**On-demand top-ups** (for paid tiers when monthly allowance runs out):
- Small: £3 / 5,000 tokens
- Medium: £12 / 25,000 tokens
- Large: £40 / 100,000 tokens
- Mega: £150 / 500,000 tokens

**Provider multipliers** (adjust token cost by provider):
- DeepSeek: 1.0× (primary — cheapest)
- OpenAI: 2.0×
- Anthropic: 3.5×
- Google Gemini: 1.5×

---

## Data Privacy & Continuous Learning

### Privacy-First Architecture

1. **All user data is tenant-isolated** by database-per-tenant. No tenant can access another's data.
2. **API call logs** are ephemeral (retained for billing only, 90-day rolling window).
3. **Continuous learning** is opt-in only at the account level. Off by default.
4. **Opt-in data is anonymised** before entering any training pipeline. Personal identifiers stripped.
5. **Fine-tuned models** are per-tenant (if tenant opts in, their data trains a private adapter, not the public base model).
6. **GDPR compliance:** Export all data on request. Hard-delete account and all tenant databases on request.

---

## Deployment

| Environment | Where |
|---|---|
| **Production (MVP)** | Contabo VPS (shared with Propreneur) — Docker Compose. £0 extra until Carina revenue justifies dedicated server. |
| **Staging** | Same VPS, separate Docker stack |
| **Dev** | Local machine — `artisan serve` + Python venv |

### Services (Docker)

| Service | Image | Port |
|---|---|---|
| `laravel` | Custom PHP 8.3 | 8000 |
| `python-api` | Custom Python 3.12 | 8001 |
| `celery-worker` | Same Python image | — |
| `celery-beat` | Same Python image | — |
| `postgres` | pgvector/pg16 | 5432 |
| `redis` | Redis 7 | 6379 |
| `meilisearch` | Meilisearch latest | 7700 |
| `nginx` | Nginx | 80, 443 |

---

## Development Phases

See `BUILD_SEQUENCE.md` for the authoritative step-by-step build order (61 steps, 14 phases). Summary:

| Phase | Weeks | Deliverables |
|---|---|---|
| **P0: Foundation** | 1-2 | Fork Laravel, auth, tenancy, Docker on Contabo VPS |
| **P1: Chat + AI** | 3-5 | Chat API, multi-provider routing, RAG, Agent Bridge |
| **P2: Web + PWA** | 6-8 | Full web UI, PWA, streaming in browser |
| **P3: Billing** | 8-10 | Token metering, Stripe, top-ups, usage dashboard |
| **P4: Knowledge** | 11-13 | Document upload, URL/audio training, content generation |
| **P5: ML Engine** | 11-15 | FastAPI, valuation/area/risk models, batch processor |
| **P6: Data APIs** | 14-16 | PropertyData, Tavily, EPC auto-ingestion |
| **P7: Community** | 16-19 | Groups, sharing consent, workspaces, expert network |
| **P8: Gamification** | 18-20 | Contribution levels, token rewards, referral programme |
| **P9: Image Gen** | 19 | DALL-E 3 / Imagen / Stable Diffusion via ImageRouter |
| **P10: Integrations** | 19-21 | Slack bot, WhatsApp bot, webhooks |
| **P11: Mobile** | 20-26 | Android (Kotlin) + iOS (Swift) native apps |
| **P12: Learning** | 22-24 | Per-tenant LoRA fine-tuning, opt-in pipeline |
| **P13: Docs + SDKs** | 20-26 | Public docs, API playground, Python/JS/PHP SDKs |

**First paying users: Week 10. Public beta: Week 8. Full ship: Week 26.**

---

## Cost to Run (Monthly, Single VPS)

| Item | Cost |
|---|---|
| VPS (Contabo Cloud VPS M, 8 vCPU, 16 GB RAM, 400 GB — shared with Propreneur MVP) | ~£25/mo (already running) |
| Domain + SSL | ~£2 |
| Stripe fees | 1.4% + 20p |
| AI API costs (if using platform keys) | Usage-dependent |
| Google Gemini embeddings | ~£0.01/1M tokens (negligible) |
| DeepSeek chat (if platform key used) | Volumes, ~£0.14/M input |
| **Total fixed** | **~£30-50/month** |

---

## Project Structure

```
Carina-ai/
├── laravel/                    # Laravel application
│   ├── app/
│   │   ├── Carina/             # Carina engine (extracted from Propreneur)
│   │   │   ├── AiRouterService.php
│   │   │   ├── CarinaAgentService.php
│   │   │   ├── CarinaToolRegistry.php
│   │   │   ├── CarinaService.php
│   │   │   └── Tools/
│   │   ├── Http/
│   │   │   ├── Controllers/
│   │   │   │   ├── Api/        # REST API for agents
│   │   │   │   ├── Web/        # Web UI controllers
│   │   │   │   └── Admin/      # Filament admin
│   │   ├── Models/
│   │   │   ├── Central/        # Central DB models
│   │   │   └── Tenant/         # Tenant DB models
│   │   ├── Services/
│   │   │   ├── Rag/            # RAG pipeline
│   │   │   ├── Billing/        # Stripe subscriptions
│   │   │   └── Training/       # Continuous learning
│   ├── brain/
│   │   ├── knowledge/          # Default property knowledge (port from Propreneur)
│   │   └── prompts/            # System prompts
│   ├── config/
│   │   ├── carina.php
│   │   ├── ai.php
│   │   └── billing.php
│   ├── database/
│   │   └── migrations/
│   ├── resources/
│   │   ├── views/
│   │   ├── js/
│   │   └── css/
│   ├── routes/
│   │   ├── api.php
│   │   ├── web.php
│   │   └── admin.php
│   ├── tests/
│   └── docker/
│
├── python/                     # Python ML engine
│   ├── app.py                  # FastAPI entry point
│   ├── models/
│   │   ├── valuation.py        # Property valuation model
│   │   ├── area_scoring.py     # Area investment score
│   │   └── risk.py             # Deal risk assessment
│   ├── analytics/
│   │   ├── portfolio.py        # Portfolio analysis
│   │   └── sensitivity.py      # What-if scenarios
│   ├── ingestion/
│   │   └── document_parser.py  # Advanced document extraction
│   ├── training/
│   │   └── fine_tune.py        # Per-tenant fine-tuning
│   ├── tasks.py                # Celery tasks
│   ├── requirements.txt
│   └── Dockerfile
│
├── mobile/
│   ├── android/                # Kotlin Android app
│   └── ios/                    # Swift iOS app
│
├── docker/
│   ├── Dockerfile.laravel
│   ├── Dockerfile.python
│   └── docker-compose.yml
│
├── architecture/               # Full specification documents (31 docs)
│   ├── API_SPEC.md
│   ├── API_VERSIONING_WEBHOOKS_DEPS.md
│   ├── BILLING_USAGE_METERING.md
│   ├── COMMUNITY_COLLABORATION.md
│   ├── COMMUNITY_MECHANICS.md
│   ├── DATA_INTEGRATIONS.md
│   ├── DATA_SHARING_CONSENT.md
│   ├── DOCS_ACCESSIBILITY_FUTURE.md
│   ├── EMAIL_NOTIFICATIONS.md
│   ├── ERROR_HANDLING.md
│   ├── GAMIFICATION_LOYALTY_REFERRALS.md
│   ├── GAP_ANALYSIS.md
│   ├── IMAGE_GENERATION.md
│   ├── INFRASTRUCTURE.md
│   ├── LOGGING_FEATURE_FLAGS.md
│   ├── ML_PIPELINE.md
│   ├── ONBOARDING_ACTIVATION.md
│   ├── PERFORMANCE_SCALING.md
│   ├── PLAN_DIFFERENTIATION.md
│   ├── PREPAID_TOKENS.md
│   ├── PRIVACY_SECURITY.md
│   ├── PROVIDER_ROTATION.md
│   ├── RESILIENCE_FAILURE_MODES.md
│   ├── ROADMAP.md
│   ├── SECURITY_CYBER_FORENSICS.md
│   ├── TESTING_CI_CD.md
│   └── 100-REVENUE-OPPORTUNITIES.md
│
├── prompts/
│   └── project-prompt.md       # Quick-start context for AI-assisted dev
│
├── ARCHITECTURE.md             # This file — full system design
├── BUILD_SEQUENCE.md           # Step-by-step build order (authoritative)
├── CODING_STANDARDS.md         # 7 coding principles, naming, testing
├── INVESTMENT_PROPOSAL.md      # Business case + financial projections
├── SESSION_SUMMARY.md          # Decision log from founding session
└── README.md                   # Master index — start here
```


## Feature Gating by Plan

| Feature | Free | Pro | Pro+ | Ultra | Enterprise |
|---|---|---|---|---|---|
| Chat with Carina | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deal analysis | ✅ | ✅ | ✅ | ✅ | ✅ |
| Area reports | ❌ | ✅ (5/mo) | ✅ (20/mo) | ✅ (Unlimited) | ✅ |
| Knowledge upload (Train My AI) | ❌ | ❌ | ✅ | ✅ | ✅ |
| Document uploads | ❌ | 10 docs | 100 docs | 500 docs | Unlimited |
| BYOK (Bring Your Key) | ❌ | ❌ | ❌ | ✅ | ✅ |
| API access | ❌ | ✅ | ✅ | ✅ | ✅ |
| White-label branding | ❌ | ❌ | ❌ | ❌ | ✅ |
| On-demand top-ups | ❌ | ✅ | ✅ | ✅ | ✅ |
| Spending controls | ❌ | ✅ | ✅ | ✅ | ✅ |
| Usage dashboard | ✅ | ✅ | ✅ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ | ✅ |

## Data Integrations (Auto-Ingesting)

Carina connects to live property data platforms and **automatically stores every response into RAG**:

| Platform | Data | Auto-Ingests |
|---|---|---|
| PropertyData.co.uk | Area metrics, yields, sold prices, planning | Always |
| Tavily | Web search — news, regulation changes, trends | Always |
| EPC API | Energy certificates, ratings, improvement costs | Always |
| Land Registry | Official sold prices (planned) | Always |
| Google Maps | Amenities, transport, schools (planned) | Always |

**How it works:** Every API response is LLM-analysed into structured knowledge, chunked, embedded, and stored in the tenant's pgvector database. The next time anyone asks about that area, Carina answers from RAG without calling the API again.

**Effect:** After 6 months, 95% of queries are answered from stored knowledge. Carina gets smarter with every user interaction.

See `architecture/DATA_INTEGRATIONS.md` for full pipeline implementation.
