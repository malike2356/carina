# Cash Accounts and Business Holdings (Asset Manager)

**Last updated:** 2026-05-20

## Overview

Cash Accounts and Business Holdings are two asset classes within the Asset Manager module. Together with the property portfolio, they power the workspace's net worth dashboard. Cash Accounts track bank and savings balances across all financial accounts. Business Holdings track equity stakes in companies, partnerships, and other business structures. Both feed into `AssetManagerService` to compute total assets, liabilities, and net worth.

## Key tables

Both tables are tenant-database tables with soft delete.

### `cash_accounts`

| Column | Type | Description |
|---|---|---|
| `id` | bigint | Primary key |
| `created_by` | FK to `users`, nullable | Who added this account |
| `name` | string | Account nickname (e.g. "Barclays Business Current") |
| `account_type` | string | `current_account`, `savings`, `deposit`, `cash`, `prepaid_card`, `other` |
| `bank_name` | string, nullable | Name of the bank |
| `account_number` | string, nullable | Account number |
| `sort_code` | string, nullable | Sort code |
| `iban` | string, nullable | IBAN for international accounts |
| `currency` | string(3), default `GBP` | ISO currency code |
| `current_balance` | decimal(14,2), default 0 | Current balance |
| `available_balance` | decimal(14,2), nullable | Available balance (may differ from current due to pending items) |
| `interest_rate` | decimal(5,2), nullable | Annual interest rate (%) |
| `opened_at` | date, nullable | Date account was opened |
| `status` | string, default `active` | `active`, `closed`, `dormant` |
| `notes` | text, nullable | Free text notes |
| `deleted_at` | timestamp | Soft delete |

### `business_holdings`

| Column | Type | Description |
|---|---|---|
| `id` | bigint | Primary key |
| `created_by` | FK to `users`, nullable | Who added this holding |
| `name` | string | Trading name |
| `legal_name` | string, nullable | Registered legal name |
| `registration_number` | string, nullable | Companies House number or equivalent |
| `jurisdiction` | string, nullable | `UK`, `US`, etc. |
| `business_type` | string | `limited_company`, `sole_trader`, `partnership`, `llp`, `trust`, `other` |
| `industry_sector` | string, nullable | e.g. `property`, `technology` |
| `ownership_percentage` | decimal(5,2), default 100 | Percentage owned |
| `valuation` | decimal(14,2), nullable | Current estimated value |
| `annual_revenue` | decimal(14,2), nullable | Annual turnover |
| `annual_profit` | decimal(14,2), nullable | Annual net profit (can be negative) |
| `cash_at_bank` | decimal(14,2), nullable | Business cash position |
| `debt` | decimal(14,2), nullable | Business liabilities/debt |
| `website` | string, nullable | Business website URL |
| `status` | string, default `active` | `active`, `dormant`, `dissolved`, `sold` |
| `acquired_at` | date, nullable | Date of acquisition or formation |
| `disposed_at` | date, nullable | Date sold or dissolved |
| `logo_url` | string, nullable | Logo image URL |
| `notes` | text, nullable | Free text notes |
| `deleted_at` | timestamp | Soft delete |

## Routes / entry points

All routes are under the Asset Manager section.

| Route | Method | Description |
|---|---|---|
| `GET /asset-manager` | GET | Net worth dashboard |
| `GET /asset-manager/cash` | GET | List all active cash accounts |
| `GET /asset-manager/cash/create` | GET | Create form |
| `POST /asset-manager/cash` | POST | Store new cash account |
| `GET /asset-manager/cash/{id}/edit` | GET | Edit form |
| `PUT /asset-manager/cash/{id}` | PUT | Update cash account |
| `DELETE /asset-manager/cash/{id}` | DELETE | Soft delete cash account |
| `GET /asset-manager/businesses` | GET | List all active business holdings |
| `GET /asset-manager/businesses/create` | GET | Create form |
| `POST /asset-manager/businesses` | POST | Store new business holding |
| `GET /asset-manager/businesses/{id}/edit` | GET | Edit form |
| `PUT /asset-manager/businesses/{id}` | PUT | Update business holding |
| `DELETE /asset-manager/businesses/{id}` | DELETE | Soft delete business holding |

Controller: `AssetManagerController`.

## How it works

### Net worth calculation

`AssetManagerService::calculateNetWorth()` aggregates across all three asset classes:

```
property_equity   = SUM(properties.current_value) - SUM(properties.mortgage_balance)
cash_total        = SUM(cash_accounts.current_balance)  [active only]
business_equity   = SUM(business_holdings.valuation) - SUM(business_holdings.debt)  [active only]

total_assets      = property_value + cash_total + business_value
total_liabilities = mortgage_debt + business_debt
net_worth         = total_assets - total_liabilities
ltv_percentage    = (mortgage_debt / property_value) * 100
```

### Dashboard data

`AssetManagerService::fullDashboard()` returns a single array with:
- `net_worth` - the full net worth breakdown
- `properties` - portfolio stats (count, total value, equity, yield, cashflow)
- `tenancies` - occupancy and rent income
- `cash` - cash position by account and by account type
- `businesses` - holdings overview with totals for valuation, revenue, profit, debt
- `recent_properties`, `recent_cash_accounts`, `recent_businesses` - latest 5 rows of each

### Active scopes

Both models have an `active()` local scope that filters by `status = active` and excludes soft-deleted rows. The `cashAccounts()` list page shows only `active` accounts.

### Cash position breakdown

`AssetManagerService::cashPosition()` groups active cash accounts by `account_type` to show totals per type (e.g. total in current accounts vs savings).

## Carina context

Users may ask:
- "What is my net worth?"
- "How much cash do I have across all accounts?"
- "What businesses do I own?"
- "What is my total property equity?"
- "What percentage of my assets are in property?"
- "Add a cash account for my HSBC savings"
- "How much debt do I have in my business holdings?"
- "What is the LTV across my portfolio?"

Carina should know:
- Net worth = property equity + cash + business equity
- Soft-deleted items are excluded from all calculations
- Business `valuation` is manually entered, not auto-calculated from market data
- `annual_profit` can be negative (loss-making businesses)
- `ownership_percentage` enables partial ownership - e.g. 50% of a joint venture
- Cash account balances are manually updated; there is no live bank feed
