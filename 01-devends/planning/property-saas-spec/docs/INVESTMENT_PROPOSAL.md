# Carina AI - Investment & Funding Proposal

**Prepared by:** VERLOX Ltd (UK)  
**Product:** Carina AI - The Property Intelligence Platform  
**Contact:** Laud Paul-Gablah, Founder  
**Date:** 8 May 2026  
**Status:** Pre-seed / Seed Round  

---

## Executive Summary

Carina AI is a **property-specific artificial intelligence platform** that lives independently in the cloud, trained on UK property data, and accessible via web, mobile, PWA, and API. She is not a chatbot that happens to know about property - she is an **intelligence layer purpose-built for the largest asset class in the world**.

The UK property market comprises **2.5 million private landlords, 20,000 letting agents, 15,000 estate agencies, 5,000+ property developers, and 250,000+ property investors and sourcers** - all of whom make decisions daily based on regulation, market data, compliance, and deal analysis that is currently fragmented across dozens of tools, spreadsheets, and phone calls. Carina consolidates all of this into one AI-native platform.

**Carina is already functioning.** The core AI engine - multi-provider chat, RAG knowledge retrieval, agentic tool calling, 12 live tools - has been built, tested, and demonstrated within our existing product Propreneur. This funding request is to **extract Carina into a standalone, multi-tenant SaaS platform** with its own web UI, mobile apps, public API, and Python ML engine, and take it to market as an independent product.

**Ask:** £500,000 pre-seed / £1,500,000 seed  
**Use of funds:** Infrastructure, AI provider costs, vibe-coding development, team, go-to-market  
**Projected ARR:** £150K (Year 1) → £3.8M (Year 3) → £34M+ (Year 5)  

---

## 1. The Problem

Property professionals - landlords, investors, agents, developers, solicitors, surveyors - rely on fragmented tools and personal expertise to make decisions:

- **Compliance** changes constantly (Renters' Rights Act 2025, Awaab's Law 2030, HMO licensing reform)
- **Deal analysis** is done on Excel spreadsheets with inconsistent methodology
- **Market research** requires pulling data from 5+ sources (Rightmove, Zoopla, PropertyData, Land Registry, council portals)
- **Knowledge** is personal - when an expert leaves a firm, their knowledge leaves with them
- **Documentation** (tenancy agreements, section 21 notices, compliance certificates) is manual and error-prone
- **No single AI platform speaks property natively** - generic AI (ChatGPT, Claude) has shallow UK property knowledge and no tool integration

**The result:** Property professionals waste 10+ hours per week on tasks that Carina can do in seconds. Compliance errors cost landlords an average of £5,000-£50,000 per incident. Good deals are missed because the analysis takes too long.

---

## 2. The Opportunity

Property is the **largest asset class in the world**, valued at approximately **£280 trillion globally, £8.5 trillion in the UK alone**. Every participant in this ecosystem - from the individual landlord with one buy-to-let to the institution managing 10,000+ units - needs property-specific intelligence.

**The AI application layer in property is wide open.** The foundation models (DeepSeek, GPT, Claude, Gemini) are generalists. They don't understand UK property law, HMO room sizes, stamp duty calculations, or the difference between a BRR and a BTL. Carina sits on top of these models and adds:

- **Property-specific RAG knowledge** - 95+ curated documents covering every aspect of UK property
- **Multi-provider AI routing** - uses the best model for each task with automatic failover
- **Agentic tool execution** - can run calculations, create records, and take actions
- **ML-driven analytics** - custom models for valuation, area scoring, risk assessment
- **Continuous learning** - gets smarter with opt-in user data

**We are not building a neural network. We are building the property brain that wraps every existing AI model with domain expertise.**

---

## 3. The Solution: Carina AI

### What Carina Is

A **property-specific AI platform** - accessible via web, mobile, PWA, and API - that:

- Answers property questions with authority (law, tax, compliance, strategy, market)
- Analyses deals, portfolios, and areas with ML-powered accuracy
- Generates documents, reports, and content in seconds
- Learns from your documents (upload PDFs, URLs, and Carina knows your business)
- Connects to any app via API (Propreneur, CRMs, property software)
- Never loses knowledge - it's always in the cloud

### What Carina Is Not

- Not a chatbot wrapper - she has a knowledge base, tool system, and ML engine
- Not a property CRM - she integrates with CRMs via API
- Not a marketplace - she makes every participant in property more intelligent

### Architecture (Built and Tested)

