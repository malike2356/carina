# Deals Module - Strategy, Audit & Build Plan

**Gap closures (compare, verdict, pack share, pipeline automations, offers, timing, AirDNA):** see `brain/knowledge/110-deal-engine-gaps-closed.md`.

**Last updated:** 2026-05-02
**Scope:** Deal Engine (modules 1), Deal Calculators (prompt 10), Deal Sourcing (prompt 11), live listings strategy

---

## How BenchStack-Class Platforms Typically Ingest Live Listings

This is the honest answer. **BenchStack** is our fictitious umbrella for shallow researched competitors; they are not doing anything magical.

### Route A - Official Rightmove RTDF (Most Likely)

Rightmove operates a **Rightmove Tech Data Feed (RTDF)** programme. Registered PropTech partners sign a commercial agreement, pay a monthly licence fee (typically £hundreds/month), and receive API/FTP access to live listings including images and full property data. Typical BenchStack-class listing portals almost certainly use this. Requirements: you apply as a technology company, demonstrate a legitimate business case, and Rightmove approves you.

### Route B - Zoopla Partner API

Identical structure. Zoopla licenses data to PropTech partners through a commercial agreement. You apply, they vet you, you sign a contract, you pay per API call or flat monthly fee.

### Route C - URL Import (Grey Area)

User pastes a Rightmove or Zoopla URL into the tool. The server fetches that public URL and parses it. Rightmove embeds structured JSON data in their listing pages. Technically this is a single fetch of a public webpage - Rightmove ToS prohibits systematic scraping but enforcement is weak for individual user-initiated lookups. Many tools do this.

### What PropertyData Does NOT Do

PropertyData.co.uk provides: historical sold prices (Land Registry), rental estimates, yield calculations, area statistics, planning applications. It does NOT provide current `for sale` or `to let` listings. Your v1 integration was correct - you got analytics but not live listings because that is what PropertyData sells. You were not doing it wrong.

### The Realistic Path for Propreneur

| Timeline | Method | Cost | Notes |
|---|---|---|---|
| Now (weeks) | URL import - paste any listing URL, we parse it | Dev time only | Grey area legally but standard practice |
| Now | OpenRent API | Free for developers | Rental listings - BTL/HMO use case |
| Now | SpareRoom API | Free | Room-by-room HMO listings |
| 3-6 months | Apply for Rightmove RTDF partnership | £hundreds/month | Requires commercial negotiation |
| 3-6 months | Apply for Zoopla Partner API | Varies | Same process |
| Ongoing | PropertyData API | Pay per call | Analytics enrichment - already configured |

---

## Current Build State (Audit)

### BUILT AND WORKING

| Component | File | Lines | Status |
|---|---|---|---|
| BTL Calculator | `app/Services/Deals/Calculators/BtlCalculator.php` | 100 | Complete - gross/net yield, cashflow, ROI, stress test |
| BRR Calculator | `app/Services/Deals/Calculators/BrrCalculator.php` | 67 | Complete |
| HMO Calculator | `app/Services/Deals/Calculators/HmoCalculator.php` | 74 | Complete |
| R2R Calculator | `app/Services/Deals/Calculators/R2rCalculator.php` | 55 | Complete |
| SA Calculator | `app/Services/Deals/Calculators/SaCalculator.php` | 57 | Complete |
| Flip Calculator | `app/Services/Deals/Calculators/FlipCalculator.php` | 68 | Complete |
| DealAnalysisService | `app/Services/Deals/DealAnalysisService.php` | 50 | CRUD + Carina narrative |
| DealController | `app/Http/Controllers/Tenant/DealController.php` | 93 | index/create/store/show/edit/update/destroy/generateNarrative |
| DB migrations | `2026_04_07_000003_create_deal_engine_tables.php` | - | deal_analyses, deal_alerts, scraper_jobs |
| Deal views | `resources/views/tenant/deals/` | 474 | All 4 CRUD views |
| PropertyData config | `config/services.php` | - | API key configured, not yet integrated |

### Phase 1 Build Status - Completed 2026-05-02

