# Deal Engine (Deal Analysis)

**Updated:** 2026-05-02 (pointer to **`29-deals-module-strategy.md`**)

## Overview
The Deal Engine module handles property deal analysis: users model a strategy against an optional property, store financial inputs in `metrics` JSONB, and can run server-side calculators (BTL first in the UI) before saving. Carina can generate a narrative from the same record.

**Routes:** `tenant.deals.*`  
**Controllers:** `App\Http\Controllers\Tenant\DealController`, `App\Http\Controllers\Tenant\DealCalculatorController`, `App\Http\Controllers\Tenant\DealCalculatorsController`  
**Model:** `App\Models\Tenant\DealAnalysis`  
**Calculator log:** `App\Models\Tenant\DealCalculatorLog` (optional row per API run when authenticated)

**Strategy and external listings context:** **`brain/knowledge/29-deals-module-strategy.md`**.  
**v1 parity, refurb schedule, and phased build plan:** **`brain/knowledge/39-deal-calculator-v1-v2-parity-and-refurb-plan.md`**.  
**Workspace hub and sourcing criteria (v1 Deals menu parity):** **`brain/knowledge/41-deal-workspace-v1-parity-journey.md`**.

## Routes

| Method | URI | Name | Action |
|--------|-----|------|--------|
| GET | `/deals/workspace` | `tenant.deals.workspace` | Hub: counts + shortcuts (pipeline, CRM, reporting, …) |
| GET/POST | `/deals/sourcing/criteria` | `tenant.deals.sourcing.criteria.*` | CRUD sourcing criteria (owner-scoped) |
| GET | `/deals/sourcing/inbox` | `tenant.deals.sourcing.inbox` | Sourcing matcher hits (`deal_alerts`); Open as deal links to create with `property_id` |
| GET/POST | `/deals/sourcing/shortlists` | `tenant.deals.sourcing.shortlists.*` | Deal shortlists (saved `deal_analyses` sets, owner-scoped) |
| GET/POST | `/deals/sourcing/profiles` | `tenant.deals.sourcing.profiles.*` | Area profiles (named bundles of sourcing criteria + optional map coordinates) |
| POST | `/deals/{deal}/shortlists` | `tenant.deals.shortlists.attach` | Add current deal analysis to an owned shortlist (`deal_shortlist_id`) |
| GET | `/deals` | `tenant.deals.index` | List deals |
| GET | `/deals/calculators` | `tenant.deals.calculators.index` | Workbench: left rail lists all models; right iframe loads embed route; optional `?model={slug}` |
| GET | `/deals/calculators/{calculator}/embed` | `tenant.deals.calculators.embed` | Minimal layout + single calculator pane (iframe `src`; `{calculator}` is a registry slug such as `btl`) |
| GET | `/deals/calculators/{calculator}` | `tenant.deals.calculators.show` | **Redirect** to hub with `?model={calculator}` (deep links / bookmarks) |
| GET | `/deals/create` | `tenant.deals.create` | Create form |
| POST | `/deals` | `tenant.deals.store` | Store deal |
| POST | `/deals/calculate/{strategy}` | `tenant.deals.calculate` | JSON: run calculator (see calculator keys below) |
| POST | `/deals/calculate/sensitivity/btl` | `tenant.deals.calculate.sensitivity.btl` | JSON: BTL rent/mortgage scenario grid (alias) |
| GET | `/deals/calculator-playground` | `tenant.deals.calculator-playground` | **Redirects** to `/deals/calculators` (legacy URL and bookmarks) |
| POST | `/deals/calculate/sensitivity/{strategy}` | `tenant.deals.calculate.sensitivity` | JSON: scenario grid for the seven deal strategies only; returns **422** for underwriting-only calculators |
| GET | `/deals/{deal}` | `tenant.deals.show` | View deal |
| GET | `/deals/{deal}/edit` | `tenant.deals.edit` | Edit form |
| PUT | `/deals/{deal}` | `tenant.deals.update` | Update deal |
| DELETE | `/deals/{deal}` | `tenant.deals.destroy` | Delete deal |
| POST | `/deals/{deal}/carina-narrative` | `tenant.deals.carina` | JSON: generate AI narrative |

Carina workspace routes live under `/carina` (same `carina_ai` gates); see **Carina chat scoped to a deal** below for `tenant.carina.fromDeal`.

**Calculator keys** (`DealCalculatorRegistry::STRATEGIES`, **16** total). Labels for UI and Carina: `DealCalculatorRegistry::labels()`; playground order: `DealCalculatorRegistry::playgroundNav()`.

**Deal strategies (seven)** - use `POST /deals/calculate/{slug}` with inputs below; sensitivity grid available for all seven.

