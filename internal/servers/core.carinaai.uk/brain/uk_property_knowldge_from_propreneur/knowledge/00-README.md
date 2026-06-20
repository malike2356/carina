# Propreneur v2.0 Knowledge Base

**Purpose:** Carina AI training corpus, help documentation, and system reference for the Propreneur property investment management platform.

**Last updated:** 2026-05-20 (added `152-promo-codes-vs-referral-codes.md` for Carina billing/referral guidance)

## Directory Structure

| File | Topic |
|------|-------|
| `01-architecture.md` | Application architecture, stack, tenancy model |
| `02-dashboard.md` | Command centre / dashboard module |
| `03-properties.md` | Property portfolio management (hub) |
| `04-deals.md` | Deal engine / deal analysis module |
| `05-crm.md` | Contact management (CRM) |
| `06-pipeline.md` | Deal pipeline / kanban board |
| `07-compliance.md` | Compliance (certificates, AML, complaints, requirements, regulatory profile, PDF export) |
| `08-carina.md` | Carina AI assistant - architecture, providers, RAG, platform agentic + security (53-55), conversation insight extraction (56) |
| `09-auth.md` | Tenant authentication, password reset, security |
| `10-tenancy.md` | Multi-tenancy system (stancl/tenancy v3.10) |
| `11-database.md` | Database schema, migrations, seeders |
| `12-ui-components.md` | UI patterns, Tailwind classes, layout system |
| `13-routes.md` | Route structure, naming conventions, middleware |
| `14-fixes.md` | Bug fixes applied during build (reference log) |
| `15-platform-admin.md` | Platform Admin Panel - User Manager, Settings, Feature Flags |
| `71-workspace-audit-logging.md` | Tenant workspace audit trail (immutable log, hash chain, admin UI, retention commands) |
| `72-gdpr-data-subject-rights.md` | Tenant GDPR: export, deletion, consents, policies, retention, breach logging, commands, routes |
| `73-workspace-localization-and-staff.md` | Localization settings UI, waitlist HTML, staff/HR module, investor portal web |
| `74-staff-payroll.md` | Payroll phase 1 (pay cycle, payslips, ledger); phase 2 HMRC backlog pointer |
| `77-property-asset-maintenance-and-refurb-projects.md` | Property maintenance, refurb project management |
| `81-tenant-invoicing-and-receipts.md` | Tenant invoicing, receipts, payment tracking |
| `82-stripe-billing-staging-sign-off.md` | Xelox staging Stripe sign-off checklist |
| `125-subscriptions-billing.md` | Stripe billing, trials, promo codes, referral programme schedulers |
| `128-referrals-waitlist.md` | Workspace referral programme and pre-launch waitlist |
| `152-promo-codes-vs-referral-codes.md` | **When to use promo vs referral vs Stripe coupons** (Carina + support) |
| `103-workspace-api-access-policy.md` | API access: Operator+ only; Investor excluded; config `api_access` |
| `83-service-accommodation-strategy.md` | SA strategy, Airbnb flywheel, market stats, operational tactics |
| `84-commercial-property-investment.md` | Commercial investment, leases, value-add, motivated seller identification |
| `85-property-investor-strategy-insights.md` | Deal sourcing tactics, investor mindset, SA/commercial tactical additions |
| `86-wealth-creation-principles.md` | Three-step wealth framework, passive income, three asset classes, generational wealth |
| `87-property-business-structures-development.md` | Business structures, tax, FICs, property development, PDR, case studies |
| `99-tech-stack-comparison.md` | v1 vs v2 stack comparison |
| `99-template-knowledge-entry.md` | Template for new knowledge entries |

## How Carina uses this

When a user asks a question, Carina searches these documents and includes the most relevant context in the system prompt.

**Ingestion:** run `php artisan rag:ingest-brain-knowledge --sync` after changing any file here.
