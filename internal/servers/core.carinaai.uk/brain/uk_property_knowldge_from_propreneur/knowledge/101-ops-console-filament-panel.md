# Ops Console - Filament Platform Monitoring Panel

**Last updated:** 2026-05-17

## What it is

The Ops Console is the **platform operator monitoring hub** built with Filament v3. It is the
place where Verlox platform admins monitor all workspaces, AI usage, system health, and Carina
configuration from a single central vantage point.

**URL:** `http://{central-domain}/filament`
**Auth guard:** `platform` (PlatformUser model, `canAccessFilamentPanel()` method)
**Panel ID:** `admin` (defined in `AdminPanelProvider`)
**Colour:** Amber (primary)
**Config:** `app/Providers/Filament/AdminPanelProvider.php`

This panel is **separate from the main platform admin panel** at `/admin`. The `/admin` panel
handles tenant provisioning, billing, SCOUT security, backups, and operational CRUD. The Filament
Ops Console is focused on **real-time observation** - AI usage, RAG health, system status,
and cross-workspace data review.

---

## Workspace Context (Multi-tenancy in the Panel)

All tenant-scoped resources inside the panel require a workspace to be selected first.

**How it works:**
- A workspace switcher button appears in the page header on every page.
- Selecting a workspace stores its tenant ID in `session('filament.workspace_id')`.
- The `FilamentWorkspaceTenancy` middleware reads this session key and initialises tenancy context
  for every Filament request.
- Resources that scope to the selected workspace use the `InteractsWithFilamentWorkspace` trait
  (`app/Filament/Concerns/InteractsWithFilamentWorkspace.php`).
- If no workspace is selected, scoped resources show an empty state with an instruction banner.

**Constant:** `PlatformFilamentCrossLinks::WORKSPACE_FILAMENT_PANEL = 'admin'`

---

## Dashboard (Ops Console Homepage)

**Route:** `GET /filament` → `filament.admin.pages.dashboard`
**Class:** `app/Filament/Pages/Dashboard.php`

The dashboard subheading shows which workspace is currently being monitored. The page header
contains the workspace switcher action.

### Widget order on the dashboard

| # | Widget | Description |
|---|--------|-------------|
| 1 | `OpsConsoleQuickLinks` | Navigation card grid - jump to any Filament resource or page |
| 2 | `PlatformHealthWidget` | Redis, DB latency, failed jobs, queue depth - 30s polling |
| 3 | `PlatformTenantStatsWidget` | Total/active/pending onboarding/inactive workspace counts - 60s polling |
| 4 | `CarinaTotalTokens` | Platform-wide token usage, costs, cost projection - 60s polling |
| 5 | `RagDocumentStats` | RAG documents, chunks, system prompt coverage - 60s polling |
| 6 | `TokensByTenantTable` | Per-workspace token breakdown table - paginated |

---

## Quick Links Widget

`app/Filament/Widgets/OpsConsoleQuickLinks.php`

Renders a 3-column card grid in the `filament.widgets.ops-console-quick-links` blade view.
Cards link to every relevant Filament resource and page. Some are conditional on feature flags.

| Link label | Destination | Condition |
|------------|-------------|-----------|
| Platform admin | `/admin` (central dashboard) | always |
| Carina conversations | `/filament/carina-conversations` | always |
| RAG documents | `/filament/rag-documents` | always |
| Workspace people | `/filament/crm/contacts` | feature flag: `crm` |
| Carina usage | `/filament/carina-usage-dashboard` | always |
| Carina settings | `/filament/carina-settings` | always |
| System prompts | `/filament/carina-system-prompts` | always |
| Intake overview | `/filament/lead-funnel-dashboard` | feature flag: `lead_funnel` |
| Captured prospects | `/filament/lead-funnel/inbound-leads` | feature flag: `lead_funnel` |

Feature flag checks are in `PlatformFilamentCrossLinks`:
- `crmFilamentEnabled()` → `FeatureFlag::isEnabled('crm')`
- `leadFunnelFilamentEnabled()` → `FeatureFlag::isEnabled('lead_funnel')`

---

## Platform Health Widget

`app/Filament/Widgets/PlatformHealthWidget.php`
Polling: 30 seconds.

Four stats, all wrapped in try/catch so the widget never throws even if Redis is down:

