# Application Architecture

**Last updated:** 2026-05-15

## Overview

Propreneur v2 is a multi-tenant property investment management platform built on Laravel 12 with PostgreSQL 16, designed for UK landlords, investors, and property professionals.

**Key design principles:**
- Multi-tenant by design (database-per-tenant via stancl/tenancy v3)
- Modular service-layer architecture
- AI-first with embedded RAG knowledge base (Carina)
- UK property market specific (yield calcs, HMO licensing, stamp duty)
- CE/BE edition split via `config/edition.php`

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Laravel 12.56.x |
| PHP | 8.3.x |
| Database | PostgreSQL 16 (with pgvector for RAG embeddings) |
| Multi-tenancy | stancl/tenancy v3 (database-per-tenant) |
| AI | Anthropic Claude (primary), Groq, DeepSeek, OpenAI, OpenRouter, Google Gemini - multi-provider BYOK chain |
| Frontend | Blade + Alpine.js + Tailwind CSS v4 + design tokens |
| Build | Vite + Laravel Vite plugin |

## Directory Layout

```
propreneur-v2/
├── app/
│   ├── Billing/               # BillingModule enum, subscription gates
│   ├── Console/Commands/      # Artisan commands (rag, scout, backup, mentoring, vcal, etc.)
│   ├── Enums/                 # Tenant/ListingSourceDriver, Backup/BackupJobStatus, etc.
│   ├── Events/                # Domain events (DealCreated, VcalBookingConfirmed, etc.)
│   ├── Exceptions/            # Carina rate limit, LeadFunnel MetaApi exceptions
│   ├── Filament/              # Central admin Filament resources (RAG, Carina, Lead Funnel, AI providers)
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Api/           # JSON API controllers (Carina, Accounting, CRM, Lead Funnel, RAG, etc.)
│   │   │   ├── Billing/       # Stripe billing portal, invoices, plans
│   │   │   ├── Central/       # Central domain admin controllers
│   │   │   └── Tenant/        # Tenant-scoped Blade controllers
│   │   └── Middleware/        # CheckSubscriptionFeature, EnsureFeatureFlagEnabled, etc.
│   ├── Jobs/                  # Queue jobs (RAG, Lead Funnel, Accounting integration, etc.)
│   ├── Listeners/             # Event listeners (NotifyTenantOwnerOfHotLead, etc.)
│   ├── Mail/                  # Mailables (Mentoring, Vcal, Invitations)
│   ├── Models/
│   │   ├── Central/           # Tenant, Domain, PlatformUser, Subscription, FeatureFlag, etc.
│   │   └── Tenant/            # Per-tenant models (Property, DealAnalysis, Contact, etc.)
│   ├── Notifications/         # In-app and email notifications
│   ├── Providers/             # Service providers including TenancyServiceProvider
│   ├── Services/              # Domain services (Carina, Deals, Crm, Pipeline, Vcal, Accounting, etc.)
│   └── Support/               # Enums, catalogs, helpers (PlatformFeatureCatalogue, BillingCatalog, etc.)
├── brain/
│   ├── knowledge/             # Carina RAG training corpus (markdown)
│   └── prompts/               # Development prompts and task definitions
├── config/                    # 35+ config files
├── database/
│   ├── migrations/            # Central DB migrations
│   │   └── tenant/            # Tenant DB migrations
│   └── seeders/               # TenantBootstrapSeeder, FunnelStageSeeder, etc.
├── resources/
│   └── views/                 # Blade templates (tenant/, central/, partials/)
├── routes/                    # 17 route files (tenant.php + tenant_*.php + central + api)
├── scripts/                   # build-route-knowledge.py, pgvector-enable-tenant-db.sh
└── tests/                     # Feature + Unit tests
```

## Subscription-gated Modules

See `App\Billing\BillingModule` enum. Each module has a feature flag key and optional `subscription.feature` middleware gate:

- `deal_engine` - Deal analysis, calculators, listing feeds, sourcing
- `crm` - Contact management, investor profiles
- `pipeline` - Kanban boards, deal stages, portfolio promotion
- `compliance` - Certificate/licence tracking, document vault
- `carina_ai` - Standard Carina chat + RAG
- `carina_agent` - Tool-calling multi-step Carina mode (Professional+)
- `multi_property` - Portfolio hub (properties)
- `mentoring_os` - Mentorship programmes, cohorts, invoicing
- `community_learning` - Posts, groups, courses, quizzes, badges
- `integrations` - Third-party API connectors (PropertyData, Zoom, Xero, etc.)
- `lead_funnel` - Paid social lead ingestion (Meta/LinkedIn/TikTok)
- `reporting_intelligence` - Reports, analytics, dashboard widgets
- `accounting` - Double-entry GL, chart of accounts, trial balance
- `booking_calendar` - viCal (Verlox Integrated Calendar)
- `document_vault` - Planned
- `project_management` - Planned

## Tenancy Model

Database-per-tenant via stancl/tenancy v3. Central DB `propreneur_central` stores tenants, domains, subscriptions. Each workspace has an isolated DB `propreneur_t_{uuid}`.

Subdomain resolution: `{slug}.{TENANT_BASE_DOMAIN}` → `domains` table → `Tenant` → initialise tenant DB connection.

Tenant model (`app/Models/Central/Tenant`) columns: `id`, `slug`, `company_name`, `owner_name`, `owner_email`, `plan`, `trial_ends_at`, `edition`, `module_sets`, `is_active`.

## Edition Split

`config/edition.php`: `PROPRENEUR_EDITION` = `community` | `business`. Business Edition owns: Carina AI, mentoring OS, viCal/booking, HR/payroll, business page CMS.

## Key Config Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (DB creds, API keys) |
| `config/ai.php` | AI provider settings, Carina persona, product inventory |
| `config/carina.php` | Rate limits, RAG chunking, conversation retention, training |
| `config/billing.php` | Stripe keys, subscription plans, module sets |
| `config/edition.php` | CE/BE deployment edition |
| `config/tenancy.php` | Tenant model, central domains, bootstrappers |
| `config/listings.php` | Listing import drivers, automation, licensed feeds |
| `config/lead_funnel.php` | Meta/LinkedIn/TikTok credentials, scoring thresholds |
| `config/vcal.php` | viCal defaults |

## Brain knowledge sync (Propreneur and Carina standalone)

`brain/knowledge/*.md` is the **canonical** tenant-facing Carina RAG corpus for Propreneur. Standalone Carina (Aiva, property-uk pack) consumes a **mirror** synced from this tree; do not edit the mirror by hand.

**After changing any file under `brain/knowledge/`:**

1. **Propreneur in-app RAG** (from `propreneur-v2/`):
   ```bash
   php artisan rag:ingest-brain-knowledge
   php artisan carina:verify --tenant=xelox
   ```
2. **Carina standalone mirror + property-uk ingest** (from `carina/02-backends/core.carinaai.uk/`):
   ```bash
   pnpm brain:sync-and-ingest
   ```

Optional path overrides: `BRAIN_KNOWLEDGE_PATH`, `BRAIN_MASTERBRAIN_PATH` in `.env` (see `config/paths.php`).  
Full runbook: `carina/01-devends/planning/operations/BRAIN_SYNC.md`.
