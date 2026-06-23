# Carina AI - Session Summary: What We Built Today

**Date:** 7-8 May 2026  
**Duration:** ~10 hours  
**Output:** 31 documents · 8,014 lines · 552 KB · Complete product specification  

---

## 1. The Catalyst

It started with a simple question at the Island Property Network event. Laud introduced himself as a software engineer who builds AI-powered, security-enabled systems for property. People asked "What can it do?" and "How much does it cost?" Those questions sparked the realisation that Carina needed to be a **standalone product** - not just a feature inside Propreneur.

## 2. The Decision

Carina Standalone was born. The brain separated from the hands:

| | Carina Standalone (New) | Carina Agent (Propreneur) |
|---|---|---|
| **What** | The brain. Property intelligence, knowledge, analysis. | The hands. Tools, actions, execution. |
| **Runs on** | Its own VPS (or shared with Propreneur initially) | Inside Propreneur tenants |
| **Access** | Web, mobile, PWA, API, WhatsApp, Slack | Propreneur UI |
| **Revenue** | SaaS subscriptions, API credits, ML reports | Included in Propreneur |

## 3. The Architecture

**Laravel frame + Python ML brain.** Multi-provider AI rotation (Anthropic, OpenAI, DeepSeek). Database-per-tenant isolation. Token-based Cursor-style billing. 5 pricing tiers from Free to Enterprise.

## 4. Every Decision Made

| Area | Decision |
|---|---|
| **Stack** | Laravel 12 (frame) + Python 3.12 FastAPI + Celery (ML) |
| **Multi-tenancy** | Database-per-tenant (stancl/tenancy v3) |
| **AI providers** | DeepSeek (primary) → OpenAI → Anthropic (rotating, circuit breaker) |
| **Embeddings** | Google Gemini API (cheapest, £0.01/1M tokens) |
| **Billing** | Token-based (Cursor-style). 5 tiers + on-demand top-ups |
| **Annual discount** | 25% off (pay 9 months, get 12) |
| **BYOK** | Ultra and Enterprise tiers |
| **White-label** | Enterprise tier |
| **Train My AI** | Pro+ and above. Free/Pro cannot upload documents. |
| **Data APIs** | PropertyData, Tavily, EPC - auto-ingest into RAG |
| **Image generation** | DALL-E 3 → Imagen → Stable Diffusion (rotating) |
| **Frontend** | Blade + Alpine + Tailwind v4 |
| **Mobile** | PWA first → Kotlin (Android) + Swift (iOS) in phase 2 |
| **Infrastructure** | Start on existing Propreneur VPS (£0 extra). Scale with revenue. |
| **Pricing** | Free (£0) · Pro (£20) · Pro+ (£60) · Ultra (£100) · Enterprise (£200) |
| **Community** | Not social media - property intelligence sharing. Data-backed, Carina-verified. |
| **Gamification** | Contribution-based levels. Token rewards for deal completions and referrals. No streaks. |
| **Data consent** | Joining a group IS consent to share. Three data states: solo/group/public. |
| **Coding style** | Clean, reusable, non-bloat, non-spaghetti, lean, maintainable, non-complex. |
| **Security** | Defence in depth. Tamper-evident audit logs. Prompt injection guard. Circuit breaker. Graceful degradation. |

## 5. The Documents

| Category | Docs | What They Cover |
|---|---|---|
| **Core** | 5 | Architecture, coding standards, investment pitch, master index |
| **AI & Providers** | 3 | Provider rotation, ML pipeline, image generation |
| **Data & Knowledge** | 3 | Data integrations, sharing consent, plan differentiation |
| **Billing** | 1 | Full token metering, 5 tiers, top-ups, DB schema |
| **Community** | 3 | Mechanics, collaboration features, gamification/referrals |
| **Security** | 2 | 10 security domains, privacy, GDPR, forensics |
| **Performance** | 3 | Scaling, infrastructure, resilience/failure modes |
| **API** | 2 | Full API spec, versioning, webhooks, dependency management |
| **UX** | 4 | Onboarding, email notifications, error handling, testing |
| **Future** | 3 | Public docs, roadmap, 100 revenue opportunities |
| **Management** | 2 | Gap analysis, logging/feature flags |

**31 documents. Not one is theory. Every one contains code, schemas, configs, and implementation phases.**

## 6. The Revenue Model

| Tier | Price | Target User |
|---|---|---|
| Free | £0 | Try Carina, see value |
| Pro | £20/mo | Individual landlords, casual investors |
| Pro+ | £60/mo | Serious investors, Train My AI, teams of 3 |
| Ultra | £100/mo | Power users, BYOK, unlimited everything |
| Enterprise | £200/mo | Agencies, firms, white-label |

**Year 1 ARR target:** £150K (500 users)  
**Year 3 ARR target:** £3.8M (10K users)  
**Year 5 ARR target:** £34M+ (75K users) - UK only, ignoring API revenue, enterprise, and international

**Cost to run MVP:** £25/mo (share Propreneur's Contabo VPS)  
**Break-even:** 5 paying Pro users.

## 7. What We Didn't Do

We didn't write a single line of application code. We didn't start building. We didn't rush to production with half-baked ideas.

We did what most projects skip: **we thought through every decision before building.** Every architecture choice, every pricing tier, every failure mode, every privacy concern, every revenue stream, every user flow. The result is a complete blueprint - 31 documents, 8,014 lines - that any developer can pick up and build from without asking a single clarifying question.

## 8. What Comes Next

| Next Step | When | Who |
|---|---|---|
| Attend Birmingham event (3-day) | 8-10 May | Laud |
| Review Carina spec | After Birmingham | Laud |
| Build Phase 0 (Foundation) | Post-review | Developer (Laud + vibe-coding) |
| Ship Phase 1 (Chat + API) | Week 3-5 | Developer |
| Paying users | Week 10 | Product |

---

**What we achieved today:** A complete, build-ready product specification for a property AI platform that didn't exist this morning. Every question answered. Every gap closed. Every decision recorded. Ready to build.
