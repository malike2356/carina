# Deal Engine (Deal Analysis)

**Last updated:** 2026-05-25 (property-first index + slide-over)

## Navigation

After prompt 226 the Deals nav group is **property-first** - just two items:

| Nav label | Route | Page purpose |
|-----------|-------|--------------|
| **Deals** | `tenant.deals.index` (`/deals`) | Property-first card grid with right-side slide-over preview |
| **Calculators** | `tenant.deals.calculators.index` (`/deals/calculators`) | Calculator hub (unchanged) |

The "Deals" nav match rule covers `tenant.deals.*` minus the `tenant.deals.calculators.*` subgroup (so the Calculators item highlights independently). All other Deal Engine pages - board, workspace, sourcing config, manual-search, create, show, edit - remain at their existing routes and are reached via the index page header buttons, the URL paste hero on the index, or the slide-over's "Open full page" link.

The earlier 3-item structure (Active Deals / New Deal / Calculators, prompt 225) is collapsed into this single Deals entry. The Kanban board still exists at `tenant.deals.board` for bookmarks but is no longer in the nav.

## Property-first Deals index

`DealController@index` eager-loads `property:id,address_line1,city,primary_image_url`, orders by `updated_at DESC`, and paginates **12 per page**. URL filters (`?strategy=`, `?status=`, `?search=`, `?source_channel=`, `?seller_motivation_category=`) are still honoured for deep-linked sharing but there is no on-page filter UI.

`resources/views/tenant/deals/index.blade.php` is split into three sections:

