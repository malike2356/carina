# Carina AI — Directory Index

**Repository:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Status:** Pre-build (specification complete, application code not yet written)
**Last indexed:** 8 May 2026

---

## Root Files

| File | Purpose |
|---|---|
| `README.md` | Master index. Start here. Feature summary, pricing, build timeline, architecture diagram. |
| `ARCHITECTURE.md` | Full system architecture. Stack decisions, multi-tenancy model, API surface, deployment, project structure. |
| `BUILD_SEQUENCE.md` | Authoritative step-by-step build order. 61 steps across 13 phases. Maps every step to its architecture doc. |
| `CODING_STANDARDS.md` | 7 coding principles. Naming conventions. Testing standards. Non-negotiable. |
| `INVESTMENT_PROPOSAL.md` | Complete investment pitch. £650M TAM, £500K pre-seed ask, financial projections to Year 5. |
| `SESSION_SUMMARY.md` | Decision log from the founding session (7-8 May 2026). Every architectural decision recorded. |
| `CLAUDE.md` | Project-specific instructions for Claude Code (AI assistant). |
| `INDEX.md` | This file. |

---

## architecture/ — Specification Documents

All 27 documents in this directory are build-ready specifications. Every one contains implementation detail, schemas, or code.

### AI & Provider Layer

| File | Lines | What It Covers |
|---|---|---|
| `PROVIDER_ROTATION.md` | 406 | Smart AI router: cost-priority, round-robin, capability-priority, health-based. Circuit breaker. Budget-aware routing. Provider multipliers. |
| `ML_PIPELINE.md` | 82 | Python FastAPI + Celery services. Valuation, area scoring, risk models. Batch processing. LoRA fine-tuning pipeline. |
| `IMAGE_GENERATION.md` | 252 | DALL-E 3, Imagen, Stable Diffusion XL. Token pricing per image. Multi-provider rotation. Use cases: property visualisation, floor plans, marketing. |

### Billing & Metering

| File | Lines | What It Covers |
|---|---|---|
| `BILLING_USAGE_METERING.md` | 564 | Token-based Cursor-style billing. 5 tiers. On-demand top-ups. Provider multipliers. DB schema. Usage dashboard UI spec. Spending controls. Annual discount. |
| `PLAN_DIFFERENTIATION.md` | 137 | 9 differentiation dimensions beyond token quantity. Upgrade triggers. Hard gates (Train My AI = Pro+). |
| `PREPAID_TOKENS.md` | — | Prepaid token bundle mechanics. |

### Data & Knowledge

| File | Lines | What It Covers |
|---|---|---|
| `DATA_INTEGRATIONS.md` | 177 | PropertyData.co.uk, Tavily, EPC API, Land Registry, Google Maps. Auto-ingest pipeline — every API call analysed + stored into RAG. RAG-first decision flow. |
| `DATA_SHARING_CONSENT.md` | 201 | Joining a group IS consent. Three data states: solo/group/public. Immutable consent audit trail. |

### Community & Collaboration

| File | Lines | What It Covers |
|---|---|---|
| `COMMUNITY_MECHANICS.md` | 296 | Property intelligence sharing (not social media). Data-backed posts with Carina verification. Filtered intelligence stream. RAG knowledge compounding. |
| `COMMUNITY_COLLABORATION.md` | 279 | Workspaces, conversation sharing, groups, expert network (paid consultations), deal marketplace. Revenue splits. |
| `GAMIFICATION_LOYALTY_REFERRALS.md` | 316 | Contribution-based levels (not engagement). Token rewards. Group achievements. Loyalty multiplier. No streaks, no leaderboards. |

### Security & Privacy

| File | Lines | What It Covers |
|---|---|---|
| `SECURITY_CYBER_FORENSICS.md` | 508 | 10 security domains: auth, application, AI-specific, tenant isolation, data security, tamper-evident audit (hash chain), forensics (IR plan), infrastructure, privacy, compliance. Prompt injection guard. |
| `PRIVACY_SECURITY.md` | 134 | Database-per-tenant isolation. Continuous learning opt-in (off by default). API key scopes. Data retention. GDPR compliance. |

### Performance & Infrastructure

| File | Lines | What It Covers |
|---|---|---|
| `INFRASTRUCTURE.md` | 425 | Phase 1-3 infrastructure. Hetzner VPS shared with Propreneur (MVP) → dedicated DB + Redis → auto-scaling. Docker Compose config. Hosting comparison. Monitoring stack. Backup strategy. |
| `PERFORMANCE_SCALING.md` | 261 | 8 strategies: multi-layer caching (Redis → RAG → CDN), predictive pre-fetching, streaming, async, horizontal scaling, GPU on-demand, smart routing, query debouncing. |
| `RESILIENCE_FAILURE_MODES.md` | 371 | 8 layers of graceful degradation. Failure mode matrix. Circuit breaker. RAG-first with stale data tolerance. Queued retry. Offline survival. 100% response rate, varying quality. |

### API & Integration

| File | Lines | What It Covers |
|---|---|---|
| `API_SPEC.md` | 205 | All endpoints: chat, stream, knowledge, analysis, agent bridge, usage, billing, image generation. Auth, rate limits, error codes. Agent Bridge spec for Propreneur integration. |
| `API_VERSIONING_WEBHOOKS_DEPS.md` | 208 | URL-based versioning (v1/v2). 6-month deprecation window. Webhook system (events, signing, retry). Dependency management schedule. |