| Item | Status |
|---|---|
| `SensitivityAnalysisService` - all 6 strategies (BTL, BRR, HMO, R2R, SA, flip) with base / optimistic / pessimistic | DONE |
| `PropertyDataService` - PropertyData.co.uk wrapper; sold prices, rent estimate, average yields, valuation, sourced properties; 24-hour Redis cache | DONE |
| `ListingImportService` - facade; `LISTINGS_IMPORT_DRIVER` = `url` (default), `partner`, or `chain`. Free path: `UrlListingImportDriver`. Paid path: `PartnerListingImportDriver` POSTs to `LISTINGS_PARTNER_BASE_URL` + `LISTINGS_PARTNER_IMPORT_PATH` with Bearer or API-key header (`LISTINGS_PARTNER_AUTH_SCHEME`); response JSON mapped to the same fields as URL import plus optional `rightmove_id` / `zoopla_id`. `config/listings.php` | DONE |
| Licensed **batch** feed - `ListingFeedIngestionOrchestrator` + `OwnedListingIngestService::ingestLicensedFeedItem` (Property `source=licensed_feed`, draft `DealAnalysis`, metrics `licensed_listing_feed` + image URLs); `POST /deals/sourcing/licensed-feed/sync` + Deal workspace card; Carina deal/property context appendix for licensed rows; `ListingFeedBatchNormalizer`. | DONE (2026-05-04) |
| `DealCalculatorController` - `sensitivity()` for all strategies; legacy `sensitivityBtl` route kept | DONE |
| Routes: `POST /deals/import-listing`, `GET /deals/property-data/{postcode}`, `POST /deals/calculate/sensitivity/{strategy}` | DONE |
| Calculators: seven deal strategies plus six tools (`npv_irr`, `dscr`, `income_multiples`, `coc_roe`, `ltv`, `breakeven_occupancy`) | DONE |
| Tests: feature deals suite + `tests/Unit/Deals/ListingImportTest.php` and `tests/Unit/Deals/PropertyDataServiceTest.php` (no `FeatureFlagSeeder` on unit paths) | DONE |
| `DealCarinaIntegrationTest` | POST Carina + deal flow active; GET `open-deal` `it()` skipped until CI stable (see `04-deals.md`) |

### Phase 2 - Sourcing engine (skeleton landed 2026-05-02)

| Item | Location |
|---|---|
| Migration `sourcing_criteria` | `database/migrations/tenant/2026_05_02_200000_create_sourcing_criteria_table.php` |
| Model | `app/Models/Tenant/SourcingCriterion.php` |
| Sourcing + investor match | `app/Services/Deals/SourcingMatchService.php` - criterion `score()` heuristic (0-1); investor vs `PipelineDeal` match (0-25), cached 24h; see CRM investor intelligence in `05-crm.md` |
| Alert dispatch stub | `app/Services/Deals/AlertDispatchService.php` |
| Scheduled job stub | `app/Jobs/Deals/ProcessSourcingAlertsJob.php` (scheduled `03:30` in `routes/console.php`) |
| Schema smoke test | `tests/Feature/Deals/SourcingCriterionSchemaTest.php` |
| Workspace hub + sourcing criteria CRUD | `GET /deals/workspace`, `DealWorkspaceController`; `SourcingCriterionController` + `StoreSourcingCriterionRequest`; nav under Deals; **`41-deal-workspace-v1-parity-journey.md`** | DONE (2026-05-03) |

Implementation work remains: scoring rules, `deal_alerts` integration, notifications, property feed wiring inside `ProcessSourcingAlertsJob::handle()`, sourcing inbox UI.

### Still Missing (Phase 2+ implementation)

| Missing | Prompt | Priority |
|---|---|---|
| SourcingMatchService scoring + property feed | 11 | Medium |
| AlertDispatchService persistence + notifications | 11 | Medium |
| ProcessSourcingAlertsJob criteria loop + tenancy | 11 | Medium |
| Deal comparison controller | 10 | Low |
| DTOs per strategy | 10 | Low |

---

## What Propreneur Has That BenchStack Does Not

This is the competitive moat. BenchStack does not have:

1. **Full CRM with investment intelligence scoring** - contacts scored by capital capacity, strategy match, and deal engagement - not by email opens
2. **AI assistant (Carina)** - conversational deal analysis, investor matching, deal teaser generation - not just a calculator overlay
3. **Multi-user workspace** - team can collaborate on the same deal simultaneously
4. **Complete deal lifecycle** - from sourcing through screening through offer through completion through management through exit
5. **Mentoring network integration** - unique to Propreneur, no equivalent exists
6. **Compliance tracking linked to properties** - EPC, gas safety, HMO licence all in one view
7. **Document vault** - contracts, reports, correspondence per property/deal
8. **Detailed BRRRR/HMO/R2R calculators** - BenchStack-class tools usually stop at yield, not full BRRRR/R2R/SA analysis
9. **Sensitivity analysis with portfolio aggregation** - what happens to your whole portfolio if rates rise 2%?
10. **Carina deal screening** - AI auto-screens against your saved criteria, not just filter sliders
11. **Property-triggered communications** - sequences fired by actual property events (deal matched, compliance expiry, stale deal), not form fills. Every message contains live deal data generated by Carina.
12. **Investor deal distribution machine** - when a sourcing match is scored, the right investor gets a Carina-written deal teaser automatically. No other property platform does this.

BenchStack has no unified property MIS depth: listings and funnels sit beside spreadsheets, not inside one deal model. Its "deal teaser" is a generic email template. Propreneur's deal teaser is Carina-generated with the actual ROI, cashflow, and strategy narrative from the deal calculator.

