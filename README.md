# Carina AI — Complete Product Specification

**Version:** 1.0  
**Status:** Pre-build (fully documented)  
**Last updated:** 8 May 2026  
**Repository:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`  
**Total documentation:** 31 files · 7,981 lines · 544 KB  

---

## What Carina Is

Carina is a **property-specific artificial intelligence platform**. She lives independently in the cloud, trained on UK property data, accessible via web, mobile, PWA, and API. She is the brain — any property application can plug into her API, and end users can talk to her directly.

**Built by:** VERLOX Ltd (UK)  
**Stack:** Laravel 12 + Python 3.12 FastAPI + Celery  
**Multi-tenancy:** Database-per-tenant (stancl/tenancy v3)  
**AI Providers:** Anthropic · OpenAI · DeepSeek · Google Gemini (rotating)  
**Billing:** Token-based metering (Cursor-style)  
**Infrastructure:** Contabo VPS (MVP — shared with Propreneur) → Hetzner/DigitalOcean (scale)  

---

## Documentation Index

### Core Architecture

| Doc | Lines | What It Covers |
|---|---|---|
| `ARCHITECTURE.md` | 565 | Full system architecture. Laravel + Python split. Multi-tenancy. Stack decisions. Feature matrix by tier. Revenue model. |
| `CODING_STANDARDS.md` | 351 | 7 coding principles: clean, reusable, non-bloat, non-spaghetti, lean, maintainable, non-complex. Naming conventions. File organisation. Testing standards. |
| `INVESTMENT_PROPOSAL.md` | 362 | Complete investment pitch. Problem, market (£650M UK TAM → £5B global), solution, traction, funding ask (£500K pre-seed / £1.5M seed), financial projections, exit strategy. |

### AI & Provider Layer

| Doc | Lines | What It Covers |
|---|---|---|
| `PROVIDER_ROTATION.md` | 406 | Smart router: cost-priority, round-robin, capability-priority, health-based. Circuit breaker. Health monitoring. Budget-aware routing. Provider multiplier for token billing. |
| `ML_PIPELINE.md` | 82 | Python FastAPI + Celery services. Models: valuation, area scoring, risk assessment. Batch processing. Fine-tuning pipeline (LoRA adapters, opt-in only). |

### Data & Knowledge

| Doc | Lines | What It Covers |
|---|---|---|
| `DATA_INTEGRATIONS.md` | 177 | PropertyData.co.uk, Tavily, EPC API, Land Registry, Google Maps. Auto-ingest pipeline — every API call analyses + stores into RAG. RAG-first decision flow. |
| `IMAGE_GENERATION.md` | 252 | DALL-E 3, Imagen, Stable Diffusion XL. Token pricing. API endpoint. Multi-provider rotation (same pattern as chat). Use cases: property visualisation, floor plans, marketing graphics. |
| `PLAN_DIFFERENTIATION.md` | 137 | 9 differentiation dimensions beyond token quantity: knowledge, intelligence depth, content generation, API, providers, storage, security, support, white-label. Upgrade triggers. |

### Billing & Metering

| Doc | Lines | What It Covers |
|---|---|---|
| `BILLING_USAGE_METERING.md` | 564 | Token-based Cursor-style billing. 5 tiers: Free → Pro (£20) → Pro+ (£60) → Ultra (£100) → Enterprise (£200). On-demand top-ups. Provider multipliers. Database schema. Usage dashboard (full UI spec). Spending controls. Annual discount (25%). |

### Community & Collaboration

| Doc | Lines | What It Covers |
|---|---|---|
| `COMMUNITY_MECHANICS.md` | 296 | Property intelligence sharing — NOT social media. Data-backed posts with Carina verification. Filtered intelligence stream. RAG knowledge compounding. Pseudonymous by default. |
| `COMMUNITY_COLLABORATION.md` | 279 | Workspaces (multi-user teams). Conversation sharing (public links, email, embed). Groups/factions. Expert network (paid consultations). Deal marketplace. Revenue models per feature. |
| `DATA_SHARING_CONSENT.md` | 201 | The act of joining a group IS the consent to share. Three data states: solo (private), group (shared), public (link). Transparent value exchange. Immutable consent audit trail. |
| `GAMIFICATION_LOYALTY_REFERRALS.md` | 316 | Contribution-based levels (not engagement). Token rewards for deal completions, document uploads, referrals. Group achievements. Loyalty multiplier (+20% tokens at 12 months). What we DON'T do (no streaks, no leaderboards). |

### Security & Privacy

| Doc | Lines | What It Covers |
|---|---|---|
| `SECURITY_CYBER_FORENSICS.md` | 508 | 10 security domains: auth, application, AI-specific, tenant isolation, data security, audit (tamper-evident hash chain), forensics (IR plan), infrastructure, privacy, compliance. Prompt injection guard. Incident response plan. |
| `PRIVACY_SECURITY.md` | 134 | Database-per-tenant isolation. Continuous learning opt-in (off by default). API key scopes. Data retention schedules. GDPR compliance. DevOps security. |

### Performance & Infrastructure

| Doc | Lines | What It Covers |
|---|---|---|
| `PERFORMANCE_SCALING.md` | 261 | 8 strategies: multi-layer caching (Redis → RAG → CDN), predictive pre-fetching, streaming, async heavy lifting, horizontal scaling, GPU on-demand, smart provider routing, query debouncing. |
| `INFRASTRUCTURE.md` | 425 | Phase 1-3 infrastructure. Contabo VPS (£25/mo) → dedicated DB + Redis (£150/mo) → auto-scaling (~£500/mo). Docker Compose config. Hosting comparison (Contabo, Hetzner, DigitalOcean, AWS, OVH). Monitoring stack. Backup strategy. |
| `RESILIENCE_FAILURE_MODES.md` | 371 | 8 layers of graceful degradation. Failure mode matrix (every thing that can fail, what Carina does). Circuit breaker. RAG-first with stale data tolerance. Queued retry. Offline survival mode. 100% response rate, varying quality. |

### API & Integration

| Doc | Lines | What It Covers |
|---|---|---|
| `API_SPEC.md` | 205 | All endpoints: chat, stream, knowledge, analysis, agent bridge, usage, billing, image generation. Authentication, rate limits, error codes. Agent Bridge spec for Propreneur integration. |
| `API_VERSIONING_WEBHOOKS_DEPS.md` | 208 | URL-based versioning (v1/v2). 6-month deprecation window. Webhook system (events, signing, retry policy). Dependency management schedule (composer, npm, pip, Docker). |

### User Experience

| Doc | Lines | What It Covers |
|---|---|---|
| `ONBOARDING_ACTIVATION.md` | 143 | Signup → verify → first chat → activation → upgrade. Role-based starter questions. Conversion funnel metrics. Free tier limits as conversion drivers. |
| `EMAIL_NOTIFICATIONS.md` | 105 | Transactional emails (Postmark). Usage warnings. Weekly digest. Push notifications (PWA). In-app notifications. Notification priority levels. |
| `ERROR_HANDLING.md` | 172 | Global error response format. Error codes by category. User-facing messages for every scenario. Error UI (inline banner). Logging structure. |
| `TESTING_CI_CD.md` | 154 | Test pyramid (unit → feature → integration → E2E). Coverage gates (90% unit, 80% feature). CI/CD pipeline (PHPStan → Pest → pytest → Docker → deploy). Release process. |

### Future & Growth

| Doc | Lines | What It Covers |
|---|---|---|
| `DOCS_ACCESSIBILITY_FUTURE.md` | 188 | Public docs site (MkDocs). WCAG 2.1 AA compliance. API playground (Swagger). Desktop app (macOS/Windows/Linux). Browser extension. SDK libraries (Python, JavaScript, PHP). Status page. |
| `ROADMAP.md` | 184 | 8 phases, 21 weeks. P0-P2 MVP in 8 weeks. Full ship at week 20. Gantt-style timeline. |
| `100-REVENUE-OPPORTUNITIES.md` | 154 | 100 monetisation ideas across 10 categories: SaaS, API, knowledge, ML, compliance, content, education, lead gen, B2B, platform/ecosystem. |

### Project Management

| Doc | Lines | What It Covers |
|---|---|---|
| `GAP_ANALYSIS.md` | 362 | Complete gap analysis of original 18 docs. Identified 13 missing gaps. Prioritised must-have (3) → should-have (4) → nice-to-have (7). All gaps now closed. |
| `LOGGING_FEATURE_FLAGS.md` | 169 | Logging strategy (levels, channels, structured JSON). Feature flags (off/internal/beta/percent/on). Admin UI for flag management. |
| `README.md` | 224 | This file. Master index for the entire project. |

---

## Feature Summary

### What Carina Does

| Capability | Status |
|---|---|
| **Multi-provider AI chat** (Anthropic + OpenAI + DeepSeek, rotating) | ✅ Documented |
| **RAG knowledge retrieval** (pgvector, 95+ property docs pre-loaded) | ✅ Documented |
| **Agent tool calling** (12+ tools: calculators, contacts, pipeline, compliance) | ✅ Documented |
| **Token-based usage metering** (Cursor-style, 5 tiers, top-ups) | ✅ Documented |
| **Multi-tenant SaaS** (database-per-tenant, stancl/tenancy) | ✅ Documented |
| **BYOK** (bring your own AI provider key) | ✅ Documented |
| **BYOC** (bring your own content — upload docs, train Carina) | ✅ Documented |
| **Public REST API** (chat, knowledge, analysis, agent bridge) | ✅ Documented |
| **Web UI** (Blade + Alpine + Tailwind v4) | ✅ Documented |
| **PWA** (offline, installable, push notifications) | ✅ Documented |
| **Live property data APIs** (PropertyData, Tavily, EPC — auto-ingest into RAG) | ✅ Documented |
| **Image generation** (DALL-E 3, Imagen, Stable Diffusion) | ✅ Documented |
| **Python ML engine** (valuation, area scoring, portfolio analysis, batch processing) | ✅ Documented |
| **Fine-tuning / continuous learning** (opt-in, per-tenant LoRA adapters) | ✅ Documented |
| **Community intelligence sharing** (groups, shared RAG, deal marketplace) | ✅ Documented |
| **Team workspaces** (multi-user, role-based, shared knowledge) | ✅ Documented |
| **Expert network** (paid consultations, 80/15/5 revenue split) | ✅ Documented |
| **Gamification / loyalty / referrals** (contribution-based, token rewards) | ✅ Documented |
| **Data sharing consent** (join group = consent. Three data states.) | ✅ Documented |
| **Graceful degradation** (8 layers, never silent, 100% response rate) | ✅ Documented |
| **Security & forensics** (10 domains, tamper-evident audit, prompt injection guard) | ✅ Documented |
| **GDPR / privacy** (full rights, opt-in learning, data portability, DPA) | ✅ Documented |
| **Mobile native apps** (Kotlin + Swift, phase 2) | ✅ Documented |
| **Desktop apps** (macOS/Windows/Linux, phase 3) | ✅ Documented |
| **Browser extension** (phase 3) | ✅ Documented |
| **SDK libraries** (Python, JS, PHP, phase 2) | ✅ Documented |

---

## Pricing Summary

| Tier | Price | Tokens/mo | API Calls | Train My AI | BYOK | Team | White-Label |
|---|---|---|---|---|---|---|---|
| Free | £0 | 5K | 100 | ❌ | No | 1 user | No |
| Pro | £20/mo | 50K | 1K | ❌ | No | 1 user | No |
| Pro+ | £60/mo | 150K (3x) | 3K | ✅ | No | 3 users | No |
| Ultra | £100/mo | 250K (5x) | 5K | ✅ | Yes | 10 users | No |
| Enterprise | £200/mo | 500K | 10K | ✅ | Yes | Unlimited | ✅ |

Annual: 25% off. On-demand top-ups: £3-£150.

---

## Build Timeline

```
Week  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21
     ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