```
User (Web / Mobile / API)
        │
        ▼
┌───────────────────────────────┐
│   CARINA AI PLATFORM          │
│                               │
│   Laravel (Web, API, Auth,    │
│   Billing, Tenancy, RAG)      │
│                               │
│   Python (ML, Analytics,      │
│   Document Processing)        │
│                               │
├───────────────────────────────┤
│   AI PROVIDER LAYER           │
│   (BYOK + Platform Keys)      │
│                               │
│   Anthropic │ Groq │ DeepSeek │
│   OpenRouter │ OpenAI │ Gemini│
└───────────────────────────────┘
```

### What Already Works

The core Carina engine has been built inside Propreneur and is **live and tested**:

| Component | Status | What It Does |
|---|---|---|
| Multi-provider AI routing | Done:  Live | Routes to Anthropic/Groq/DeepSeek/OpenRouter/OpenAI/Gemini with BYOK |
| RAG knowledge retrieval | Done:  Live | pgvector embeddings on 95+ property documents |
| Agent tool calling (12 tools) | Done:  Live | Calculators, contacts, pipeline, compliance, scheduling, destructive actions |
| Agent loop (multi-step reasoning) | Done:  Live | Up to 5 tool-call turns to complete complex tasks |
| Multi-tenancy (DB-per-tenant) | Done:  Live | stancl/tenancy v3, proven in production |
| Filament admin panels | Done:  Live | Knowledge management, usage dashboards |
| Stripe billing scaffold | Done:  Live | Subscription plans, feature gating |
| 35 unit tests passing | Done:  Live | Tool registry, access gates, response pipeline |
| Meilisearch document indexing | Done:  Live | Searchable document store |
| Knowledge doc pipeline | Done:  Live | 95 documents extracted for Carina's brain |

### What Funding Will Build

| Component | Est. Effort | Cost |
|---|---|---|
| Standalone Laravel app (extract Carina from Propreneur) | 2 weeks | £5,000 |
| Web UI (Blade + Alpine + Tailwind) | 3 weeks | £7,500 |
| PWA (service worker, offline, installable) | 1 week | £2,500 |
| Public REST API (for third-party agent integration) | 3 weeks | £7,500 |
| Agent Bridge (Propreneur → Carina Standalone) | 1 week | £2,500 |
| Python ML engine (FastAPI + models) | 6 weeks | £15,000 |
| Valuation model (ML training + deployment) | 4 weeks | £10,000 |
| Area scoring model (ML training + deployment) | 3 weeks | £7,500 |
| Android app (Kotlin) | 6 weeks | £15,000 |
| iOS app (Swift) | 6 weeks | £15,000 |
| Billing & subscription system | 2 weeks | £5,000 |
| Continuous learning pipeline | 3 weeks | £7,500 |
| Total build | ~40 weeks | £100,000 |

---

## 4. Market Size

### Total Addressable Market (UK)

| Segment | Size | Annual Value/person | TAM |
|---|---|---|---|
| Private landlords | 2,500,000 | £180 (£15/mo) | £450M |
| Letting agents | 20,000 agencies | £1,800 (£150/mo) | £36M |
| Estate agents | 15,000 firms | £1,800 (£150/mo) | £27M |
| Property developers | 5,000 firms | £2,400 (£200/mo) | £12M |
| Property investors/sourcers | 250,000 | £360 (£30/mo) | £90M |
| Property solicitors | 10,000 firms | £1,200 (£100/mo) | £12M |
| Surveyors | 8,000 firms | £1,200 (£100/mo) | £9.6M |
| Housing associations | 1,500 | £6,000 (£500/mo) | £9M |
| Local authorities (housing depts) | 400 | £12,000 (£1,000/mo) | £4.8M |
| **UK TAM** | | | **£650M+** |

### Total Addressable Market (Global)

UK is 5-7% of the global property market. If Carina expands to other English-speaking property markets (US, Canada, Australia, NZ, Ireland):

| Market | Multiple of UK | Est. TAM |
|---|---|---|
| UK | 1x | £650M |
| US | 5x | £3.25B |
| Canada | 0.8x | £520M |
| Australia | 0.6x | £390M |
| NZ / Ireland | 0.3x | £195M |
| **Global TAM** | **~7.7x** | **£5B+** |

### Serviceable Addressable Market (Year 1-3 Conservative)

Focus: UK landlords, investors, and agents. Penetration target:

| Year | Users | % of TAM | Revenue |
|---|---|---|---|
| 1 | 500 | 0.02% | £150K |
| 2 | 2,500 | 0.1% | £840K |
| 3 | 10,000 | 0.4% | £3.8M |