---

## Phased Build Plan

### Phase 1 - Complete Existing Foundation

Delivered as listed in **Phase 1 Build Status** above.

### Phase 2 - Sourcing Engine

Skeleton files are listed in **Phase 2 - Sourcing engine** above. Next: implement `SourcingMatchService::score()`, wire `AlertDispatchService` to `deal_alerts`, and iterate properties inside `ProcessSourcingAlertsJob`.

- `app/Console/Commands/Deals/ProcessAlertsCommand.php` (optional CLI mirror of the job)
- Saved searches UI in deal views

### Phase 3 - Live Listings (Partner Track)

- Apply for Rightmove RTDF partnership
- Until approved: ListingImportService (Phase 1) covers URL-by-URL imports
- OpenRent API integration (free, rental listings) - great for BTL/HMO investors
- SpareRoom API integration (free, room listings) - great for HMO room-by-room analysis
- Browser extension (future): reads Rightmove/Zoopla as user browses, one-click import to Propreneur

### Phase 4 - The Propreneur Edge (Differentiator Sprint)

- Portfolio-level sensitivity analysis (one slider, all properties)
- Deal sharing with mentors/network (unique feature)
- Carina auto-screening (new deals auto-evaluated against criteria, PASS/FAIL with reason)
- Deal comparison table (compare 3-4 deals side by side with all metrics)
- Investment thesis generator (Carina writes a 1-page deal memo ready to share with investors/lenders)
- Exit planning (when to refinance/sell based on projections)

### Phase 5 - Investor Distribution (after Module 4 + scoring land)

When `SourcingMatchService` scores a deal ≥ threshold for an investor:
1. `deal_match_score` on the investor contact updates immediately
2. Communications Hub enrolls the investor in the `deal.matched` sequence
3. Carina generates a `{{carina.deal_teaser}}` token using live deal calculator data
4. Email/SMS dispatched automatically via `CommunicationDeliveryService`

This makes the sourcing engine a full deal-to-investor distribution machine with zero manual work.
Full spec: `brain/knowledge/31-comms-and-engagement-engine.md`.

---

## PropertyData API - What It Actually Provides

Endpoint reference for `app/Services/Deals/PropertyDataService.php`:

| Endpoint | What it returns | Use case |
|---|---|---|
| `/sold-prices` | Last 10 sold prices in postcode | Comparable evidence for deal analysis |
| `/rental-valuation` | Estimated rent for postcode + beds | Fill in monthly rent field |
| `/rental-price-growth` | Rental growth trend % per year | Sensitivity analysis input |
| `/property-types` | Supply/demand split by type | Area research |
| `/planning-applications` | Recent planning apps nearby | Development upside flag |
| `/regeneration-status` | Regeneration activity score | Capital growth proxy |
| `/demographics` | Population, age, income data | Area profile for listing description |
| `/yield-map` | Average yield by postcode | Benchmarking your deal against area |

All calls go through `PropertyDataService::get(string $endpoint, array $params): array` with Redis caching (24hr TTL per postcode/params combo). Never call PropertyData directly from a controller.

---

## URL Import - How It Works (ListingImportService)

Rightmove and Zoopla embed structured data in their HTML as JSON-LD (`<script type="application/ld+json">`) and React-hydrated data blobs. A single HTTP GET of a listing URL returns enough data to extract:

- Full address (from `address` JSON-LD field)
- Postcode (parsed from address)
- Asking price
- Number of bedrooms, bathrooms
- Property type (detached, semi, flat, HMO, etc.)
- Description text
- Image URLs (from `image` array in JSON-LD)
- Estate agent name and branch
- Listing URL (source tracking)

**Flow:**
1. User pastes URL in deal creation form
2. Frontend calls `POST /tenant/deals/import-url` with `{url: "..."}`
3. `DealCalculatorController::importUrl()` dispatches `ImportListingJob`
4. Job fetches URL via `Http::withHeaders([...])`, parses HTML, returns `ListingImportResult` DTO
5. Response pre-fills deal form fields via Alpine.js

**Supported sources:** rightmove.co.uk, zoopla.co.uk, onthemarket.com, openrent.co.uk, spareroom.co.uk, primelocation.com

---

## Cross-references

- Calculators: `app/Services/Deals/Calculators/`
- Deal controller: `app/Http/Controllers/Tenant/DealController.php`
- Migration: `database/migrations/tenant/2026_04_07_000003_create_deal_engine_tables.php`
- Prompts: `brain/prompts/09-deal-property.md`, `brain/prompts/10-deal-calculators.md`, `brain/prompts/11-deal-sourcing.md`
- PropertyCalculatorService (Carina integration): `app/Services/Carina/PropertyCalculatorService.php`

---

*Competitive research URLs are kept outside this repository; use internal notes.*
*Rightmove RTDF application: rightmoveplc.com/partners*
