# Carina AI — Development Roadmap

**Last updated:** 8 May 2026  
**Total duration:** ~20 weeks to full ship  

---

## Phase 0: Foundation (Weeks 1-2)

**Goal:** Working standalone Laravel app with auth and tenancy

| Week | Task | Deliverable |
|---|---|---|
| 1 | Fork Laravel from Propreneur. Strip all module code (CRM, Pipeline, Deals, Accounting, Mentoring, viCal, Community, Reporting). Keep only: Auth, Tenancy, Carina engine, Config, Migrations, Admin panel. | Clean Laravel skeleton |
| 1 | Rename namespaces: `App\Services\Carina` → `App\Carina`. Remove Propreneur-specific billing modules. | Namespaced Carina engine |
| 1 | Set up `docker-compose.yml`: Laravel, PostgreSQL, Redis, Meilisearch, Python FastAPI. | Local dev environment |
| 2 | Set up Nginx config. Wildcard subdomain for multi-tenancy. | Working multi-tenant URLs |
| 2 | Stripe webhook endpoint. Basic subscription creation flow. | Stripe connected |
| 2 | Deploy to staging (Contabo VPS). Smoke test. | Staging environment live |

**Gateway:** `php artisan serve` shows Carina login page, not Propreneur.

---

## Phase 1: Chat + API (Weeks 3-5)

**Goal:** Users can chat with Carina. API works. Agent Bridge connects Propreneur.

| Week | Task | Deliverable |
|---|---|---|
| 3 | Port `CarinaService`, `AiRouterService`, `CarinaAgentService` from Propreneur. Wire up multi-provider routing (DeepSeek + OpenAI + Anthropic). | Chat engine working |
| 3 | Build `POST /v1/chat` and `POST /v1/chat/stream` endpoints. API key auth middleware. Rate limiting. | Chat API live |
| 3 | Port RAG pipeline (`RAGService`, `EmbeddingService`). pgvector tenant DB schema. | RAG working |
| 4 | Port knowledge docs from `brain/knowledge/` (95+ property docs). Run `rag:ingest-brain-knowledge`. | Carina knows property |
| 4 | Build Agent Bridge endpoint `POST /v1/agent/chat`. Test: Propreneur calls Carina Standalone for a deal analysis. | Agent Bridge working |
| 4 | Build `GET /v1/conversations`, `GET /v1/conversations/{id}`, `DELETE /v1/conversations/{id}`. | Conversation history API |
| 5 | Build `GET /v1/usage` — token counts, provider breakdown. | Usage API |
| 5 | Port Carina persona prompt. Tweak for standalone personality (no Propreneur references). | Carina persona refined |
| 5 | 20 unit tests for API endpoints. 10 integration tests for provider rotation. | Test suite |

**Gateway:** Propreneur's Carina Agent can be switched to call Carina Standalone API instead of local RAG.

---

## Phase 2: Web UI + PWA (Weeks 6-8)

**Goal:** Full web interface. Installable PWA.

| Week | Task | Deliverable |
|---|---|---|
| 6 | Login/register pages. Password reset. Email verification. | Auth UI |
| 6 | Chat page (`/chat`). Full-page conversation view. Streaming responses. | Chat UI |
| 6 | Conversation sidebar. History. Search conversations. | Conversation management |
| 7 | Knowledge management page (`/knowledge`). Upload, browse, search, delete. | Knowledge UI |
| 7 | Settings page (`/settings`): Profile, preferences, API keys, BYOK config. | Settings UI |
| 7 | Usage dashboard page (`/settings/usage`): Token gauge, spending, breakdown by provider, daily chart. | Usage UI |
| 8 | PWA manifest. Service worker. Offline caching (base knowledge, app shell). | PWA installable |
| 8 | Push notifications. Background message alerts. | PWA notifications |
| 8 | Responsive design. Mobile-first layout. Test on iPhone, Android, tablet. | Mobile-ready UI |

**Gateway:** Beta users can sign up and use Carina from their phone browser.

---

## Phase 3: Billing & Metering (Weeks 8-10)

**Goal:** Token-based metering. Subscription plans. On-demand top-ups. Usage dashboard.

| Week | Task | Deliverable |
|---|---|---|
| 8 | `UsageLog` table. Token counting middleware. Deduct tokens per request. | Metering core |
| 8 | Hard cap enforcement (Free tier). Block requests when allowance exhausted. | Free tier gating |
| 9 | Stripe subscription plans (Pro, Pro+, Ultra, Enterprise). Webhook handling. | Subscription flow |
| 9 | Mid-cycle proration. Upgrade/downgrade token calculations. | Plan changes |
| 9 | Annual discount logic (25% off). | Annual billing |
| 10 | On-demand top-up bundles (Small £3, Medium £12, Large £40, Mega £150). | Top-up flow |
| 10 | Spending cap controls (user-set monthly limit). Warning emails at 50%/80%/90%/100%. | Spending controls |
| 10 | Usage dashboard in web UI. Token gauge. Daily chart. Spending breakdown. | Dashboard live |