Reaching 1% of just the UK landlord segment = 25,000 users = £9M ARR. This ignores API revenue, data products, enterprise deals, and international expansion entirely.

---

## 5. Business Model

### Revenue Streams

| Stream | Description | Est. Year 1 | Est. Year 3 |
|---|---|---|---|
| SaaS subscriptions | 10 tiers from £9.99-£79.99/mo | £90K | £1.2M |
| API credits | £5 per 1K calls for third-party embedding | £30K | £1.5M |
| ML reports | Area reports, valuations, portfolio health | £15K | £500K |
| Knowledge packs | Premium content upsells | £5K | £200K |
| Enterprise/white-label | Custom deployments | £10K | £200K |
| Marketplace | SDK, plugins, affiliate | £0 | £100K |
| Professional services | Consultancy, on-prem | £0 | £100K |
| **Total** | | **£150K** | **£3.8M** |

### Unit Economics

| Metric | Value |
|---|---|
| Customer acquisition cost (CAC) | £50-£150 (content-led + referral) |
| Average revenue per user (ARPU) | £25-£38/mo |
| Gross margin | 85%+ (AI API costs + hosting) |
| Lifetime value (LTV, 24mo avg) | £600+ |
| LTV:CAC ratio | 4:1 to 12:1 |
| Payback period | 3-6 months |

### Pricing

| Tier | Price | Target Customer |
|---|---|---|
| Free | £0 | Casual users, product virality |
| Starter | £9.99/mo | Individual landlords |
| Professional | £29.99/mo | Portfolio landlords, investors |
| Business | £49.99/mo | Letting agents, estate agents, HMO operators |
| Developer | £79.99/mo | Property developers, mentors |
| Enterprise | Custom | Agencies, housing associations, local authorities |

---

## 6. Competition

| Competitor | Weakness | Carina Advantage |
|---|---|---|
| ChatGPT / Claude | Generic, shallow UK property knowledge, no tool integration, no RAG | Property-specific, 95+ curated docs, 12 tools, BYOK |
| Property-specific CRMs (Poppy, Studio, etc.) | CRM-first, AI is an add-on not the core | AI-native, every feature starts with intelligence |
| Deal calculators (separate tools) | No integration, manual data entry | AI-driven, contextual, learns from your portfolio |
| Compliance software | Reactive, document-only | Proactive, Carina monitors and alerts |
| PropertyData / Land Insight | Data tools, no AI | AI + data = intelligence, not just charts |
| Property mentors / courses | One-to-many, expensive, inconsistent | Always-on, personalised, £29/mo vs £995/mo |

**Carina's moat:** The combination of property-specific RAG + multi-provider AI + agentic tool execution + ML analytics + a growing knowledge base is not replicated by any single competitor. Each competitor covers one piece. Carina is the intelligence layer that connects them all.

---

## 7. Traction & Milestones

### Built (Pre-Funding)

- [x] Carina AI engine: multi-provider routing, RAG, agent loop
- [x] 12 live agent tools (calculator, contacts, pipeline, compliance, scheduling)
- [x] 35 unit tests passing
- [x] 95+ curated property knowledge documents
- [x] Multi-tenancy (database-per-tenant, proven in production)
- [x] Meilisearch document indexing
- [x] Stripe billing scaffold
- [x] Filament admin panels
- [x] Demonstrated at Island Property Network (30+ property professionals)
- [x] 100 revenue opportunities identified

### Milestones (Funded)

| Milestone | Timeline | Cost |
|---|---|---|
| Standalone MVP shipped (web + API + PWA) | Month 2 | £25K |
| First 100 paid users | Month 3 | - |
| Agent Bridge live (Propreneur integration) | Month 3 | £5K |
| Python ML engine + first models live | Month 4 | £25K |
| First 500 paid users | Month 6 | - |
| Android app launched | Month 6 | £15K |
| iOS app launched | Month 7 | £15K |
| First 2,500 paid users | Month 12 | - |
| Knowledge marketplace live | Month 9 | £10K |
| Enterprise deals (first 3 clients) | Month 12 | - |
| Break-even (monthly) | Month 14 | - |
| International expansion (US) | Month 18 | £50K |

---

## 8. Funding Ask

### Pre-Seed Round: £500,000