| Stat | Source | Colour logic |
|------|--------|--------------|
| Redis | `Redis::ping()` | green = Online, red = Offline |
| DB latency | `DB::connection('central')->select('SELECT 1')` timed | green <20ms, warning 20-80ms, danger >80ms |
| Failed jobs | `DB::connection('central')->table('failed_jobs')->count()` | success=0, warning 1-5, danger >5 |
| Queue depth | `DB::connection('central')->table('jobs')->count()` | success <10, warning 10-50, danger >50 |

---

## Platform Tenant Stats Widget

`app/Filament/Widgets/PlatformTenantStatsWidget.php`
Polling: 60 seconds.

| Stat | Query | Colour logic |
|------|-------|--------------|
| Total workspaces | `Tenant::query()->count()` (central) | always primary |
| Active workspaces (30d) | tenancy cursor loop → `User::where('last_login_at', >=, -30d)->exists()` | always success |
| Pending onboarding | `Tenant::whereNull('workspace_onboarding_completed_at')->count()` (central) | success=0, warning 1-3, danger >3 |
| Inactive workspaces | `Tenant::where('is_active', false)->count()` (central) | success=0, warning 1-5, danger >5 |

The `workspace_onboarding_completed_at` column on the `tenants` table (added in migration
`2026_05_01_000001_add_workspace_onboarding_completed_at_to_tenants_table.php`) is null until
the workspace owner completes the setup wizard.

---

## Carina Token Stats Widget

`app/Filament/Widgets/CarinaTotalTokens.php`
Polling: 60 seconds.

Iterates all tenants via `Tenant::query()->cursor()`, initialises tenancy for each, calls
`TokenTrackingService::getTenantTokenUsage()` for monthly and daily periods.
Results are cached 5 minutes per tenant by `TokenTrackingService` (cache tags: `carina-usage`,
`tenant-{id}`).

**Stats returned:**

| Stat | Description | Colour |
|------|-------------|--------|
| Tokens this month | Cross-tenant monthly sum | none |
| Tokens today | Cross-tenant daily sum | green/amber/red vs platform daily ceiling |
| Estimated cost (month) | Based on `config('ai.pricing_usd_per_million')` | green <$20, amber <$50, red ≥$50 |
| Active conversations (24h) | `CarinaConversation::updated_at >= -24h` | none |
| Projected cost (month) | `(monthCost / dayOfMonth) * daysInMonth` | same thresholds as month cost |

**Colour threshold for "Tokens today":**
`$platformDailyLimit = tenant_daily_limit × tenantCount`
amber at ≥80%, red at ≥100%.

**TODO:** Cost alert thresholds ($20/$50) are hardcoded. They should become configurable via
`PlatformSetting` (noted as TODO comment in the widget).

---

## RAG Document Stats Widget

`app/Filament/Widgets/RagDocumentStats.php`
Polling: 60 seconds.

Iterates all tenants via cursor. Queries `RagDocument` and `RagChunk` models in each tenant DB.

| Stat | Description | Colour |
|------|-------------|--------|
| RAG documents indexed | Total across all workspaces | none |
| RAG chunks stored | Total `RagChunk` rows across all workspaces | none |
| Avg chunks / document | chunks ÷ documents | none |
| Last indexing | `RagDocument::max('indexed_at')` across all workspaces | none |
| No default system prompt | Count of workspaces with no `CarinaSystemPrompt` where `is_default = true` | success=0, warning >0 |

The system prompt coverage stat surfaces workspaces that have not configured Carina's default
behaviour. If this is > 0, Carina is running without tailored instructions for those workspaces.

---

## Tokens by Workspace Table

`app/Filament/Widgets/TokensByTenantTable.php`
Full-width table. Paginated (10/25/50).

Columns: Workspace | Tokens (month) | Conversations | Avg tokens / conversation

Uses a `tenantStats()` helper with a per-request in-memory cache (`$statsCache`) to avoid
re-initialising tenancy for each column of the same row. One tenancy init per tenant row total.

---

## Filament Pages

| Page | Route | Purpose |
|------|-------|---------|
| `Dashboard` | `/filament` | Ops Console homepage - all monitoring widgets |
| `CarinaUsageDashboard` | `/filament/carina-usage-dashboard` | Dedicated view of CarinaTotalTokens + TokensByTenantTable + RagDocumentStats |
| `CarinaSettings` | `/filament/carina-settings` | Platform-level Carina configuration |
| `LeadFunnelDashboard` | `/filament/lead-funnel-dashboard` | Lead intake metrics (feature: `lead_funnel`) |

