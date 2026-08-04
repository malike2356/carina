# v1.0 vs v2.0 Tech Stack Comparison

**Last updated:** 2026-05-15

## Side-by-Side Comparison

| Component | v1.0 (Legacy) | v2.0 (Current) |
|-----------|---------------|----------------|
| **Framework** | Laravel 9 | Laravel 12 |
| **PHP** | 8.1 | 8.3 |
| **Database** | MySQL 8 | PostgreSQL 16 (with pgvector) |
| **Multi-tenancy** | Single database, tenant_id column | Database-per-tenant (stancl/tenancy v3) |
| **AI** | None | Anthropic Claude (primary) + 5 fallback providers, RAG with pgvector, Tavily web search, Carina agent mode |
| **Frontend** | Blade + jQuery | Blade + Alpine.js + Tailwind CSS v4 + design tokens |
| **Build tool** | Mix (Webpack) | Vite |
| **Search** | MySQL LIKE queries | Meilisearch via Laravel Scout |
| **Queue** | Database driver | Redis + Laravel Horizon |
| **Caching** | File-based | Redis |
| **Payments** | - | Stripe (subscriptions, invoicing) |
| **Accounting** | - | Built-in double-entry GL + Xero/QuickBooks/FreeAgent/Sage/Zoho integration |
| **User roles** | Ad-hoc | Spatie RBAC (platform + tenant) |
| **Compliance** | - | Centralised tracker with expiry alerts |
| **Backup/DR** | - | Automated with console, destinations, restore |
| **Security scanning** | - | SCOUT (patch scans, SAST, key rotation) |
| **Remote access** | - | Platform-initiated GDPR-compliant sessions |
| **Booking** | - | viCal (availability, deposits, group events, API) |
| **Mentoring** | - | Mentoring OS (programmes, cohorts, invoicing, session notes) |
| **Community** | - | Posts, groups, courses, quizzes, badges |
| **Lead intake** | - | Lead Funnel (Meta/LinkedIn/TikTok + Carina scoring) |
| **Reporting** | - | Configurable reports, analytics, exports, dashboard widgets |
| **Document management** | Basic uploads | Property vault with versioning |

## Key Architectural Changes

1. **Database-per-tenant** - complete data isolation; each workspace gets its own PostgreSQL database
2. **Pgvector for AI** - vector similarity search for Carina RAG, replacing keyword-based lookups
3. **Modular subscription gating** - `BillingModule` enum drives feature visibility per plan
4. **CE/BE edition split** - `config/edition.php` controls Community vs Business feature sets
5. **Service layer architecture** - domain services replace fat controllers
6. **Automated QA** - Pest tests, model factories, CI pipeline