1. **URL paste hero** - full-width banner with a single `portal_url` input that submits as a GET to `tenant.deals.create` with `source_type=url`, mirroring the manual-search hero so users have a consistent entry point from either side of the app.
2. **Card grid** - responsive 1 → 2 → 3 columns (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-3`). Each card shows the property image (`primary_image_url` or `metrics.listing_image_urls[0]`), title, strategy tag, address line, status, and "updated X ago". Clicking the card opens the slide-over rather than navigating away.
3. **Empty state** - shown when the paginator is empty; links to manual-search for a softer second-step.

## Slide-over panel

A right-side `<aside>` driven by the `dealSlideOver()` Alpine component lives at the bottom of the index view. State:

- `isOpen`, `dealId`, `loading`, `panelTitle`, `panelSubtitle`, `panelContent`, `dealUrl`
- `activeTab` - one of `numbers`, `dd`, `documents`, `notes`
- `tabs` - static array of `{key,label}` rows for the tab bar
- `open(id)` / `close()` / `load()` - `Escape` closes; `body` overflow is locked while open

Loading uses `fetch(${baseUrl}/${id}/slide-over?tab=${activeTab})` with `X-Requested-With: XMLHttpRequest`. The route is `tenant.deals.slide-over` (`GET /deals/{deal}/slide-over`, throttled `60,1`). The controller method `DealController@slideOver(Request, string $tenantSubdomain, DealAnalysis $deal)` validates the tab name (defaulting to `numbers`), renders the matching partial, and returns JSON:

```json
{
    "title":    "…deal title…",
    "subtitle": "…property address line 1, falling back to metrics.address_line1…",
    "deal_url": "…tenant.deals.show route…",
    "tab":      "numbers",
    "html":     "…partial markup…"
}
```

### Slide-over partials

All four live under `resources/views/tenant/deals/partials/`:

| Partial | Data source | Empty-state CTA |
|---------|-------------|-----------------|
| `slide-over-numbers.blade.php` | `metrics.calculator_last` (preferred) / `metrics.calculator_snapshot` / top-level `metrics` keys - renders any numeric key from the headline allow-list (`asking_price`, `purchase_price`, `monthly_rent`, `monthly_cash_flow`, `gross_yield`, `net_yield`, `roi`, `cash_required`). `%` formatting for yield / roi / pct keys. | "Run the calculator" link → `tenant.deals.edit` |
| `slide-over-dd.blade.php` | `sourcing_diligence.quick_dd` (vendor / legal checks) and `sourcing_diligence.risk_flags`. Quick-DD items render with a green tick; risk flags render with an amber warning. | "Open the full page to add them" |
| `slide-over-documents.blade.php` | `Document::where('deal_analysis_id', $deal->id)->limit(20)` - title, category, uploaded-ago, KB size. Listing only; downloads happen on the full page via `#documents` anchor. | "Open the full page to upload" |
| `slide-over-notes.blade.php` | `metrics.notes` (manual), `carina_narrative`, `carina_verdict` (scalar entries rendered as a definition list). | "Open full page" link to `tenant.deals.show` |

The slide-over is **read-only**. Any edit affordance routes to the full deal page so we keep one place where state changes happen.

## Active Deals Kanban (deep-link only)

`DealBoardController@index` still groups `deal_analyses` into a Kanban with **3 columns** mapped to real `status` values (`suggested`, `draft`, `shared`), an "All analyses" list tab (paginated 25/page including archived), and an "X archived" chip in the tab bar. The page is reachable via `tenant.deals.board` (`/deals/board`) directly - bookmarks survive - but it is no longer in the top-level nav. Earlier chart-heavy sourcing-feed widgets are still retired; sourcing event surfaces live on `tenant.deals.sourcing.inbox` and the Sourced Listings hub.

## New Deal page

## Overview
The Deal Engine handles property deal analysis - users model a deal strategy against a property and get ROI projections, cashflow forecasts, and investment metrics via a suite of UK-specific calculators. Also covers listing sourcing, refurb management, deal offers, shortlists, and market intelligence.

**Feature flag:** `deal_engine` (BillingModule::DealEngine)  
**Controllers:** `DealController`, `DealCalculatorsController`, `DealCalculatorController`, `DealCalculatorSettingsController`, `DealWorkspaceController`, `DealSourcingDiligenceController`, `DealShortlistController`, `DealOfferController`, `DealBrowserExtensionController`, `DealRefurbController`, `PortalListingsController`, `ManualSearchController`  
**Model:** `App\Models\Tenant\DealAnalysis` (table `deal_analyses`, UUID PK)

**Route:** `GET /deals/sourcing/manual-search` (`tenant.deals.sourcing.manual-search`)
**Controller:** `ManualSearchController@index` - passes only `$propertyDataUrl` and `$researchLinkCount`.

Three sections in `resources/views/tenant/deals/sourcing/manual-search.blade.php`:

1. **URL paste hero** - a `<form method="GET" action="tenant.deals.create">` with a `portal_url` input and a hidden `source_type=url`. Submitting deep-links into `tenant.deals.create` with the URL prefilled.
2. **Two shortcuts** - "Off-market / direct" and "Existing portfolio property" cards link straight to `tenant.deals.create?source_type=offmarket|portfolio`.
3. **Sourcing setup accordion** - a native `<details>/<summary>` element titled "Sourcing setup (automated feeds, alerts, criteria)" containing the 15 legacy sourcing config cards plus the PropertyData panel. Power users keep one-click access; new users see a focused page.

**Prefill into the calculator:** `DealController@create(Request)` reads `strategy`, `title`, `portal_url`, `address_line1`, `source_type`, `property_id` from the query string and passes them to `tenant.deals.create.blade.php`, which:
- Fills the title input via `old('title', $prefillTitle)`
- Adds hidden `metrics[listing_source_url]`, `metrics[address_line1]`, `metrics[source_type]` inputs
- Shows a "Prefilled from the New Deal page" banner above the form

**Quick-save (draft without analysing):** `POST tenant.deals.quick-save` → `DealController@quickSave`. Validates `title`, `strategy` (from `DealCalculatorRegistry::DEAL_STRATEGY_SLUGS`), `portal_url`, `address_line1`, `property_id`, `source_type`. Creates a `DealAnalysis` with `status='draft'`, stores URL/address/source inside `metrics`, redirects to `tenant.deals.show`. Throttled at 30/min.

**Tests:**
- `tests/Feature/Tenant/Deals/PropertyFirstIndexTest.php` - property-first index renders the URL paste hero / card grid / empty state, slide-over JSON shape, numbers tab renders calculator figures, numbers empty CTA, tab fallback, auth redirect, property-address subtitle preference.
- `tests/Feature/Tenant/Deals/NavRestructureTest.php` - Active Deals kanban tabs, status-column bucketing, archived-deal isolation, empty-state hero, New Deal page hero.
- `tests/Feature/Tenant/Deals/NewDealWizardTest.php` - quick-save success / validation / create-form prefill.
- `tests/Feature/Deals/DealListingsViewModeTest.php` - Sourced Listings grid/list toggle (unchanged) plus the post-226 property-first index assertions.

## Deal Analysis Model

**Columns:** `id`, `property_id` (FK), `title`, `strategy` (btl/hmo/brr/flip/sa/r2r/commercial/development/land), `status` (draft/active/analysing/live/closed_won/closed_lost), `metrics` (JSONB - financial outputs), `refurb_scope` (JSONB), `notes`, `carina_summary`

**Relationships:** `property()`, `pipelineDeals()`, `complianceItems()`, `calculatorLogs()`, `refurbLines()`, `dealAlerts()`, `offers()`, `carinaConversations()`

## Deal Controllers

| Controller | Purpose |
|-----------|---------|
| `DealController` | CRUD deal analyses; **property-first card grid index** (12/page, ordered by `updated_at`), URL filters still honoured, plus `slideOver()` JSON endpoint for the right-side preview panel |
| `PortalListingsController` | Sourced Listings hub (`tenant.deals.sourcing.listings.*`), URL import, sale/rent tabs, grid or list view |
| `DealCalculatorsController` | UI for running calculators per strategy |
| `DealCalculatorController` | Calculator-specific routes (run, labs, play) |
| `DealCalculatorSettingsController` | Per-workspace calculator defaults |
| `DealWorkspaceController` | Deal workspace hub, sourcing criteria CRUD |
| `DealSourcingDiligenceController` | Due diligence packs, research links |
| `DealShortlistController` | Saved deal shortlists |
| `DealShortlistAttachmentController` | Attachments to shortlists |
| `DealOfferController` | Deal offers CRUD |
| `DealBrowserExtensionController` | Browser extension capture endpoint |
| `DealRefurbController` | Refurbishment line items per deal |

## Calculators

All implement `App\Services\Deals\Calculators\DealCalculatorInterface`. Registered with `DealCalculatorRegistry`.

| Calculator | Strategy | Key Outputs |
|-----------|----------|-------------|
| `BtlCalculator` | btl | Gross/net yield, monthly cashflow, ROI, SDLT |
| `HmoCalculator` | hmo | Per-room rent, HMO yield, room count impact |
| `BrrCalculator` | brr | Refurb cost, after-refurb value, cash-out refi amount |
| `FlipCalculator` | flip | Purchase + refurb, exit value, profit, holding costs |
| `SaCalculator` | sa | Serviced accommodation yield, occupancy rate |
| `R2rCalculator` | r2r | Rent-to-rent margin, management fee |
| `CommercialCalculator` | commercial | Commercial yield, lease length impact |
| `BridgingCalculator` | - | Bridging loan interest, exit strategy |
| `IncomeMultiplesCalculator` | - | Income vs mortgage affordability check |
| `MortgageCalculator` | - | Monthly payment, total interest, affordability |
| `CocRoeCalculator` | - | Cash-on-cash return, ROE |
| `NpvIrrCalculator` | - | Net present value, internal rate of return |
| `DscrCalculator` | - | Debt service coverage ratio |
| `LtvCalculator` | - | Loan-to-value ratio |
| `SdltCalculator` | - | Stamp duty (additional property rates) |
| `BreakevenOccupancyCalculator` | sa | Minimum occupancy to break even |

### Calculators hub (`/deals/calculators`)

The hub is a **card grid + drawer** (prompt 227 visual upgrade superseded by the post-227 drawer rebuild). Backed by `DealCalculatorsController::index` and rendered through `resources/views/tenant/deals/calculators/index.blade.php`.

- **Catalogue:** full-width card grid in `partials/calculator-hub-nav.blade.php` and `partials/calculator-hub-nav-item.blade.php`. Two sections (Deal strategies / Financial tools) with header pills (Refurb costing, SA vs BTL, Development). Cards show a coloured heroicon, label, 2-line description, and a left accent from `DealCalculatorRegistry::pageAccentClass()`.
- **Drawer:** `partials/calculator-drawer.blade.php` is mounted once on the hub. Clicking any card dispatches a `calculator-open` window event (the anchor `<a href>` is preserved for SSR / middle-click). The drawer Alpine component (`resources/js/alpine/calculator-drawer.js`, registered as `calculatorDrawer`) fetches `/deals/calculators/{slug}/pane`, injects the HTML, re-runs inline `<script>` tags so `window.__CALC_PANE_CONFIG__` is set, then calls `Alpine.initTree()` on the injected subtree. `Alpine.destroyTree()` runs on close / slug switch.
- **Two-tier presentation:** the drawer reads kind from `DealCalculatorRegistry::DEAL_STRATEGY_SLUGS`. Deal strategies get a wider panel (`sm:max-w-5xl`), a coloured left border, a "Deal strategy" header badge, and a UK-context aside generated from `DealCalculatorRegistry::ukBrief($slug)`. Financial tools get a narrower panel (`sm:max-w-3xl`), no accent stripe, a "Financial tool" header badge, and no UK aside.
- **Pane endpoint:** `GET /deals/calculators/{calculator}/pane` (`tenant.deals.calculators.pane`) → `DealCalculatorsController::pane()` → `partials/drawer-pane.blade.php`. Returns the UK brief (strategies only) plus `partials/calc-pane.blade.php` as a bare HTML fragment with no layout chrome.
- **URL sync / deep links:** `?model={slug}` opens the drawer for that calculator on page load. Switching cards calls `history.pushState`, closing the drawer goes back to the bare URL. The browser back button closes the drawer via `popstate`.
- **Icon source of truth:** `DealCalculatorRegistry::iconPath(string $slug)` returns a 24x24 heroicon outline path for every registered slug. Add an entry whenever a new slug ships; `tests/Feature/Deals/DealCalculatorsHubTest.php` enforces non-empty paths.
- **UK brief source of truth:** `DealCalculatorRegistry::ukBrief(string $slug)` returns a 1-3 sentence UK-specific brief for deal strategies and `''` for financial tools. Add an entry whenever a new strategy ships; the hub test enforces non-empty briefs for every strategy slug.
- **`partials/calc-pane.blade.php` is still shared** with the deal create/edit flow and embed view - keep it portable.

## Listing view modes (grid / list)

Two tenant pages support switching between a **card grid** and a **table list**, with thumbnail images from `property.primary_image_url` or `metrics.listing_image_urls.0`.

| Page | Route | Controller | Default | Query param | `localStorage` key |
|------|-------|------------|---------|-------------|-------------------|
| Sourced Listings | `GET /deals/sourcing/listings` (`tenant.deals.sourcing.listings.index`) | `PortalListingsController@index` | `grid` | `?view=grid\|list` | `sourced-listings-view-mode` |
| Deal Engine index | `GET /deals` (`tenant.deals.index`) | `DealController@index` | `list` | `?view=grid\|list` | `deal-analysis-view-mode` |

**UI:** `<x-tenant.view-mode-toggle>` (`resources/views/components/tenant/view-mode-toggle.blade.php`). Toggle buttons write `localStorage`, then navigate with `?view=` set. On first load without `view` in the URL, a short inline script reads `localStorage` and redirects so the saved preference applies.

**Views (partials):**
- Sourced Listings: `tenant/deals/sourcing/listings/_card-grid.blade.php`, `_list-table.blade.php`; parent `index.blade.php` includes one partial by `$viewMode`.
- Deal Engine: `tenant/deals/_card-grid.blade.php` for grid; existing table markup for list (compare checkboxes preserved in both modes).

Filters, sale/rent tabs, and pagination use `withQueryString()` so `view` (and other query params) persist across pages.

**Tests:** `tests/Feature/Deals/DealListingsViewModeTest.php`, `PortalListingsPageTest.php`.

**Spec:** `brain/prompts/80-deal-listings-grid-list-toggle.md`.

## Listing Sourcing

- **Listing Sources** (`ListingSource`): RSS, webhook, email-driven property feeds
- **Listing Automation** (`ListingAutomationWatch`): portal search URL monitoring
- **Sourcing Criteria** (`SourcingCriterion`): saved search criteria with alerts
- **Sourcing Research Links** (`SourcingResearchLink`): bookmarked URLs
- **Licensed Feeds** (`PollLicensedListingFeedsJob`): batch partner feed ingestion (Rightmove RTDF, Zoopla, OTM placeholders in config)
- **Browser Extension** (`DealBrowserExtensionController`): URL capture from portals
- **Manual Search** (`ManualSearchController`): quick property search by postcode/area
- **Market Intelligence Hub** (`MarketIntelligenceHubController`): PropertyData research tools, area profiles

## Refurb Management

- `DealRefurbLine` - per-deal refurb line items (cost, category, contractor)
- `RefurbCatalogueItem` - UK refurb cost reference table
- `DealRefurbRollupService` - aggregates refurb costs per deal

## Deal Offers

`App\Models\Tenant\DealOffer` - offer tracking (amount, terms, status, dates). Linked to DealAnalysis.

## Deal Shortlists

`App\Models\Tenant\DealShortlist` / `DealShortlistItem` - saved deal collections for comparison.

## UK-Specific SDLT (Additional Property Rates)

| Band | Rate |
|------|------|
| Up to £250k | 5% |
| £250k-£925k | 10% |
| £925k-£1.5m | 15% |
| Over £1.5m | 17% |

## Carina Narratives

`DealController` POST `/{deal}/carina-narrative` calls `CarinaService::generateDealNarrative()` - 3-paragraph AI investment summary stored in `deal.carina_summary`.