---

## Filament Resources

All resources use the `InteractsWithFilamentWorkspace` trait. They scope to the selected
workspace session key and return an empty state if no workspace is selected.

| Resource | Route | Read-only? | Feature flag |
|----------|-------|------------|--------------|
| `CarinaConversationResource` | `/filament/carina-conversations` | yes (view only) | none |
| `CarinaSystemPromptResource` | `/filament/carina-system-prompts` | no (full CRUD + set-default action) | none |
| `RagDocumentResource` | `/filament/rag-documents` | no (can reindex) | none |
| `Crm\ContactResource` | `/filament/crm/contacts` | yes (view + view detail) | `crm` |
| `LeadFunnel\InboundLeadResource` | `/filament/lead-funnel/inbound-leads` | yes (view + view detail) | `lead_funnel` |
| `LeadFunnel\AdCampaignResource` | `/filament/lead-funnel/ad-campaigns` | yes (view only) | `lead_funnel` |

---

## Carina Settings - What Actually Persists

`app/Filament/Pages/CarinaSettings.php`

The settings form has four sections. Persistence behaviour differs per section:

### AI provider defaults
Saved to: **`platform_settings` JSON blob** AND **`ai_providers` table** (is_platform_default + default_model).

`AiRuntimeResolutionService` reads from the `ai_providers` table at runtime (queries
`AiProvider::where('is_platform_default', true)`). So changing the default provider here
**immediately affects which provider Carina uses** for new requests.

### Rate limits
Saved to: **`platform_settings` JSON blob** (key: `filament_carina_admin_settings`).

`RateLimitService` reads limits via `PlatformRateLimitConfig::limits()` at runtime, which reads
from `PlatformSetting` first and falls back to `config('carina.rate_limits')`. So saved rate
limits **take effect on the next request** after the static cache is flushed.

Service: `app/Services/Carina/PlatformRateLimitConfig.php`

### RAG pipeline settings
Saved to: **`platform_settings` JSON blob only**.

**Known gap:** `RAGService` still reads from `config('carina.rag')` directly. The chunk_size,
chunk_overlap, max_documents, and rag_file_types fields save to DB but do not yet change RAG
behaviour at runtime. A future task must update RAGService to consult PlatformSetting first.

### Incognito mode
Saved to: **`platform_settings` JSON blob only**.

Same gap as RAG - the incognito TTL and allow toggle save but are not yet consumed by the
CarinaIncognitoService at runtime.

---

## Key Support Classes

| Class | Location | Purpose |
|-------|----------|---------|
| `PlatformFilamentCrossLinks` | `app/Support/Navigation/PlatformFilamentCrossLinks.php` | URL helpers + feature flag checks for the panel |
| `InteractsWithFilamentWorkspace` | `app/Filament/Concerns/InteractsWithFilamentWorkspace.php` | Workspace switcher action + scope helpers for all pages/resources |
| `FilamentWorkspaceTenancy` | `app/Http/Middleware/FilamentWorkspaceTenancy.php` | Middleware that reads `session('filament.workspace_id')` and initialises tenancy |
| `TokenTrackingService` | `app/Services/Carina/TokenTrackingService.php` | Token aggregation with 5-min per-tenant cache |
| `PlatformRateLimitConfig` | `app/Services/Carina/PlatformRateLimitConfig.php` | Runtime rate limit resolver - DB first, config fallback |

---

## Tests

`tests/Feature/Filament/CarinaFilamentPagesTest.php` - covers:
- Guest redirect from `/filament/carina-settings`
- Platform admin can view Carina settings, Ops Console dashboard, Carina usage dashboard
- Intake overview, captured prospects, people directory, ad campaigns all load without redirect
- CarinaTotalTokens renders "Projected cost" stat (Livewire component test)

`tests/Feature/Filament/PlatformHealthWidgetTest.php` - widget renders without throwing even
when Redis/DB is degraded (all calls wrapped in try/catch).

`tests/Feature/Filament/PlatformTenantStatsWidgetTest.php` - widget renders without throwing
with zero tenants.
