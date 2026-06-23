# Carina AI - Master Build Sequence

**Purpose:** A step-by-step, chronological build plan. Follow this order from first line of code to last.  
**Each step references the exact document(s) you need.**  
**Estimated total:** ~20 weeks for full ship, ~8 weeks for revenue-generating MVP.

---

## How to Use This

1. Do each step in order. Do not skip ahead.
2. Each step tells you which document to read first - read it, then build.
3. Each step produces a working deliverable. Nothing is theoretical.
4. Deliverables build on each other. Step 5 depends on Step 1-4 being done.
5. If a step references `(scaffold exists)`, the folder is already created - write the code.

---

## PHASE 0: FOUNDATION (Steps 1-6)
**Goal:** A working Laravel app on a VPS that you can log into.  
**Read first:** `ARCHITECTURE.md`, `INFRASTRUCTURE.md`, `CODING_STANDARDS.md`  
**Duration:** ~2 weeks

```
┌─────────────────────────────────────────────────────┐
│  PHASE 0 OUTPUT:                                    │
│  • Working Laravel app at carina.verlox.uk           │
│  • Can log in with email + password                  │
│  • Docker Compose running on VPS                     │
│  • PostgreSQL, Redis, Meilisearch connected          │
│  • Multi-tenancy working (database-per-tenant)       │
└─────────────────────────────────────────────────────┘
```

### Step 1: Fork Laravel from Propreneur
**Document:** `ARCHITECTURE.md` (section: Stack, Architecture Principle)  
**Action:** Create a new Laravel 12 project. Copy from Propreneur: Auth, Tenancy, Carina engine (`app/Services/Carina/*`), Config, Migrations, Filament admin panel. Strip everything else (CRM, Pipeline, Deals, Accounting, Mentoring, viCal, Community, Reporting).  
**Deliverable:** Clean Laravel skeleton with Carina engine.

### Step 2: Docker + Infrastructure
**Document:** `INFRASTRUCTURE.md` (Docker Compose config, VPS setup)  
**Action:** Set up `docker-compose.yml` with Laravel, PostgreSQL + pgvector, Redis, Meilisearch, Nginx. Create Dockerfiles for Laravel and Python. Configure environment variables.  
**Deliverable:** `docker-compose up` boots the entire stack. Working locally.

### Step 3: Multi-Tenancy
**Document:** `ARCHITECTURE.md` (section: Multi-Tenancy Model)  
**Action:** Configure stancl/tenancy v3. Wildcard subdomain routing (`*.carina.verlox.uk`). Central DB + tenant DB creation on signup. Tenant database migrations.  
**Deliverable:** New signup creates a tenant database. Tenant isolation works.

### Step 4: Authentication
**Document:** `ONBOARDING_ACTIVATION.md` (Step 1-2)  
**Action:** Email + password signup. Social login (Google, GitHub). Email verification. Password reset. Session management. MFA (TOTP) for Ultra/Enterprise. Laravel Sanctum for API tokens.  
**Deliverable:** Users can sign up, verify email, log in, reset password.

### Step 5: Deploy to VPS
**Document:** `INFRASTRUCTURE.md` (section: What You Actually Need to Start)  
**Action:** Deploy Docker stack to Contabo VPS (or share Propreneur's existing VPS). Configure Nginx with SSL (Let's Encrypt). Set up wildcard DNS for tenant subdomains.  
**Deliverable:** `https://carina.verlox.uk` is live. Users can sign up and log in.

### Step 6: Coding Standards Check
**Document:** `CODING_STANDARDS.md`  
**Action:** Run PHPStan (level 6). Configure Laravel Pint for code style. Set up PHPCS. Configure pre-commit hooks.  
**Deliverable:** All code passes static analysis. Code style is enforced automatically.

---

## PHASE 1: CHAT + AI ENGINE (Steps 7-12)
**Goal:** Users can chat with Carina. Multi-provider AI is working. RAG knows property.  
**Read first:** `PROVIDER_ROTATION.md`, `API_SPEC.md`  
**Duration:** ~3 weeks

```
┌─────────────────────────────────────────────────────┐
│  PHASE 1 OUTPUT:                                    │
│  • Chat endpoint at POST /api/v1/chat                │
│  • Streaming at POST /api/v1/chat/stream             │
│  • 3 AI providers rotating with circuit breaker      │
│  • RAG working (95+ property docs ingested)           │
│  • Agent Bridge for Propreneur integration           │
│  • 20+ unit tests passing                            │
└─────────────────────────────────────────────────────┘
```