P0   │▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  Foundation
P1   │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  Chat + API
P2   │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  │  │  Web + PWA
P3   │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  │  │  │  Billing
P4   │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  │  │  │  Knowledge
P5   │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│▓▓│▓▓│  │  │  │  │  │  │  ML Engine
P6   │  │  │  │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  │  │  │  │  │  Integrations
P7   │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│▓▓│▓▓│  │  Mobile
P8   │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │  │▓▓│▓▓│▓▓│  Learning
     └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
```

**First paying users: Week 10.**  
**Beta launch: Week 8.**  
**Full launch: Week 20.**

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                     CARINA STANDALONE                              │
│                                                                   │
│  ┌──────────────────────┐    ┌──────────────────────────────┐    │
│  │  LARAVEL (PHP)       │    │  PYTHON (FastAPI + Celery)   │    │
│  │                      │    │                              │    │
│  │  ┌────────────────┐  │    │  ┌────────────────────────┐  │    │
│  │  │ Web UI (Blade) │  │    │  │ Model Serving          │  │    │
│  │  │ PWA            │  │──►│  │ - Valuation             │  │    │
│  │  ├────────────────┤  │    │  │ - Area scoring          │  │    │
│  │  │ REST API       │  │    │  │ - Portfolio analysis    │  │    │
│  │  │ Agent Bridge   │  │    │  │ - Fine-tuning           │  │    │
│  │  ├────────────────┤  │    │  └────────────────────────┘  │    │
│  │  │ Auth + Tenancy │  │    │  ┌────────────────────────┐  │    │
│  │  │ (stancl)       │  │    │  │ Batch Processing       │  │    │
│  │  ├────────────────┤  │    │  │ - Daily market digest  │  │    │
│  │  │ Billing        │  │    │  │ - Weekly reports       │  │    │
│  │  │ (Stripe+Tokens)│  │    │  └────────────────────────┘  │    │
│  │  ├────────────────┤  │    └──────────────────────────────┘    │
│  │  │ RAG Engine     │  │                                       │
│  │  │ (pgvector)     │  │    ┌──────────────────────────────┐    │
│  │  ├────────────────┤  │    │  EXTERNAL DATA APIS          │    │
│  │  │ AI Router      │  │    │  PropertyData · Tavily · EPC │    │
│  │  │ (Multi-Provider)│  │    │  Land Registry · Google Maps│    │
│  │  ├────────────────┤  │    │  (Auto-ingest into RAG)      │    │
│  │  │ Community      │  │    └──────────────────────────────┘    │
│  │  │ Groups/Sharing │  │                                       │
│  │  └────────────────┘  │    ┌──────────────────────────────┐    │
│  └──────────────────────┘    │  AI PROVIDERS (Rotating)      │    │
│                              │  DeepSeek ◄── OpenAI ◄──     │    │
│  ┌──────────────────────┐    │  Anthropic ◄── Google Gemini │    │
│  │  EXTERNAL AGENTS     │    │  (Cost-priority + Circuit    │    │
│  │  Propreneur · Loom   │    │   Breaker + Health Checks)   │    │
│  │  Third-party apps    │    └──────────────────────────────┘    │
│  │  (via API Bridge)    │                                       │
│  └──────────────────────┘                                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## Cost to Run

| Phase | Users | Monthly Cost | Monthly Revenue (at capacity) |
|---|---|---|---|
| MVP | 0-500 | ~£25/mo (share Propreneur's VPS) | £0-£5K |
| Growth | 500-25K | ~£150-300/mo | £5K-£50K |
| Scale | 25K-250K | ~£500-1K/mo | £50K-£500K |
| Enterprise | 250K+ | ~£2K-10K/mo | £500K+ |

---

## Quick Start for Building

1. **Read:** `CODING_STANDARDS.md` — how we write code.
2. **Read:** `ARCHITECTURE.md` — the full system picture.
3. **Read:** `ROADMAP.md` — what to build and when.
4. **Start P0:** `INFRASTRUCTURE.md` — set up the Docker stack.
5. **Start P1:** `API_SPEC.md` + `PROVIDER_ROTATION.md` — the AI engine.
6. **Start P2:** `ONBOARDING_ACTIVATION.md` + web UI.
7. **Start P3:** `BILLING_USAGE_METERING.md` — token metering.

Everything else is a reference document — consult when you reach that phase.

---

*"Property is the largest asset class in the world. Carina is the AI that speaks its language."*

**VERLOX Ltd (UK)** — Building Carina AI
