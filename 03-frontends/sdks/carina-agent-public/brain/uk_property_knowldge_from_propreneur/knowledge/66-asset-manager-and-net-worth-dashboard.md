# Asset Manager and Net Worth Dashboard

## Purpose

The Asset Manager module (`asset_manager`) gives UK property entrepreneurs a single portfolio view: net worth, allocation, liabilities, income streams, maintenance, documents, and compliance per asset. It complements the Properties module; property financials always read from `properties`, while cash, investments, business interests, land, vehicles, and other holdings are stored in `assets`.

## What it does not do (post-demo backlog)

- Open Banking / bank feeds (TrueLayer)
- Automated valuations (Zoopla / Land Registry APIs)
- Multi-currency
- Joint ownership splits
- Spreadsheet or PDF export

## Asset categories

| Category | Use when |
|----------|----------|
| `property_ref` | Link an existing property record; value syncs from `properties.current_value` |
| `cash_account` | Bank accounts, savings, cash ISA |
| `investment` | Stocks, S&S ISA, pension, bonds |
| `business` | Ltd shares, business interests |
| `land` | Land not in the property register |
| `vehicle` | Cars, vans, plant |
| `other` | Catch-all |

## Net worth calculation

All figures flow through `App\Services\Assets\NetWorthService` (never computed in controllers or views).

- **Property side:** `SUM(properties.current_value)`, `SUM(properties.mortgage_balance)`, `SUM(properties.monthly_cashflow)`
- **Non-property side:** active `assets` rows plus active `asset_liabilities` and `asset_incomes`
- **Net worth:** total assets minus total liabilities (property mortgage + asset liabilities)

History chart uses latest `asset_valuations` per asset per month-end plus current property values (static until property valuation history ships).

## Routes and billing

- Web: `/assets` (gated by `subscription.feature:asset_manager` and `feature:asset_manager`)
- JSON charts: `/api/assets/net-worth`, `allocation`, `history`, `maintenance`, `equity-by-category`, `income-by-category`
- Mobile: `/api/v1/mobile/assets/*` (Sanctum)
- Plans: included in `investor`, `operator`, `mentor`, and `trial_expanded` module sets in `config/billing.php`

## Carina tools

| Tool | Answers |
|------|---------|
| `asset_net_worth` | Current snapshot: net worth, assets, liabilities, monthly income |
| `asset_allocation` | Category breakdown with values and percentages |

Baseline context in `CarinaBaselineContextService` appends a portfolio summary when the module is enabled and total assets > 0.

## Integrations

- **Properties:** portfolio table lists properties; `property_ref` assets link back
- **Document vault:** `documents.asset_id` on asset show
- **Compliance:** `compliance_items.asset_id` on asset show
- **Dashboard:** net worth KPI card when module active
- **Accounting:** complementary view; rent income may also exist in GL (no auto-post yet)

## Maintenance

`asset_maintenance` tracks scheduled work per asset (priority, due date, costs). Open items surface on the portfolio dashboard and via `/api/assets/maintenance`.