1. `btl` - Buy-to-Let: `purchase_price`, `monthly_rent`, optional `monthly_mortgage`, optional `monthly_council_tax`, `monthly_utilities`, optional stress factors `stress_rent_factor`, `stress_mortgage_factor` (defaults 0.75 and 1.25). Workspace defaults merge from `TenantSetting` key `deals.calculator_defaults` when keys are omitted. Outputs include gross yield, ROI-style metrics, monthly cashflow, SDLT assumptions via `PropertyFinancialService`.
2. `brr` - Buy-refurb-refinance: `purchase_price`, `refurb_cost`, `post_refurb_value`. Refinance LTV, cash left in deal, total capital in.
3. `hmo` - HMO: `purchase_price`, `rooms`, `rent_per_room_monthly`, optional void assumptions. Room-scale rent roll vs value.
4. `r2r` - Rent-to-rent: `rent_from_subtenants_monthly`, `rent_to_landlord_monthly`. Margin and annual profit.
5. `sa` - Serviced accommodation: `nightly_rate`, `occupancy_pct`. Revenue run-rate and cost assumptions.
6. `flip` - Flip: `purchase_price`, `refurb_cost`, `selling_price` (or ARV from form mapping). Profit after sale costs.
7. `commercial` - Commercial / mixed use (same shape as BTL for API): `purchase_price`, `monthly_rent`, optional `monthly_mortgage`.

**Underwriting and UK tools (nine)** - same `POST /deals/calculate/{slug}` path; **no** sensitivity grid (API returns **422** if you call `/deals/calculate/sensitivity/{slug}`).

8. `npv_irr` - `cash_flows` (JSON array, period 0 = initial outlay negative), `discount_rate_annual` (decimal, e.g. 0.08).
9. `dscr` - `annual_noi`, `annual_debt_service` (> 0). Output `dscr`, `passes_1_25x`.
10. `income_multiples` - `purchase_price`, `monthly_rent` or annual gross rent, optional `annual_operating_expenses`. NOI, cap rate %, GRM, gross yield.
11. `coc_roe` - `annual_pre_tax_cash_flow`, `total_cash_invested`; optional `current_equity`, `annual_net_income_equity` for ROE.
12. `ltv` - `loan_amount` (>= 0), `property_value` (> 0). Output `ltv_pct`, `equity_amount`.
13. `breakeven_occupancy` - `annual_operating_expenses` (>= 0), `annual_debt_service` (>= 0), `annual_gross_potential_income` (> 0). Output `breakeven_occupancy_pct` = (opex + debt service) / GPI x 100, plus `headroom_vs_full_occupancy_pct`.
14. `sdlt` - `purchase_price`, optional `profile` (`standard` | `additional_property` | `first_time_buyer`; default additional property via workspace defaults). Output `sdlt_total`, `effective_rate_pct`, `rules_version`. Bands in `PropertyFinancialService` (`SDLT_RULES_VERSION` constant).
15. `bridging` - `loan_amount`, `annual_interest_rate` (decimal), `term_months`; optional `arrangement_fee_pct`, `arrangement_fee_flat`, `exit_fee_flat`, `broker_fee_flat`. Output interest and fee rollups.
16. `mortgage` - `loan_amount`, `annual_interest_rate`, `term_years`, optional `interest_only`. Output `monthly_payment`, `total_interest_paid`, etc.

Deal record **`strategy`** is only the **seven** deal slugs above (`deal_analyses.strategy`). Keys 8-16 exist for the calculator API and `deal_calculator_logs.strategy`, not for stored deal strategy.

**Refurb schedule (tenant JSON API):** `GET /api/deal-analyses/refurb-catalogue` lists active `refurb_catalogue_items` (seeded on workspace bootstrap). `GET /api/deal-analyses/{deal}/refurb-lines` returns lines plus `rollup_total` and `category_subtotals`. `POST` same path creates a line; `PATCH` / `DELETE` with `{line}` id mutate rows. `POST /api/deal-analyses/{deal}/refurb-lines/apply-catalogue` with `item_ids` appends catalogue rows. Mutations sync `metrics.renovation_cost` via `DealRefurbRollupService`. Only the deal owner (`created_by`) may call deal-scoped endpoints.

**Navigation:** Sidebar **Calculators** opens the **workbench** (`/deals/calculators`). The left column lists every model (accent stripe per row); the right column is an **iframe** whose `src` is `/deals/calculators/{slug}/embed`, swapped in place when another row is clicked (same window, no new tab). `/deals/calculator-playground` redirects to the hub. `/deals/calculators/{slug}` redirects to `?model={slug}`. On **Analyse deal** / **Edit deal**, the form only previews the selected **deal strategy**; underwriting tools link to the hub with `?model=` for each tool (same window).