| Use | Amount | % of Round |
|---|---|---|
| Development (vibe-coding + ML engineering) | £175,000 | 35% |
| AI provider costs (DeepSeek, Google Gemini, others) | £100,000 | 20% |
| Infrastructure (VPS, domains, Docker, CI/CD) | £25,000 | 5% |
| Marketing & go-to-market (content, ads, events, partnerships) | £100,000 | 20% |
| Operations & compliance (legal, accounting, tools) | £50,000 | 10% |
| Reserve (6 months runway buffer) | £50,000 | 10% |

**Runway:** 18-24 months  
**Target ARR at next round:** £150K-£500K  
**Next round:** Seed (£1.5M) at Month 12-18  

### Seed Round: £1,500,000 (If Pre-Seed is skipped)

| Use | Amount | % of Round |
|---|---|---|
| Full team (4-6 people, 18 months) | £750,000 | 50% |
| AI provider costs | £200,000 | 13% |
| Infrastructure & scaling | £100,000 | 7% |
| Sales & marketing | £250,000 | 17% |
| Mobile apps (native Android + iOS) | £100,000 | 7% |
| US market entry | £100,000 | 7% |

**Runway:** 18 months  
**Target ARR at Series A:** £2M+  
**Next round:** Series A at £1M-£5M ARR  

---

## 9. Team

### Current

| Role | Person | Notes |
|---|---|---|
| Founder / Systems Architect | Laud Paul-Gablah | 18+ yrs IT/cybersecurity/systems architecture. 15+ yrs entrepreneurship. MSc Cyber Security (Distinction). Built Propreneur (95+ docs, 16 calculators, 12 agent tools). |

### To Hire (Post-Funding)

| Role | FTE | When |
|---|---|---|
| Laravel Developer | 1 | Month 1 |
| Python ML Engineer | 1 | Month 1 |
| Frontend Developer (Blade/Alpine/Tailwind) | 1 | Month 2 |
| Mobile Developer (Kotlin + Swift) | 1 | Month 4 |
| Part-time: Marketing / Growth | 0.5 | Month 3 |
| Part-time: Customer Success | 0.5 | Month 6 |

---

## 10. Risk Analysis

| Risk | Mitigation |
|---|---|
| AI provider dependency (API changes, pricing hikes, outages) | Multi-provider BYOK architecture - fallback chain always active. No single provider lock-in. |
| AI API costs scale with usage | Provider cost arbitrage: use cheapest model for simple tasks, premium only when needed. Embedding costs are negligible (Google Gemini: ~£0.01/1M tokens). |
| Slow user adoption in traditional industry | Content-led growth: free area reports, deal analyser, compliance checkers - low friction entry points. Community-first (IPN, property networks). |
| Regulatory changes (Renters' Rights Act, Awaab's Law) | Opportunity, not risk. Each regulation change drives demand for compliance AI. Carina stays current. |
| LLM hallucination in property advice | RAG grounds all answers in curated knowledge. System prompt instructs "do not invent - if unsure, say you don't know." Audit trail on all responses. |
| Competition from generic AI (ChatGPT, Claude adding property knowledge) | Carina's moat is deeper than prompts. We have: curated knowledge base, tool execution, ML models, integrations, and a growing user base. Generic AI won't build 12 agent tools for property. |
| Data privacy / GDPR | Database-per-tenant isolation. Continuous learning is opt-in only, off by default. Full GDPR compliance (export, delete, portability). |

---

## 11. Exit Strategy

| Exit Path | Likely Acquirer | Est. Valuation |
|---|---|---|
| Acquisition | Property software companies (MRI Software, Yardi, Reapit, Qube, Goodlord) | £20M-£100M |
| Acquisition | AI platform companies (Anthropic, DeepSeek, Mistral - for domain-specific fine-tuning) | £15M-£50M |
| Acquisition | PropTech aggregators | £10M-£30M |
| Growth equity / Series B | Scale with international expansion | £50M+ |
| Independence | Profitable, growing, bootstrappable after Year 2 | - |

---

## 12. Summary

**Carina AI is the property brain that doesn't exist yet.**

The core engine is built and working. The market is enormous and underserved by AI. The business model has 100+ revenue streams across SaaS, API, ML, and enterprise. The team has demonstrated the ability to ship complex software (Propreneur v2 with 13 modules, 95 knowledge docs, 12 agent tools).

**Funding will take Carina from a proven engine inside Propreneur to a standalone, revenue-generating platform that owns the property AI category.**

---

*"Property is the largest asset class in the world. Carina is the AI that speaks its language."*

**Contact:** Laud Paul-Gablah - laudpaulgablah@gmail.com | +44 7392 616 178  
**VERLOX Ltd** - London & Portsmouth, UK