**Gateway:** Carina is a real business. Users can pay.

---

## Phase 4: Knowledge & Training (Weeks 11-13)

**Goal:** Document upload, RAG pipeline, content generation features.

| Week | Task | Deliverable |
|---|---|---|
| 11 | PDF upload + text extraction. DOCX, TXT, MD support. | Document ingestion |
| 11 | URL fetch training (paste a URL, Carina reads and learns it). | URL training |
| 12 | Audio transcription (Whisper via Groq/OpenAI). Train from audio recordings. | Audio training |
| 12 | Knowledge search UI. Browse by document. Delete individual documents. | Knowledge management |
| 13 | Content generation: property descriptions, area guides, social media posts. | Content tools |
| 13 | Deal pack PDF generator. | Report generation |

**Gateway:** Pro+ users can upload their portfolio docs and ask Carina questions about their specific properties.

---

## Phase 5: Python ML Engine (Weeks 11-15, parallel with Phase 4)

**Goal:** ML models running. Area intelligence. Portfolio analysis.

| Week | Task | Deliverable |
|---|---|---|
| 11 | FastAPI scaffold. Connection to shared PostgreSQL. Health endpoint. | Python service live |
| 11 | Celery worker + Redis queue. Background job processing. | Job queue |
| 12 | Property valuation model (XGBoost). Train on synthetic sample data. | Valuation API |
| 12 | Area scoring model. Multi-factor: yield, growth, rental demand, development activity. | Area score API |
| 13 | Deal risk assessment. Rule-based + ML hybrid. | Deal risk API |
| 14 | Portfolio analysis service. Aggregate deal analysis across multiple properties. | Portfolio API |
| 14 | Batch processor: daily market digest, weekly portfolio report. | Scheduled jobs |
| 15 | PDF report generation (area reports, deal packs) via Python (weasyprint/matplotlib). | PDF reports |

**Gateway:** Carina can analyse a portfolio, score an area, or value a property — not just chat about it.

---

## Phase 6: Integrations (Weeks 14-16)

**Goal:** Slack, WhatsApp, webhooks. Carina goes where users already work.

| Week | Task | Deliverable |
|---|---|---|
| 14 | Slack bot: message Carina from Slack. Thread replies. | Slack integration |
| 15 | WhatsApp bot: message Carina via WhatsApp (Twilio / WhatsApp Business API). | WhatsApp integration |
| 15 | Webhooks: notify external systems when analysis completes, when token limit approaches, when documents finish processing. | Webhook system |
| 16 | Zapier / Make.com integration. Carina as a trigger and action. | Low-code integration |

**Gateway:** Users interact with Carina without opening a browser.

---

## Phase 7: Mobile Native Apps (Weeks 16-20)

**Goal:** Android + iOS apps on app stores.

| Week | Task | Deliverable |
|---|---|---|
| 16-17 | Android app (Kotlin + Jetpack Compose): Chat, knowledge browse, settings, usage dashboard. | Android MVP |
| 18-19 | iOS app (Swift + SwiftUI): Same screens. Native navigation. | iOS MVP |
| 20 | Push notifications. Biometric auth. Offline mode. App store submissions. | App store launch |

**Gateway:** Carina in your pocket.

---

## Phase 8: Continuous Learning (Weeks 19-21, starts after Phase 5)

**Goal:** Opt-in per-tenant fine-tuning. Privacy-compliant model improvement.

| Week | Task | Deliverable |
|---|---|---|
| 19 | Opt-in/opt-out UI in settings. Anonymisation pipeline. | Consent flow |
| 19 | LoRA adapter training pipeline (Python). Per-tenant model storage. | Fine-tuning pipeline |
| 20 | Adapter serving — tenant's queries use their fine-tuned adapter. | Personalised Carina |
| 21 | Opt-out deletion trigger. 7-day data retention policy enforcement. | GDPR compliance |

**Gateway:** Carina gets smarter for each tenant without sharing data across tenants.

---

## Summary Timeline

```
Week  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21
     ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
P0   │▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
P1   │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │
P2   │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  │  │
P3   │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │
P4   │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │
P5   │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│▓▓│▓▓│  │  │  │  │  │  │
P6   │  │  │  │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │
P7   │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│▓▓│▓▓│  │
P8   │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│
     └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
     Foundation  API+Chat  Web+PWA  Billing  Knowledge  ML  Integrate  Mobile  Learning
```

**First paying users possible at Week 10 (Phase 3 complete).**  
**Beta launch (public): Week 8 (Web + PWA).**  
**Full launch: Week 20.**