**Middleware:** Deal routes use `subscription.feature:deal_engine` and `feature:deal_engine`. Carina narrative also requires `subscription.feature:carina_ai` and `feature:carina_ai`. See `brain/knowledge/22-tenant-route-map.md`.

**Tenant subdomain:** Controllers on `{tenant_subdomain}.{TENANT_BASE_DOMAIN}` must read route parameters via `$request->route('...')` when mixing domain parameters with path parameters (see `DealCalculatorController::calculate`).

## Model: `DealAnalysis`

**Table:** `deal_analyses`

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint | Primary key |
| `property_id` | bigint nullable, FK | Linked property |
| `created_by` | bigint, FK users | Owner |
| `strategy` | string | `btl`, `hmo`, `brr`, `r2r`, `sa`, `flip`, `commercial` |
| `title` | string | Deal label |
| `metrics` | JSONB | Financial inputs, user-entered yields, optional `calculator_last` snapshot |
| `carina_narrative` | text nullable | AI narrative |
| `is_favourite` | bool | |
| `status` | string | `draft`, `shared`, `archived` |

**Relationships:** `property`, `creator`, `alerts`, `calculatorLogs`.

**Notes:** User notes live inside `metrics.notes` (form field `notes` is merged on save).

## Calculators

**Registry:** `App\Services\Deals\Calculators\DealCalculatorRegistry`  
**Run + log:** `App\Services\Deals\DealCalculatorRunService` (validates inputs, runs strategy, writes `deal_calculator_logs` when called from HTTP)  
**BTL sensitivity:** `App\Services\Deals\SensitivityAnalysisService::btlRentAndMortgageGrid`

**Table:** `deal_calculator_logs` (tenant) - `deal_analysis_id` nullable, `strategy`, `inputs`, `outputs`, `duration_ms`, `created_by`, `ip_address`.

**Create/edit UI:** Alpine `dealCalculatorForm` in `resources/js/alpine/deal-calculator-form.js` (registered in `resources/js/app.js`). `DealController` passes `dealCalculatorRoutes` (per-slug URLs for calculate and sensitivity). The Blade partial `tenant/deals/partials/calculator-panel` lets users run **match deal strategy** (all seven strategies with mapped form fields plus preview inputs where needed) or **NPV/IRR, DSCR, income multiples, CoC/ROE, LTV, breakeven occupancy**; **Sensitivity grid** calls the sensitivity route for the seven deal strategies only. Outputs update ROI/gross yield when the API returns those keys; hidden `calculator_snapshot` stores the last run. `StoreDealAnalysisRequest` merges valid JSON into `metrics.calculator_last`. Edit passes `deal_analysis_id` for calculator logs.

**Carina:** When explaining calculators, use the numbered list above. Prefer `metrics.calculator_last.strategy` and `outputs` on the deal record over guessed numbers. The playground is read-only; saved snapshots come from create/edit **Run calculator** then **Save**.

## Service: `DealAnalysisService`

Creates and updates analyses from validated arrays. `refreshCarinaNarrative` delegates to `CarinaService::generateDealNarrative`.

## Store / update validation

**`StoreDealAnalysisRequest`** / **`UpdateDealAnalysisRequest`** (extends store):

- `property_id` optional, exists on `properties`
- `strategy` required; `buy_to_let` is normalised to `btl` in `prepareForValidation`
- `title` required
- `metrics` required (array); built from flat financial fields, `notes`, and optional `calculator_snapshot` into `metrics.calculator_last`

## Carina narrative (`tenant.deals.carina`)

- **HTTP:** `POST` `/deals/{deal}/carina-narrative` returns JSON `{ "narrative": "..." }`.
- **Service:** `App\Services\Carina\CarinaService::generateDealNarrative` (UK-focused prompt, optional Tavily - see `brain/knowledge/18-carina-tavily-web-search.md`).

## Carina chat scoped to a deal (calculators and metrics)

Use this when the user wants a **threaded conversation** tied to the same `DealAnalysis` row (not only the one-shot narrative endpoint above).

- **Open from deal (GET):** `GET /carina/open-deal/{dealId}` - route name `tenant.carina.fromDeal`. `App\Http\Controllers\Tenant\CarinaController::startFromDeal` checks `created_by`, creates `CarinaConversation` with `context_type=deal` and `context_id`, seeds default chat options (investor brain when the access gate allows), then redirects to `tenant.carina.show`.
- **Start via form (POST):** `POST /carina/conversations` with `context_type=deal` and `context_id` - same ownership check on `created_by`.
- **RAG and system prompt:** For `context_type=deal`, `CarinaService` nudges retrieval toward UK deal and underwriting language. When `metrics.calculator_last` is present, the system prompt tells the model to **prefer that structured calculator snapshot** if other numbers disagree.
- **UI:** `resources/views/components/tenant/deal-carina-launch.blade.php` on deal screens when Carina is module-enabled (`carinaAiEnabled` from `DealController`); calculator Alpine (`deal-calculator-form.js`) uses `carinaAiEnabled` (legacy `carinaDealEnabled` still accepted) and shows a post-run CTA when `carinaFromDealUrl` is set on edit.