### User Experience

| File | Lines | What It Covers |
|---|---|---|
| `ONBOARDING_ACTIVATION.md` | 143 | Signup → verify → first chat → activation → upgrade. Role-based starter questions. Conversion funnel metrics. Free tier limits as conversion drivers. |
| `EMAIL_NOTIFICATIONS.md` | 105 | Transactional emails (Postmark). Usage warnings. Weekly digest. Push notifications (PWA). In-app notifications. Notification priority levels. |
| `ERROR_HANDLING.md` | 172 | Global error response format. Error codes by category. User-facing messages for every scenario. Error UI (inline banner). Logging structure. |
| `TESTING_CI_CD.md` | 154 | Test pyramid (unit → feature → integration → E2E). Coverage gates (90% unit, 80% feature). CI/CD pipeline (PHPStan → Pest → pytest → Docker → deploy). |

### Future & Growth

| File | Lines | What It Covers |
|---|---|---|
| `DOCS_ACCESSIBILITY_FUTURE.md` | 188 | Public docs site (MkDocs). WCAG 2.1 AA. API playground (Swagger). Desktop app. Browser extension. SDK libraries (Python, JS, PHP). Status page. |
| `ROADMAP.md` | 184 | 8-phase visual roadmap. P0-P8. Gantt-style timeline to Week 21 (high-level overview). |
| `100-REVENUE-OPPORTUNITIES.md` | 154 | 100 monetisation ideas across 10 categories: SaaS, API, knowledge, ML, compliance, content, education, lead gen, B2B, platform. |

### Project Management

| File | Lines | What It Covers |
|---|---|---|
| `GAP_ANALYSIS.md` | 362 | Original gap analysis identifying 13 missing areas. All gaps now closed. Reference only. |
| `LOGGING_FEATURE_FLAGS.md` | 169 | Logging strategy (levels, channels, structured JSON). Feature flags (off/internal/beta/percent/on). Admin UI for flag management. |

---

## prompts/ — AI Context Prompts

| File | Purpose |
|---|---|
| `project-prompt.md` | Quick-start context for AI-assisted development sessions. Paste this into an AI assistant to instantly context it on the project. |

---

## Scaffolded Directories (No Application Code Yet)

These directories were created to match the target project structure. They will be populated during Phase 0-1 of the build.

| Directory | Target Contents |
|---|---|
| `laravel/` | Full Laravel 12 application (forked from Propreneur, stripped to Carina engine) |
| `laravel/app/Carina/` | Carina engine: AiRouterService, CarinaAgentService, CarinaToolRegistry, Tools/ |
| `laravel/app/Http/Controllers/Api/` | REST API controllers |
| `laravel/app/Http/Controllers/Web/` | Web UI controllers |
| `laravel/app/Models/Central/` | Central database models (Tenant, PlatformUser, Subscription) |
| `laravel/app/Models/Tenant/` | Tenant database models (Conversation, RagChunk, UsageLog) |
| `laravel/app/Services/Rag/` | RAGService, EmbeddingService, DocumentChunker |
| `laravel/app/Services/Billing/` | Stripe subscription and token metering services |
| `laravel/app/Services/Training/` | Continuous learning opt-in pipeline |
| `laravel/brain/knowledge/` | Default property knowledge docs (port 95+ from Propreneur) |
| `laravel/brain/prompts/` | Carina persona + agent bridge system prompts |
| `laravel/config/` | carina.php, ai.php, billing.php |
| `laravel/database/migrations/` | Central and tenant DB migrations |
| `laravel/resources/` | Blade views, Alpine.js, Tailwind v4 CSS |
| `laravel/routes/` | api.php, web.php |
| `python/` | FastAPI ML engine (valuation, area scoring, risk, portfolio, fine-tuning) |
| `python/models/` | valuation.py, area_scoring.py, risk.py |
| `python/analytics/` | portfolio.py, sensitivity.py |
| `python/ingestion/` | document_parser.py (OCR, DOCX, PDF) |
| `python/training/` | fine_tune.py (per-tenant LoRA adapters) |
| `mobile/android/` | Kotlin + Jetpack Compose app (Phase 11) |
| `mobile/ios/` | Swift + SwiftUI app (Phase 11) |
| `docker/` | Dockerfile.laravel, Dockerfile.python, docker-compose.yml |
| `api/` | API client examples / SDK scaffold |
| `docs/` | Public documentation site (MkDocs — Phase 13) |
| `ml/` | Trained model weights and artefacts |

---

## Quick-Start Reading Order

For a new developer starting the build:

```
1. README.md                        ← master index
2. CODING_STANDARDS.md              ← coding rules (read before touching code)
3. ARCHITECTURE.md                  ← full system picture
4. BUILD_SEQUENCE.md                ← what to build and in what order
5. architecture/INFRASTRUCTURE.md   ← set up Docker stack (Phase 0)
6. architecture/API_SPEC.md         ← build the API (Phase 1)
7. architecture/PROVIDER_ROTATION.md ← wire up AI providers (Phase 1)
8. architecture/BILLING_USAGE_METERING.md ← token metering (Phase 3)
```

Everything else is a reference document — consult it when you reach the relevant phase.
