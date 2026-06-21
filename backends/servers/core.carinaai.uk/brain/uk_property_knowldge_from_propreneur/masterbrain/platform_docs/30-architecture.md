# Application Architecture

**Updated:** 2026-05-14 (CE/BE edition split, BillingModule enum, new modules: Lead Funnel, viCal, reporting, accounting, community learning, integrations hub, investor portal, communications hub)

## Overview

Propreneur v2 is a multi-tenant property investment management platform built on Laravel 12 with PostgreSQL, designed for UK landlords, investors, and property professionals.

**Key design principles:**
- Multi-tenant by design (database-per-tenant model)
- Modular service-layer architecture
- AI-first with embedded RAG knowledge base
- UK property market specific (yield calcs, HMO licensing, stamp duty)
- CE/BE edition split (`config/edition.php`): Community Edition vs Business Edition. Business Edition owns: Carina AI, mentoring OS, viCal/booking, HR/payroll, business page CMS.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Laravel 12 (see `composer.lock`; constraint `^12.0`) |
| PHP | 8.3+ (`composer.json` constraint; CI/production 8.3+) |
| Database | PostgreSQL 16 (with pgvector for RAG embeddings) |
| Multi-tenancy | stancl/tenancy v3 (database-per-tenant) |
| AI | Multi-provider BYOK chain (`config/ai.php`; runtime merges central DB registry - see `23-ai-runtime-and-provider-registry.md`). Carina agent mode (tool-calling) on Professional+ plans. RAG: pgvector, `rag_chunks` per tenant DB, OpenAI embeddings (1536-d). Platform admin Carina knowledge training UI (OCR, PDF, ZIP, AV scan). |
| Frontend | Blade + **Alpine** + Tailwind **v4** + design tokens; **Filament v3** at `/filament` for selected central tooling (`26-filament-carina-rag-admin.md`). Default tenant UX is **not** Inertia/React yet (`99-tech-stack-comparison.md`). |
| Build | Vite + Laravel Vite plugin |

## Subscription-gated modules (BillingModule enum)

The canonical module list lives in `App\Billing\BillingModule`. Every module has a matching `FeatureFlag` key and optional subscription gate.

| Module | Key | Description |
|--------|-----|-------------|
| Deal Engine | `deal_engine` | Deals, calculators, listing feeds, sourcing |
| CRM | `crm` | Contact management, investor scoring |
| Pipeline | `pipeline` | Kanban boards, deal stages |
| Compliance | `compliance` | Certificate/licence tracking |
| Carina AI | `carina_ai` | Chat, RAG, deal narrative |
| Carina Agent | `carina_agent` | Tool-calling multi-step mode |
| Multi-Property | `multi_property` | Portfolio hub |
| Mentoring OS | `mentoring_os` | Programmes, cohorts, invoicing |
| Community Learning | `community_learning` | Posts, groups, courses, quizzes |
| Integrations | `integrations` | Third-party API connectors |
| Lead Funnel | `lead_funnel` | Paid social lead ingestion |
| Reporting | `reporting_intelligence` | Reports, analytics, exports |
| Accounting | `accounting` | Double-entry GL, integration |
| viCal | `booking_calendar` | Booking/calendar module |

Additional feature flags cover: workspace automation, communications hub, investor portal, tenant branding, platform tools (backup, SCOUT, remote access, job scheduler, audit logs, cross-tenant benchmark). See `App\Support\PlatformFeatureCatalogue` for the full list.

## Directory Layout

```
propreneur-v2/
├── app/
│   ├── Console/Commands/      # Artisan commands
│   ├── Exceptions/            # Error handlers
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Central/       # Central domain controllers (admin, billing)
│   │   │   └── Tenant/        # Tenant-specific controllers
│   │   ├── Middleware/        # Custom middleware
│   │   └── Requests/          # Form requests (validation)
│   ├── Models/
│   │   ├── Central/           # Central DB models (Tenant, Domain, Subscription)
│   │   └── Tenant/            # Tenant-scoped models
│   ├── Providers/
│   │   ├── AppServiceProvider.php
│   │   ├── TenancyServiceProvider.php  # Bootstraps multi-tenancy
│   │   ├── Filament/AdminPanelProvider.php  # /filament panel (platform guard)
│   │   └── ...
│   └── Services/
│       ├── Carina/            # AI chat service
│       ├── Compliance/        # Compliance tracking logic
│       └── ...                 # Other domain services
├── brain/
│   └── knowledge/             # Carina RAG knowledge base (markdown)
├── config/
│   ├── ai.php                 # AI provider config
│   └── tenancy.php            # Multi-tenancy settings
├── database/
│   ├── migrations/            # Central DB migrations
│   │   └── tenant/            # Tenant DB migrations
│   └── seeders/               # Database seeders
├── resources/views/
│   ├── layouts/               # Shared app layout (sidebar, nav)
│   └── tenant/                # Tenant-specific views
│       ├── contacts/
│       ├── compliance/
│       ├── deals/
│       ├── pipeline/
│       ├── properties/
│       ├── carina/
│       └── auth/
└── routes/
    ├── central.php            # Central domain routes
    └── tenant.php             # Tenant-scoped routes
```

## Tenancy Model

Propreneur uses a **database-per-tenant** architecture via stancl/tenancy v3.10:

- **Central database:** `propreneur_central` - stores tenants, domains, subscriptions
- **Per-tenant databases:** `propreneur_t_{tenant_id}` - stores all tenant data (properties, deals, contacts, etc.)

```php
// Tenant model (app/Models/Central/Tenant.php)
class Tenant extends BaseTenant implements TenantWithDatabase
{
    use HasDatabase, HasDomains;

    public static function getCustomColumns(): array
    {
        return [
            'id',
            'slug',
            'company_name',
            'owner_name',
            'owner_email',
            'plan',          // starter | professional | enterprise
            'trial_ends_at',
            'is_active',
        ];
    }
}
```

**Domain resolution:** The subdomain resolver extracts the tenant identifier from the hostname. For example, `test.propreneur.test` → `test` → looks up `domains` table → resolves `Tenant` → initialises tenant database connection.

## Middleware Pipeline (Tenant Routes)

```
web
  → InitializeTenancyBySubdomain   # Identifies tenant from hostname subdomain
  → PreventAccessFromCentralDomains # Blocks central domains from tenant routes
  → auth                            # Requires authentication
  → Controller...
```

## Route Structure

All tenant routes are defined in `routes/tenant.php` and grouped under:
- `middleware: guest` - login, password reset
- `middleware: auth` - all authenticated routes (dashboard, properties, deals, contacts, pipeline, compliance, carina)

Route naming convention: `tenant.{module}.{action}`  
Example: `tenant.contacts.index`, `tenant.deals.show`, `tenant.pipelines.deals.store`, `tenant.api.pipeline.deals.index`

## Key Config Files

| File | Purpose |
|------|---------|
| `.env` | Environment variables (DB creds, API keys, app key) |
| `config/ai.php` | AI provider settings, Carina persona, provider priority order |
| `config/tenancy.php` | Tenant model, central domains list, bootstrappers |
| `config/database.php` | DB connections (central, tenant, pgsql defaults) |