## Carina chat scoped to a standalone calculator (hub pages)

When the workspace has Carina enabled, the embedded pane (`/deals/calculators/{slug}/embed`) shows a **Carina** panel on the run block (links use `target="_parent"` so Carina opens in the full app frame):

- **GET** `/carina/open-deal-calculator/{calculatorSlug}` - route `tenant.carina.fromDealCalculator`. Creates `CarinaConversation` with `context_type=deal_calculator`, `context_id=null`, and `metadata` keys `deal_calculator_slug`, `deal_calculator_kind` (`strategy` vs `tool`). Seeds investor brain when allowed, then redirects to `tenant.carina.show`.
- **POST** `/carina/open-deal-calculator` - route `tenant.carina.fromDealCalculator.post`. Body: `strategy` (slug in `DealCalculatorRegistry::STRATEGIES`), optional `calculator_last` (JSON string from the same shape as the deal form snapshot). Valid JSON is stored as `metadata.playground_last_run` so the system prompt can quote the latest **Run calculator** output. With `Accept: application/json`, response is `{ "redirect": "..." }` for the SPA-style handoff from Alpine (`openCarinaWithLastRun` in `deal-calculator-form.js`).
- **RAG and system prompt:** `CarinaService` appends a UK underwriting retrieval hint for `deal_calculator` and injects label, description, API paths (`POST /deals/calculate/{slug}`, sensitivity note for strategies), plus truncated `playground_last_run` when present.

**Tests:**

- [`tests/Feature/Deals/DealCarinaIntegrationTest.php`](../../tests/Feature/Deals/DealCarinaIntegrationTest.php) - one sequential `it()` covers `POST /carina/conversations` with `context_type=deal` (redirect, conversation row, investor brain) and cross-user denial (404). A second `it()` for `GET /carina/open-deal/{id}` is present but **skipped** until `carina_ai` + tenancy + CI DB are consistently green; unskip locally to exercise `CarinaController::startFromDeal`. Use `call('GET', ...)` with `HTTP_HOST` / `SERVER_NAME` set to `{slug}.{TENANT_BASE_DOMAIN}` so subdomain tenancy matches.
- [`tests/Feature/Deals/DealCalculatorCarinaIntegrationTest.php`](../../tests/Feature/Deals/DealCalculatorCarinaIntegrationTest.php) - GET open-deal-calculator, POST with snapshot JSON, invalid slug 404 (requires migrated `propreneur_testing` central + tenant DB).
- [`tests/Unit/Carina/CarinaModuleRoutesTest.php`](../../tests/Unit/Carina/CarinaModuleRoutesTest.php) - asserts tenant Carina and RAG route names (including `tenant.carina.fromDeal`, `tenant.carina.fromDealCalculator`, `tenant.carina.fromDealCalculator.post`) are registered.

In the browser, open-deal uses `http://{domain}.{TENANT_BASE_DOMAIN}/carina/open-deal/{id}` (Blade: `route('tenant.carina.fromDeal', ['dealId' => ...])` when the request is already on the tenant host).

## Metrics JSON (example)

Stored keys include flat financials and optional calculator snapshot:

```json
{
    "purchase_price": 250000,
    "monthly_rent": 1500,
    "roi": 8.2,
    "gross_yield": 7.2,
    "notes": "Vendor motivated.",
    "calculator_last": {
        "strategy": "btl",
        "outputs": {
            "gross_yield_pct": 7.2,
            "net_yield_pct": 5.1,
            "monthly_cashflow": 120.5,
            "roi_pct": 8.2
        },
        "assumptions": [],
        "duration_ms": 3,
        "applied_at": "2026-05-02T12:00:00.000Z"
    }
}
```

## Views

- `resources/views/tenant/deals/index.blade.php`
- `resources/views/tenant/deals/create.blade.php` - includes BTL calculator preview (Alpine)
- `resources/views/tenant/deals/edit.blade.php` - same
- `resources/views/tenant/deals/show.blade.php` - shows `metrics.calculator_last` when present

## UK-specific calculations

Implemented in `App\Services\Property\PropertyFinancialService` and strategy calculators under `App\Services\Deals\Calculators\` (SDLT additional property, yields, ROI, BTL cashflow assumptions). See calculator `assumptions` arrays in API responses for exact definitions.

## Related

- Properties: `tenant.properties.*`
- Pipeline: `tenant.pipelines.*`
- Carina: `brain/knowledge/08-carina.md`
- Tenant route map: `brain/knowledge/22-tenant-route-map.md`