### Step 7: Carina Engine Port
**Document:** `PROVIDER_ROTATION.md` (full document)  
**Action:** Port `CarinaService`, `AiRouterService`, `CarinaAgentService`, `CarinaToolRegistry` from Propreneur. Wire up `ProviderRouter` with cost-priority, round-robin, capability-priority, and health-based strategies. Implement `ProviderCircuitBreaker`. Implement `ProviderHealthCheck`.  
**Deliverable:** Carina can answer questions using DeepSeek, OpenAI, or Anthropic with automatic failover.

### Step 8: Chat API
**Document:** `API_SPEC.md` (endpoints: chat, stream)  
**Action:** `POST /api/v1/chat` - synchronous chat. `POST /api/v1/chat/stream` - SSE streaming. `GET /api/v1/conversations` - list. `GET /api/v1/conversations/{id}` - get one. `DELETE /api/v1/conversations/{id}` - delete. Response format as specified. Auth middleware (Bearer token). Rate limiting per key/tier.  
**Deliverable:** Full chat API working. Test with curl, Postman, any HTTP client.

### Step 9: API Key System
**Document:** `SECURITY_CYBER_FORENSICS.md` (section: API Key Authentication)  
**Action:** API key generation (64-char random hex, bcrypt hashed). Key scopes (`chat:read`, `knowledge:write`, `admin:all`). Key revocation. Rate limiting per key. IP allowlisting (Enterprise).  
**Deliverable:** `/settings/api-keys` page. Generate, scope, revoke. Keys work with all endpoints.

### Step 10: RAG Pipeline
**Document:** `DATA_INTEGRATIONS.md` (section: Architecture: Data Layer, implementation)  
**Action:** Port `RAGService`, `EmbeddingService`, `DocumentChunker` from Propreneur. Configure pgvector schema. Port 95+ property knowledge docs from `brain/knowledge/`. Run `rag:ingest-brain-knowledge`. Test: "What is BRR?" → Carina answers from RAG.  
**Deliverable:** Carina knows UK property. All 95+ docs searchable via RAG.

