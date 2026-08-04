# Module 12: Reporting and Analytics (tenant)

**Status:** Shipped (JSON API + tenant Blade hub)  
**Feature flag:** `reporting_intelligence` (platform catalogue)  
**Billing module:** `BillingModule::ReportingIntelligence` (`reporting_intelligence`) on starter, operator, mentor, and trial-expanded sets in `config/billing.php`.

## What ships

### JSON API (workspace, authenticated)

Required from `routes/tenant.php` under `api` with middleware `subscription.feature:reporting_intelligence` and `feature:reporting_intelligence`. File: `routes/tenant-reporting.php`.

- Report definitions CRUD, generate, duplicate; executions list, show, download, cancel; scheduled definitions; builder preview, columns, filters.
- Dashboard widgets CRUD, reorder, `getData`.
- Analytics: cohort, retention, funnel, metrics.
- Investor: ROI, cashflow projection, projections, portfolio summary.

Pipeline velocity, conversion, and stage duration **HTTP routes** remain on `routes/tenant/pipeline_api.php` (`App\Http\Controllers\Api\Pipeline\PipelineAnalyticsController`) to avoid duplicate paths. Reporting services (`App\Services\Reporting\PipelineAnalyticsService`, etc.) power widgets and hub data.

### Tenant web UI (Blade + Alpine + Chart.js)

Routes (web, same middleware as API module gate):

| Method | Path | Name | Purpose |
|--------|------|------|---------|
| GET | `/reporting` | `tenant.reporting.index` | Analytics hub: KPI cards, Chart.js (cohorts, funnel, stage dwell, portfolio doughnut, cashflow and value lines). |
| GET | `/reporting/reports` | `tenant.reporting.reports` | Saved definitions table, recent executions, new definition form, per-format generate buttons. |
| POST | `/reporting/definitions` | `tenant.reporting.definitions.store` | Create definition (`StoreReportDefinitionRequest`). |
| POST | `/reporting/definitions/{definition}/generate` | `tenant.reporting.definitions.generate` | Sync generate then redirect to download when ready. |
| GET | `/reporting/executions/{execution}/download` | `tenant.reporting.executions.download` | Stream export from `local` disk. |

Controller: `App\Http\Controllers\Tenant\ReportingController`.  
Hub payload: `App\Services\Reporting\ReportingHubPageService::chartPayload()` (uses `AnalyticsService`, `PipelineAnalyticsService` under `App\Services\Reporting`, `InvestorReportService`).  
Charts: `resources/js/alpine/reporting-hub.js` (Chart.js `registerables`), registered as `Alpine.data('reportingHub', ...)` in `resources/js/app.js`.

Navigation: `layouts/app.blade.php` Intelligence group adds **Analytics** when `TenantNavModuleAccess` exposes `reporting_intelligence`. `TenantNavModuleAccess::mapForTenant()` includes `BillingModule::ReportingIntelligence->value`. Dashboard calls out the hub when the module is visible (`tenant/dashboard/index.blade.php`).

## Tenant tables

Migration: `database/migrations/tenant/2026_05_03_200000_create_reporting_analytics_tables.php`  
Tables: `report_definitions`, `report_executions`, `dashboard_widgets`, `analytics_events`.

## Commands and jobs

See `app/Console/Commands/Reporting/` and `app/Jobs/Reporting/`. Schedule in `routes/console.php` where configured.

## Tests

- `tests/Feature/Reporting/ReportingModuleTest.php` (API and services lifecycle).
- `tests/Feature/Reporting/ReportingWebUiTest.php` (hub and reports pages).
- `tests/Unit/Reporting/ExportServiceTest.php`.

## Carina

Carina RAG context may reference reporting KPIs; deep-link `tenant.carina.fromReport` exists for definitions.
