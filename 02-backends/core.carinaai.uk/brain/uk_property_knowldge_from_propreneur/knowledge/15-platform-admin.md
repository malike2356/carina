# Platform Admin Panel

**Last updated:** 2026-06-15

## Overview

Central admin panel for platform operators. All routes under `/admin/*` on the central domain. Built with Laravel Blade and Filament v3 (selected resources).

## Admin Routes

| Area | Prefix | Purpose |
|------|--------|---------|
| Dashboard | `/admin` | Admin home |
| AI Providers | `/admin/ai/providers` | Manage provider keys, set defaults, test |
| AI Usage | `/admin/ai/usage` | Cross-tenant usage dashboard, CSV export |
| Carina | `/admin/carina` | Conversations, agent tools, knowledge training (upload/OCR/ZIP/RAG queue), speech transcribe |
| Users | `/admin/saas-tenancy` | Tenant CRUD, provision databases |
| Accounts | `/admin/accounts` | Workspace lifecycle, health, follow-ups, ops digest (alias `/admin/tenant-crm`; see `190-platform-tenant-crm-accounts.md`) |
| Central Users | `/admin/*` (various) | Platform user manager, impersonation |
| Roles | `/admin/roles` | Platform role CRUD (Spatie) |
| Feature Flags | `/admin/feature-flags` | Toggle flags, per-tenant overrides, sync catalogue |
| Settings | `/admin/settings` | Typed settings (key-value), setting definitions |
| Subscription Plans | `/admin/subscription-plans` | Plan catalogue CRUD |
| Backups | `/admin/backups` | Job list, destinations, schedules, restore, download |
| SCOUT | `/admin/security/scout` | Security findings, key rotation, SAST/patch scans, Carina chat |
| Remote Access | `/admin/remote-access` | Initiate, manage, terminate sessions, GDPR compliance, logs export |
| Audit Logs | `/admin/audit-logs` | View/export CSV/JSON |
| Theme Presets | `/admin/theme/presets` | Create, duplicate, set default theme presets |
| Job Schedules | `/admin/job-schedules` | CRUD scheduled tasks from PlatformScheduleCatalog |
| Migration | `/admin/migration` | v1→v2 data migration status, export, import, progress |
| Analytics | `/admin/analytics/cross-tenant-benchmark` | Cross-tenant usage comparisons |
| Search | `/admin/search` | Command palette search |

## Filament Ops Console (separate panel at /filament)

The Filament panel at `/filament` is the **platform operator monitoring hub** - distinct from the
main `/admin` panel. It is auth-gated by the `platform` guard and shows real-time stats across
all workspaces.

**Full documentation:** `brain/knowledge/101-ops-console-filament-panel.md`

Quick summary of what lives at `/filament`:
- Platform health (Redis, DB latency, failed jobs, queue depth)
- Workspace stats (total, active 30d, pending onboarding, inactive)
- Carina token usage + cost + projection (all workspaces aggregated)
- RAG document health + system prompt coverage warning
- Per-workspace token breakdown table
- Quick-links to: Carina conversations, RAG docs, system prompts, workspace contacts (CRM flag),
  Carina settings, intake overview + prospects (lead_funnel flag)

## Filament Resources (all at /filament)

| Resource | Route | Purpose |
|----------|-------|---------|
| `RagDocumentResource` | `/filament/rag-documents` | RAG document management (upload, reindex) |
| `CarinaConversationResource` | `/filament/carina-conversations` | Cross-workspace conversation viewer |
| `CarinaSystemPromptResource` | `/filament/carina-system-prompts` | System prompt CRUD + set-default |
| `Crm\ContactResource` | `/filament/crm/contacts` | Read-only tenant contact viewer (feature: `crm`) |
| `LeadFunnel\InboundLeadResource` | `/filament/lead-funnel/inbound-leads` | Cross-tenant lead viewer (feature: `lead_funnel`) |
| `LeadFunnel\AdCampaignResource` | `/filament/lead-funnel/ad-campaigns` | Campaign viewer (feature: `lead_funnel`) |
| `LeadFunnelDashboard` | `/filament/lead-funnel-dashboard` | Lead funnel analytics page |

## Search

`AdminSearchController` at `/admin/search` provides command-palette search across tenants, users, settings, and recent activity. Feature flag: `platform_admin_search`.

## UI Features

- **Sidebar:** grouped navigation (SaaS, Security, Infrastructure, Settings, Carina)
- **Impersonation:** platform admins can log in as any tenant user
- **Two-factor auth:** per-platform-user TOTP (enforce/disable/verify)
- **Theme:** admin uses the same design token system as tenant UI

## Feature flags

**Source of truth:** `App\Support\PlatformFeatureCatalogue::definitions()` (synced to `feature_flags` via **Sync catalogue** on `/admin/feature-flags`, `FeatureFlag::syncFromCatalogue()`, or `php artisan db:seed --class=Database\\Seeders\\Central\\FeatureFlagSeeder`).

Sync **adds or updates labels and descriptions**; it does **not** reset `enabled` on existing rows.

| Key | Typical use |
|-----|-------------|
| `accounting` | GL, expenses, bank reconciliation, **invoices and receipts** (`feature:accounting` + `subscription.feature:accounting`) |
| `hr_payroll` | `/staff` directory, leave, payroll runs, payslips |
| `payroll_ledger_integration` | When off, payroll finalise/mark-paid skip journal posting (status still updates) |
| `deal_engine`, `pipeline`, `crm`, `compliance`, `booking_calendar` | Core workspace modules |
| `carina_ai`, `carina_agent`, `carina_knowledge_mining` | Carina chat, agent mode, insight mining |
| `platform_*` | Central admin surfaces (SCOUT, backups, revenue, search, etc.) |

Tenant overrides: per-flag `tenant_overrides` JSON on the central row (managed from the feature-flags admin UI).
