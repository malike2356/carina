# Carina AI — Project Prompt

Carina Standalone is a property-specific AI platform. The brain. She lives on her own VPS, trained on property data, accessible via web, mobile, PWA, and API.

**Stack:** Laravel 12 (frame) + Python 3.12 FastAPI (ML engine) + PostgreSQL 16 + pgvector + Redis + Meilisearch.

**Multi-tenancy:** Database-per-tenant (stancl/tenancy v3).

**Multi-provider AI:** Anthropic, Groq, DeepSeek, OpenRouter, OpenAI, Google Gemini — configurable per tenant with BYOK.

**BYOC:** Upload PDF, DOCX, markdown, URLs. RAG with pgvector.

**Frontend:** Blade + Alpine + Tailwind v4. PWA for mobile. Native Android + iOS in phase 2.

**API:** REST API for third-party agent integration. Agent Bridge endpoint lets external apps (Propreneur, Loom) call Carina for intelligence while handling execution locally.

**ML Engine:** Python FastAPI + Celery. Property valuation, area scoring, deal risk assessment, portfolio analysis. Fine-tuning pipeline for opt-in continuous learning.

**Billing:** Stripe. Token-based metering (Cursor-style). 5 tiers: Free (£0) / Pro (£20) / Pro+ (£60) / Ultra (£100) / Enterprise (£200). On-demand top-up bundles.

**Privacy:** Database-per-tenant isolation. Continuous learning is opt-in only, off by default. GDPR compliant: export/delete on request.

**Directory:** `/opt/lampp/htdocs/VERLOX/Carina-ai/`
**Master index:** `README.md` — start here
**Architecture:** `ARCHITECTURE.md` (root)
**Build order:** `BUILD_SEQUENCE.md` (root)
**API Spec:** `architecture/API_SPEC.md`
**ML Pipeline:** `architecture/ML_PIPELINE.md`
**Billing:** `architecture/BILLING_USAGE_METERING.md`
