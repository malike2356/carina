# Property asset register, maintenance and refurbishment projects

Updated: 2026-05-15

## Module overview

Post-acquisition portfolio operations for multi-property workspaces (`BillingModule::MultiProperty`). Five layers:

| Layer | Model | Purpose |
|-------|--------|---------|
| Asset register | `PropertyAsset` | Physical items (boiler, roof, HVAC) with schedules and service history |
| Maintenance requests | `PropertyMaintenanceRequest` | Fault reports (tenant or manager), optional `property_tenancy_id` |
| Works orders | `WorksOrder`, `WorksOrderQuote` | Contractor jobs, quotes, budget vs actual, expense on completion |
| Refurbishment projects | `RefurbishmentProject`, `RefurbishmentMilestone`, `RefurbishmentProjectLine` | Planned/actual spend using the same `refurb_catalogue_items` as deal refurb lines |
| Alerts | `MaintenanceAlertService` | Workspace dashboard: upcoming, overdue, open requests |

Routes: `routes/tenant-portfolio.php` (gated under `multi_property`). Nav: Portfolio group in sidebar (Maintenance dashboard, Maintenance requests, Works orders).

## Catalogue link

`RefurbCatalogueItem` feeds:

- Pre-acquisition: `deal_refurb_lines` (Deal Engine)
- Post-acquisition: `refurbishment_project_lines` (`is_estimate` true = budget, false = actual)

No separate catalogue table.

## Deal-to-portfolio carry-over

When a pipeline deal is promoted via `PortfolioPromotionService`, if the linked `DealAnalysis` has refurb lines, session flash `refurb_import_suggestion` is set. Property show offers a link to create a refurb project with `import_deal_lines=1`, calling `RefurbishmentProjectService::importFromDealLines()`.

## Accounting integration

Never post journals directly from works orders or refurb projects.

- Works order completion: `WorksOrderService::complete()` -> `ExpenseService::create()` with `works_order_id`, GL code `5000` (repairs and maintenance).
- Refurb project completion: `RefurbishmentProjectService::completeAndPostExpense()` -> expense with `refurbishment_project_id`.

## Carina

`PropertyMaintenanceCarinaContext` is merged into property conversation context in `CarinaService` (counts overdue/upcoming maintenance, open requests, active works orders, active refurb projects).

## Permissions (tenant `web` guard)

- `view-property-assets` / `manage-property-assets`
- `view-maintenance-requests` / `manage-maintenance-requests`
- `view-works-orders` / `manage-works-orders`
- `view-refurbishment-projects` / `manage-refurbishment-projects`

Tenant admins bypass checks. Migration: `2026_05_22_201000_add_portfolio_permissions.php`.

## Tests

`tests/Feature/Portfolio/PortfolioMaintenanceTest.php` - asset CRUD, schedule advance, alerts, maintenance request, works order expense, refurb line rollup, deal import, catalogue apply.