### Step 11: Agent Bridge
**Document:** `API_SPEC.md` (section: Agent Bridge)  
**Action:** `POST /api/v1/agent/chat` - endpoint for external agents (Propreneur's Carina Agent) to call for intelligence. Receives agent's tool results, returns analysis. API key auth scoped to `agent` permission.  
**Deliverable:** Propreneur's Carina Agent can be switched to call Carina Standalone API.

### Step 12: Error Handling Foundation
**Document:** `ERROR_HANDLING.md` (full document)  
**Action:** Global exception handler. Structured JSON error responses. Error codes mapped to user-facing messages. Logging integration. Error UI for web (inline banners). Test every error scenario.  
**Deliverable:** All errors return structured `{error: {code, message, details}}`. No raw exceptions ever shown.

---

## PHASE 2: WEB UI + PWA (Steps 13-17)
**Goal:** Users can use Carina from a browser. Installable PWA.  
**Read first:** `ONBOARDING_ACTIVATION.md`, `ERROR_HANDLING.md`  
**Duration:** ~2 weeks

```
┌─────────────────────────────────────────────────────┐
│  PHASE 2 OUTPUT:                                    │
│  • Chat page at /chat - full Carina conversation     │
│  • Streaming responses in the browser                │
│  • Conversation history sidebar                       │
│  • Settings page (profile, API keys, BYOK)           │
│  • PWA installable on home screen                    │
│  • Responsive design (phone, tablet, desktop)        │
└─────────────────────────────────────────────────────┘
```

### Step 13: Auth UI
**Document:** `ONBOARDING_ACTIVATION.md` (Step 1-2)  
**Action:** Login, register, password reset, email verification pages. Social login buttons. Post-login redirect to `/welcome`.  
**Deliverable:** Users can sign up and log in through the browser.

### Step 14: Chat UI
**Document:** `ONBOARDING_ACTIVATION.md` (Step 3)  
**Action:** `/chat` page - full-page conversation view. Message input. Streaming response display (SSE). Role-based starter prompts. "Try asking me" suggestions. Conversation sidebar with history.  
**Deliverable:** Users can chat with Carina in the browser. Streaming works.

### Step 15: Settings UI
**Action:** `/settings/profile` - name, email, password. `/settings/api-keys` - generate, view, revoke. `/settings/billing` - plan, usage, invoices (links to Stripe). `/settings/byok` - enable, enter API keys. `/settings/data` - opt-in/opt-out for continuous learning.  
**Deliverable:** Full settings page. Users can configure their account.

### Step 16: PWA
**Document:** `DOCS_ACCESSIBILITY_FUTURE.md` (section: PWA)  
**Action:** Service worker. Web manifest. Offline caching of app shell + base knowledge. Push notification registration. Install prompt. Test on Android Chrome, iOS Safari.  
**Deliverable:** Carina installable on phone home screen. Works offline with cached knowledge.

### Step 17: Welcome + Onboarding Flow
**Document:** `ONBOARDING_ACTIVATION.md` (Step 2-4)  
**Action:** `/welcome` page with role selector (Landlord/Investor/Agent/Developer). Pre-filled starter questions. Guided first conversation. Activation tracking.  
**Deliverable:** New users go from signup → first "wow" moment in under 2 minutes.

---

## PHASE 3: BILLING + METERING (Steps 18-23)
**Goal:** Carina is a real business. Users pay.  
**Read first:** `BILLING_USAGE_METERING.md`, `PLAN_DIFFERENTIATION.md`  
**Duration:** ~2 weeks

```
┌─────────────────────────────────────────────────────┐
│  PHASE 3 OUTPUT:                                    │
│  • Token metering - every request counts tokens      │
│  • Free tier enforced (hard cap at 5K tokens)        │
│  • Stripe subscriptions (Pro/Pro+/Ultra/Enterprise)  │
│  • On-demand top-up bundles                          │
│  • Usage dashboard with token gauge                  │
│  • Upgrade prompts when limits are hit               │
│  • 25% annual discount                               │
└─────────────────────────────────────────────────────┘
```

### Step 18: Token Metering Core
**Document:** `BILLING_USAGE_METERING.md` (Algorithm & Metering Engine, Database Schema)  
**Action:** `usage_log` table. Token counting middleware (count input + output tokens per request). Deduct from user's monthly allowance. Provider multiplier (DeepSeek 1.0x, OpenAI 2.0x, Anthropic 3.5x). Weekly rollup. Check allowance before processing.  
**Deliverable:** Every request is metered. Usage is logged. Free users blocked at 5K tokens.

### Step 19: Free Tier Gating
**Document:** `BILLING_USAGE_METERING.md` (Hard Cap vs Soft Cap)  
**Action:** Hard cap for Free tier - block requests when allowance exhausted. Soft cap for paid tiers - allow, but count overage. Return `402 Payment Required` with upgrade prompt.  
**Deliverable:** Free users hit the limit and see an upgrade screen. Paid users never blocked.

### Step 20: Stripe Integration
**Document:** `BILLING_USAGE_METERING.md` (Pricing Tiers table)  
**Action:** Create Stripe products + prices for Pro (£20/mo), Pro+ (£60/mo), Ultra (£100/mo), Enterprise (£200/mo). Annual versions (25% off). Customer portal for managing payment methods. Webhook handler for subscription events.  
**Deliverable:** Users upgrade, downgrade, cancel through Stripe. Billing is live.

### Step 21: Top-Up Bundles
**Document:** `BILLING_USAGE_METERING.md` (On-Demand Top-Up Bundles)  
**Action:** Small (£3/5K tokens), Medium (£12/25K), Large (£40/100K), Mega (£150/500K). Stripe payment intent. Token balance merge. Receipt email.  
**Deliverable:** Users can buy more tokens when they run out. No wait for next billing cycle.

### Step 22: Usage Dashboard
**Document:** `BILLING_USAGE_METERING.md` (Usage Dashboard - full spec with screenshot layout)  
**Action:** `/settings/usage` page. Token gauge (percentage used). Daily usage chart (last 30 days). Breakdown by action type and provider. Spending summary. "Set monthly spending cap" control. Top-up purchase interface.  
**Deliverable:** Users see exactly where their tokens go. They can control spending.

### Step 23: Upgrade Prompts + Emails
**Document:** `ONBOARDING_ACTIVATION.md` (Step 5), `EMAIL_NOTIFICATIONS.md` (Usage & Billing)  
**Action:** Upgrade modal when Free user hits 5K tokens. Upgrade prompt when Pro user tries to upload a document. Inline "Upgrade to unlock" on gated features. Warning emails at 50%, 80%, 90%, 100% usage.  
**Deliverable:** Users are guided to upgrade at the right moment. No hard blocks - always a path forward.

---

## PHASE 4: KNOWLEDGE + TRAINING (Steps 24-28)
**Goal:** Users upload documents, Carina learns from them. Content generation.  
**Read first:** `DATA_INTEGRATIONS.md`, `PLAN_DIFFERENTIATION.md`  
**Duration:** ~2 weeks

### Step 24: Document Upload
**Document:** `PLAN_DIFFERENTIATION.md` (section: Knowledge & Training)  
**Action:** Upload endpoint `POST /api/v1/knowledge/upload`. Supported formats: PDF, DOCX, TXT, MD. File validation (size, type). Virus scan (ClamAV). Chunking + embedding pipeline. Status notification when processing completes.  
**Deliverable:** Users upload a document. Carina indexes it. She answers questions from it.

### Step 25: Knowledge Management UI
**Action:** `/knowledge` page - browse uploaded documents. Search across all docs. View individual document, see its chunks. Delete document.  
**Deliverable:** Users manage their knowledge base through a web interface.

### Step 26: URL + Audio Training
**Document:** `DATA_INTEGRATIONS.md` (section: Data Types & Ingestion Rules)  
**Action:** Paste a URL → Carina fetches, analyses, stores. Audio upload → Whisper transcription → Carina learns from it.  
**Deliverable:** Carina can learn from web pages and recorded meetings.

### Step 27: Content Generation
**Document:** `PLAN_DIFFERENTIATION.md` (section: Content Generation)  
**Action:** Property description generator. Area guide generator. Social media post generator. Deal pack PDF generator. All gated by plan.  
**Deliverable:** Users generate professional property content in one click.

### Step 28: Train My AI (Pro+ Gate)
**Document:** `PLAN_DIFFERENTIATION.md` (The hard gate between Pro and Pro+)  
**Action:** Upload button hidden for Free/Pro. Shows "Upgrade to Pro+ (£60/mo) to upload documents" with feature comparison.  
**Deliverable:** Clear upgrade path. Users see exactly what they get by upgrading.

---

## PHASE 5: PYTHON ML ENGINE (Steps 29-33)
**Goal:** ML models running. Area intelligence, portfolio analysis.  
**Read first:** `ML_PIPELINE.md`  
**Duration:** ~4 weeks (parallel with Phase 4)

### Step 29: Python Scaffold
**Document:** `ML_PIPELINE.md` (Services section)  
**Action:** FastAPI app at `python/app.py`. Health endpoint. Connection to shared PostgreSQL. Celery worker + Redis queue. Celery beat for scheduled tasks.  
**Deliverable:** Python service is running. Laravel can call `python-api:8001/health`.

### Step 30: Property Valuation Model
**Document:** `ML_PIPELINE.md` (P1 Models section)  
**Action:** XGBoost model for property valuation. Train on synthetic sample data. Expose via `POST /api/v1/analyze/valuation` (through Laravel → Python). Return predicted value + confidence interval.  
**Deliverable:** Carina estimates property values. Accuracy improves over time.

### Step 31: Area Scoring Model
**Document:** `ML_PIPELINE.md` (P1 Models section)  
**Action:** Multi-factor area scoring model. Factors: yield, price trend, transaction volume, planning applications, employment, crime, schools. Score 1-100.  
**Deliverable:** Carina scores any UK postcode for investment potential.

### Step 32: Batch Processing
**Document:** `ML_PIPELINE.md` (Batch Processing section)  
**Action:** Daily market digest - refresh area scores, generate trend reports. Weekly portfolio report - analyse user portfolios, email report.  
**Deliverable:** Carina sends automated intelligence reports to users.

### Step 33: PDF Report Generation
**Action:** Area report PDF. Deal analysis PDF. Portfolio health PDF. Generated via Python (weasyprint/matplotlib). Styled with Carina branding.  
**Deliverable:** Professional PDF reports users can download, print, share.

---

## PHASE 6: DATA API AUTO-INGESTION (Steps 34-37)
**Goal:** Carina pulls live property data. Every call trains the system.  
**Read first:** `DATA_INTEGRATIONS.md`  
**Duration:** ~2 weeks

### Step 34: PropertyData Integration
**Document:** `DATA_INTEGRATIONS.md` (Integration: PropertyData.co.uk)  
**Action:** API client for PropertyData endpoints (local-data, valuation, sold-prices, planning, rental). Caching layer (7-day TTL for area data, 24h for valuations). Auto-ingest pipeline - every API response analysed by LLM and stored in RAG.  
**Deliverable:** Carina answers area questions from live data. After first query, answers from RAG (faster, cheaper).

### Step 35: Tavily Integration
**Document:** `DATA_INTEGRATIONS.md` (Integration: Tavily Web Search)  
**Action:** API client for Tavily search. Carina uses web search for: latest news, regulation changes, council policies, market trends. Results auto-analysed and stored in RAG (2-hour cache).  
**Deliverable:** Carina knows what's happening in property right now. Not just her training data.

### Step 36: EPC Integration
**Document:** `DATA_INTEGRATIONS.md` (Integration: EPC API)  
**Action:** API client for Open Data Communities EPC database. Search by postcode. Return EPC rating, recommended improvements, estimated costs. Cache (90 days - EPC valid for 10 years).  
**Deliverable:** Carina checks any property's EPC. She advises on improvements.

### Step 37: Smart Data Service (RAG-First)
**Document:** `DATA_INTEGRATIONS.md` (Carina's Decision Flow: RAG-First)  
**Action:** Before any external API call, check RAG first. If sufficient fresh data exists, answer from RAG - zero API cost, zero latency. Configurable freshness thresholds per data type.  
**Deliverable:** After month 1, 80%+ of queries never touch external APIs. Carina has learned enough.

---

## PHASE 7: COMMUNITY + COLLABORATION (Steps 38-44)
**Goal:** Users share property intelligence in groups. Not social media.  
**Read first:** `COMMUNITY_MECHANICS.md`, `COMMUNITY_COLLABORATION.md`, `DATA_SHARING_CONSENT.md`  
**Duration:** ~3 weeks

### Step 38: Groups / Factions
**Document:** `COMMUNITY_MECHANICS.md` (How People Form Groups)  
**Action:** Create group flow (name, topic, visibility, join rules). Group member management (admin, approve, remove). Join flows (open, approval, code, secret). Group list in sidebar. Group permissions. Group knowledge base (shared RAG).  
**Deliverable:** Users create and join groups. Group RAG compounds knowledge.

### Step 39: Data Sharing Consent
**Document:** `DATA_SHARING_CONSENT.md` (full document)  
**Action:** Consent agreement shown on first group join. `data_consent_log` table (immutable, append-only). `DataSharingService` - checks consent before sharing. Solo/group/public data states. Leave group = consent revoked.  
**Deliverable:** Every user's data state is clear. Consent is auditable. Privacy respected.

### Step 40: Deal Sharing + Analysis
**Document:** `COMMUNITY_MECHANICS.md` (What Users Share)  
**Action:** Share a deal analysis from Carina to a group. Carina auto-analyses the deal - immutable metrics attached. Group members see: deal data + Carina's analysis + community comments.  
**Deliverable:** Shared deals include Carina's verification. Data can't be faked.

### Step 41: Conversation Sharing
**Document:** `COMMUNITY_COLLABORATION.md` (Conversation Sharing)  
**Action:** Share button on every conversation. Share types: link (public/expiring), email, embed, workspace, community post, WhatsApp, Telegram. Public view page (no Carina account needed).  
**Deliverable:** Any Carina analysis can be shared with anyone. Viral distribution.

### Step 42: Workspaces (Multi-User Teams)
**Document:** `COMMUNITY_COLLABORATION.md` (Workspaces)  
**Action:** Invite member to workspace (email/link). Roles: Owner, Admin, Member, Viewer. Shared knowledge base across workspace members. Shared conversation history. Workspace-level billing.  
**Deliverable:** Teams share one Carina workspace. Knowledge is collective.

### Step 43: Expert Network
**Document:** `COMMUNITY_COLLABORATION.md` (Expert Network)  
**Action:** Expert application + verification. Availability (viCal integration). Pricing (£30-200/hr). Booking + payment. Shared workspace for consultation. Reviews. 80/15/5 revenue split.  
**Deliverable:** Property experts offer paid consultations via Carina.

### Step 44: Community Feed (Intelligence Stream)
**Document:** `COMMUNITY_MECHANICS.md` (The Feed Is Not a Feed)  
**Action:** Filtered intelligence stream. Filters: area, deal type, budget, ROI target. Posts: deal shares, area reports, questions, articles, events. No infinite scroll. No like/ follower counts displayed.  
**Deliverable:** Users see only what's relevant to their property interests. No noise.

---

## PHASE 8: GAMIFICATION + REFERRALS (Steps 45-48)
**Goal:** Incentivise quality contributions. Reward loyalty. Grow through referrals.  
**Read first:** `GAMIFICATION_LOYALTY_REFERRALS.md`  
**Duration:** ~2 weeks

### Step 45: Contribution Levels
**Document:** `GAMIFICATION_LOYALTY_REFERRALS.md` (Contribution Score, Levels)  
**Action:** Track contributions: deal shared, deal completed, document uploaded, question answered. Score with quality multiplier (Carina assesses data completeness). Levels: Analyst → Contributor → Specialist → Expert → Authority → Fellow. No progress bars. No "30 points away" nudges.  
**Deliverable:** Levels appear naturally as a byproduct of useful contributions.

### Step 46: Token Rewards
**Document:** `GAMIFICATION_LOYALTY_REFERRALS.md` (Earning Bonus Tokens)  
**Action:** +50 tokens for daily first chat. +1,000 for completed deal. +200 per document upload. +5% monthly bonus after 3 months active, +20% after 12 months, +50% after 36 months.  
**Deliverable:** Loyalty is rewarded with more tokens. Retention improves.

### Step 47: Referral Programme
**Document:** `GAMIFICATION_LOYALTY_REFERRALS.md` (Referral Programme)  
**Action:** Referral link generator. +500 tokens per free signup. +2,500 tokens per paid conversion. Referral dashboard (views, signups, conversions). Anti-spam measures.  
**Deliverable:** Users invite other property professionals. Carina grows through word-of-mouth.

### Step 48: Group Milestones
**Document:** `GAMIFICATION_LOYALTY_REFERRALS.md` (Group Achievements)  
**Action:** 10 deals shared → group knowledge base unlocked. 50 deals → +20% group token multiplier. 100 deals → custom Carina persona. Group badges displayed on profile.  
**Deliverable:** Groups compete on collective intelligence, not individual popularity.

---

## PHASE 9: IMAGE GENERATION (Step 49)
**Goal:** Carina generates property images.  
**Read first:** `IMAGE_GENERATION.md`  
**Duration:** ~1 week

### Step 49: Image Generation
**Document:** `IMAGE_GENERATION.md` (full document)  
**Action:** `GenerateImageTool` agent tool. `ImageRouterService` (DALL-E 3 → Imagen → Stable Diffusion). `POST /api/v1/images/generate` endpoint. Image storage + serving. Token pricing (2,500 per DALL-E 3 image). Gated: Free = 0, Pro = 10/mo, Pro+ = 50/mo, Ultra = 200/mo.  
**Deliverable:** Carina generates property visualisations, floor plans, marketing graphics.

---

## PHASE 10: INTEGRATIONS (Steps 50-52)
**Goal:** Carina works where users already are.  
**Read first:** `API_VERSIONING_WEBHOOKS_DEPS.md` (Webhooks), `DOCS_ACCESSIBILITY_FUTURE.md`  
**Duration:** ~2 weeks

### Step 50: Slack Bot
**Action:** Slack app. Message Carina from Slack. Thread replies. Slash command `/carina ask ...`. Channel integration.  
**Deliverable:** Users interact with Carina without leaving Slack.

### Step 51: WhatsApp Bot
**Action:** WhatsApp Business API via Twilio. Message Carina on WhatsApp. Same chat engine, different channel.  
**Deliverable:** Users interact with Carina from their phone's default messaging app.

### Step 52: Webhook System
**Document:** `API_VERSIONING_WEBHOOKS_DEPS.md` (Webhooks)  
**Action:** Webhook registration UI. Events: analysis.completed, knowledge.ingested, billing.usage_warning, billing.top_up, provider.degraded. HMAC signing. Retry policy (5 attempts, exponential backoff). Webhook logs.  
**Deliverable:** Third-party apps receive Carina events in real-time.

---

## PHASE 11: MOBILE APPS (Steps 53-54)
**Goal:** Carina in your pocket.  
**Read first:** `DOCS_ACCESSIBILITY_FUTURE.md` (Mobile)  
**Duration:** ~4-6 weeks

### Step 53: Android App
**Action:** Kotlin + Jetpack Compose. Screens: Chat, Knowledge Browse, Settings, Usage Dashboard. Push notifications. Biometric auth. Offline mode (basic).  
**Deliverable:** Carina on Google Play Store.

### Step 54: iOS App
**Action:** Swift + SwiftUI. Same screens. Native navigation. Push notifications. Face ID/Touch ID.  
**Deliverable:** Carina on Apple App Store.

---

## PHASE 12: CONTINUOUS LEARNING (Steps 55-57)
**Goal:** Carina gets smarter over time. Opt-in, private, per-tenant.  
**Read first:** `ML_PIPELINE.md` (Fine-Tuning), `PRIVACY_SECURITY.md` (Continuous Learning)  
**Duration:** ~2 weeks

### Step 55: Opt-In Pipeline
**Document:** `PRIVACY_SECURITY.md` (Continuous Learning)  
**Action:** Opt-in/opt-out UI in settings. Off by default. Anonymisation pipeline (strip PII before any training). Consent audit trail.  
**Deliverable:** Users control whether their data trains Carina.

### Step 56: Per-Tenant Fine-Tuning
**Document:** `ML_PIPELINE.md` (Fine-Tuning)  
**Action:** LoRA adapter training pipeline (Python). Per-tenant model storage. Adapter serving - tenant's queries use their fine-tuned adapter. Adapter size: <100 MB per tenant.  
**Deliverable:** Carina gets personalised for each tenant. Never shares data across tenants.

### Step 57: Data Deletion on Opt-Out
**Document:** `PRIVACY_SECURITY.md` (Privacy Guarantees)  
**Action:** Opt-out triggers deletion of all training data within 7 days. Delete adapter + source data. "Your data has been deleted" confirmation.  
**Deliverable:** GDPR compliance. Users can leave at any time with full data deletion.

---

## PHASE 13: DOCS + ACCESSIBILITY + SDK (Steps 58-61)
**Goal:** Developers can integrate Carina. Users can learn Carina.  
**Read first:** `DOCS_ACCESSIBILITY_FUTURE.md`, `API_VERSIONING_WEBHOOKS_DEPS.md` (API Versioning)  
**Duration:** ~2 weeks (can start earlier in parallel)

### Step 58: Public Documentation Site
**Document:** `DOCS_ACCESSIBILITY_FUTURE.md` (Public Documentation Site)  
**Action:** `docs.carina.verlox.uk` - MkDocs or similar. Quickstart, API reference (auto-generated from OpenAPI), guides, billing, changelog, security overview, FAQ.  
**Deliverable:** Anyone can learn Carina without contacting support.

### Step 59: API Playground
**Document:** `DOCS_ACCESSIBILITY_FUTURE.md` (API Playground)  
**Action:** Swagger UI at `/api/docs`. Interactive endpoint testing. Auto-generated client code (Python, JS, PHP, curl). API key input field.  
**Deliverable:** Developers test Carina's API in the browser before writing code.

### Step 60: SDK Libraries
**Document:** `DOCS_ACCESSIBILITY_FUTURE.md` (SDK Libraries)  
**Action:** Python SDK (`pip install carina-ai`). JavaScript SDK (`npm install carina-ai`). PHP SDK (`composer require verlox/carina-ai`). Each covers all API endpoints + streaming + webhook verification.  
**Deliverable:** Developers integrate Carina with one `pip install` or `npm install`.

### Step 61: API Versioning + Deprecation
**Document:** `API_VERSIONING_WEBHOOKS_DEPS.md` (API Versioning)  
**Action:** URL-based versioning (`/v1/`, `/v2/`). Deprecation header on old versions. 6-month deprecation window. Sunset returns 410 Gone. Changelog published.  
**Deliverable:** Breaking changes don't break existing integrations. Developers have 6 months to migrate.

---

## Summary Timeline

```
Phase  0  Foundation  │ Weeks 1-2
Phase  1  Chat + AI   │ Weeks 3-5
Phase  2  Web + PWA   │ Weeks 6-8
Phase  3  Billing      │ Weeks 8-10
Phase  4  Knowledge    │ Weeks 11-13
Phase  5  ML Engine    │ Weeks 11-15 (parallel with 4)
Phase  6  Data APIs    │ Weeks 14-16
Phase  7  Community    │ Weeks 16-19
Phase  8  Gamification │ Weeks 18-20
Phase  9  Image Gen    │ Week 19
Phase 10  Integrations │ Weeks 19-21
Phase 11  Mobile       │ Weeks 20-26
Phase 12  Learning     │ Weeks 22-24
Phase 13  Docs + SDKs  │ Weeks 20-26 (parallel)
```

**First paying users: Week 10 (end of Phase 3: Billing).**  
**Public beta: Week 8 (end of Phase 2: Web + PWA).**  
**Full launch: Week 26 (all phases complete).**

---

## What to Build Right Now (If You're Starting Today)

| Step | What | Document | Estimated Time |
|---|---|---|---|
| 1 | Fork Laravel, strip modules, port Carina engine | `ARCHITECTURE.md` | 2 days |
| 2 | Docker + VPS deployment | `INFRASTRUCTURE.md` | 2 days |
| 3 | Multi-tenancy | `ARCHITECTURE.md` | 1 day |
| 4 | Authentication (signup, login, verify, reset) | `ONBOARDING_ACTIVATION.md` | 2 days |
| 5 | Port knowledge docs (95+ files) | `DATA_INTEGRATIONS.md` | 1 day |
| 6 | Chat API + streaming | `API_SPEC.md` | 3 days |
| 7 | Multi-provider routing | `PROVIDER_ROTATION.md` | 2 days |
| 8 | Token metering | `BILLING_USAGE_METERING.md` | 2 days |
| 9 | Strip Connect | `BILLING_USAGE_METERING.md` | 2 days |
| 10 | Web UI (chat + settings) | `ONBOARDING_ACTIVATION.md` | 5 days |

**Total to MVP (paying users possible): ~22 working days.**

---

## Reference Index

Every document in this directory maps to one or more build steps:

| Step(s) | Document |
|---|---|
| 1, 3 | `ARCHITECTURE.md` |
| 1 | `CODING_STANDARDS.md` |
| 2 | `INFRASTRUCTURE.md` |
| 4, 13, 14, 17, 23 | `ONBOARDING_ACTIVATION.md` |
| 7 | `PROVIDER_ROTATION.md` |
| 8, 11 | `API_SPEC.md` |
| 12 | `ERROR_HANDLING.md` |
| 9 | `SECURITY_CYBER_FORENSICS.md` |
| 10 | `DATA_INTEGRATIONS.md` |
| 15, 22, 23 | `EMAIL_NOTIFICATIONS.md` |
| 16 | `DOCS_ACCESSIBILITY_FUTURE.md` |
| 18, 19, 20, 21, 22 | `BILLING_USAGE_METERING.md` |
| 24, 25, 26, 27, 28 | `PLAN_DIFFERENTIATION.md` |
| 29, 30, 31, 32, 33 | `ML_PIPELINE.md` |
| 34, 35, 36, 37 | `DATA_INTEGRATIONS.md` |
| 38, 39, 40, 41, 44 | `COMMUNITY_MECHANICS.md` |
| 42, 43 | `COMMUNITY_COLLABORATION.md` |
| 39 | `DATA_SHARING_CONSENT.md` |
| 45, 46, 47, 48 | `GAMIFICATION_LOYALTY_REFERRALS.md` |
| 49 | `IMAGE_GENERATION.md` |
| 50, 51, 52 | `API_VERSIONING_WEBHOOKS_DEPS.md` |
| 53, 54 | `DOCS_ACCESSIBILITY_FUTURE.md` |
| 55, 56, 57 | `ML_PIPELINE.md`, `PRIVACY_SECURITY.md` |
| 58, 59, 60, 61 | `DOCS_ACCESSIBILITY_FUTURE.md`, `API_VERSIONING_WEBHOOKS_DEPS.md` |
| - | `GAP_ANALYSIS.md` (reference only - all gaps closed) |
| - | `LOGGING_FEATURE_FLAGS.md` (apply throughout all phases) |
| - | `ROADMAP.md` (strategic overview) |
| - | `100-REVENUE-OPPORTUNITIES.md` (strategy reference) |
| - | `INVESTMENT_PROPOSAL.md` (funding reference) |
| - | `RESILIENCE_FAILURE_MODES.md` (apply throughout all phases) |
| - | `PERFORMANCE_SCALING.md` (apply from Phase 3 onward) |
| - | `SESSION_SUMMARY.md` (project history) |
