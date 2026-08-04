# Dashboard (Command Centre)

**Last updated:** 2026-05-15

## Overview
The dashboard is the landing page after login. It provides a snapshot of the workspace portfolio health, key metrics, and quick-access cards.

**Route:** `GET /` → `Tenant\DashboardController@index`  
**Route name:** `tenant.dashboard`  
**Middleware:** web, auth, tenancy context

## Controller

`App\Http\Controllers\Tenant\DashboardController` - constructor-injected services for metrics. Returns `resources/views/tenant/dashboard/index.blade.php`.

## Key Metric Cards

- **Portfolio value** - sum of property current values
- **Monthly rent** - sum of property monthly rent
- **Active deals** - DealAnalysis count by strategy/status
- **Pipeline deals** - PipelineDeal count by stage
- **Compliance alerts** - ComplianceItems expiring within 30 days (colour-coded badge)
- **Contact/investor count**

## Quick Actions

Links to property create, deal create, contact create, pipeline board, Carina AI chat.

## Widget System

`App\Models\Tenant\DashboardWidget` - configurable widgets per workspace (shown below cards). Managed via `App\Services\Reporting\DashboardWidgetService`.

## Compliance Alerts

Expiring/expired ComplianceItems with days remaining and linked property. Rendered in a mini-list on the dashboard.

## Related

- Properties: `tenant.properties.*`
- Deals: `tenant.deals.*`
- CRM: `tenant.contacts.*`
- Compliance: `tenant.compliance.*`
- Pipeline: `tenant.pipelines.*`
- Carina: `tenant.carina.*`
