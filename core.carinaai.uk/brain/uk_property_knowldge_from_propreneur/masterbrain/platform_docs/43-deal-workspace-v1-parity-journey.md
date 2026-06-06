# Deal workspace and v1 parity journey

**Last updated:** 2026-05-01  
**Scope:** Unify v1-style “Deals” navigation in v2 without collapsing module boundaries; ship first user-facing parity slices.

## Investor journey (v2 routes)

| Step | User intent | v2 entry |
|------|-------------|----------|
| Discover | Find or qualify a lead | **Workspace** (`/deals/workspace`) links to portfolio, CRM, reporting; **Sourcing criteria** (`/deals/sourcing/criteria`); **Deal shortlists** (`/deals/sourcing/shortlists`); **Area profiles** (`/deals/sourcing/profiles`); **Sourcing inbox** (`/deals/sourcing/inbox`) with **Open as deal**; listing URL paste on **Analyse deal** (`/deals/create`). |
| Model | Run numbers | **Calculators hub** (`/deals/calculators`), deal form calculator panel, `POST /deals/calculate/{strategy}`. |
| Track | Move deal through stages | **Pipeline** (`/pipelines`) when module enabled. |
| Record | Save analysis | **Deal Engine** list (`/deals`), show, edit. |
| Collaborate | Contacts and investors | **CRM** (`/contacts`). |
| Report | Area and portfolio views | **Reporting** (`/reporting`) when enabled. |
| Book | Viewings and slots | **viCal** (`/vical`) when enabled. |

## v1 sidebar parity (status)

| v1 area | v2 implementation | Status |
|---------|-------------------|--------|
| Sourcing Alerts | `deal_alerts` rows with `criteria.source = sourcing_matcher`; `ProcessSourcingAlertsJob` + `sourcing:process-alerts` | **Shipped** (first slice: portfolio vs criteria; dedupe in dispatch). |
| Sourcing Inbox | `GET /deals/sourcing/inbox` | **Shipped** - lists matcher alerts; property line + Open as deal. |
| Manual Search | PropertyData + URL import | **Partial** - tools exist; dedicated “search” hub optional. |
| Deal Shortlists | `/deals/sourcing/shortlists` + `deal_shortlists` / pivot to `deal_analyses` | **Shipped** - owner CRUD; pick analyses on form. |
| Bespoke Sourcing | - | **Gap** - workflows / comms later. |
| Area intelligence / research / profiles / Goldmine | Reporting + PropertyData + **`/deals/sourcing/profiles`** (`area_profiles`: linked `sourcing_criterion_ids`, optional map lat/lng) | **Partial** - named bundles shipped; Goldmine-level depth still reporting-led. |
| Deals (All) | `/deals` | **Shipped** |
| Pipeline | `/pipelines` | **Shipped** |
| Tasks | Pipeline activities / comms | **Partial** |
| Calendar | viCal | **Partial** |
| Analytics | `/reporting` + pipeline APIs | **Shipped** (split nav) |
| Pipeline stage settings | Tenant bootstrap + pipeline admin | **Partial** |

## Shipped in this wave

- **`GET /deals/workspace`** - hub with counts and gated shortcuts (pipeline, CRM, reporting, portfolio, viCal).  
- **`/deals/sourcing/criteria`** - full CRUD for `sourcing_criteria` (owner-scoped `created_by`).  
- **Sidebar** - Deals group: Workspace, Deal Engine, Sourcing inbox, Sourcing criteria, Deal shortlists, Area profiles, Calculators (Deal Engine active state excludes workspace, sourcing, calculators).  
- **Deal list** - header link to Workspace.
- **`ProcessSourcingAlertsJob`** / **`php artisan sourcing:process-alerts`** - `SourcingAlertProcessor` matches active criteria to tenant `Property` rows, writes `deal_alerts` via `AlertDispatchService::dispatchPropertyMatch` (24h dedupe per user + criterion + property).
- **`GET /deals/sourcing/inbox`** - lists current user matcher alerts; **Open as deal** preselects `property_id` on analyse form.
- **`/deals/sourcing/shortlists`** - `deal_shortlists` + `deal_shortlist_items` pivot to `deal_analyses` (owner CRUD).
- **`/deals/sourcing/profiles`** - `area_profiles` with JSON `sourcing_criterion_ids` and optional `map_latitude` / `map_longitude`.
- **Database + mail notifications** - `SourcingMatchNotification` when a new matcher `DealAlert` is created; inbox link uses tenant subdomain (`TenantWebUrls`). Disable mail with `SOURCING_MATCH_NOTIFICATIONS_MAIL=0` in `.env`. Deduped path sends none.
- **Add to shortlist from deal show** - `POST /deals/{deal}/shortlists` with `deal_shortlist_id` (`tenant.deals.shortlists.attach`).
- **Area profile map** - Leaflet + OpenStreetMap picker on create/edit (hidden lat/lng fields).

## Next implementation order (recommended)

1. **Bell / UI** for database notifications in the tenant shell (optional).  
2. **Shortlist multi-add** or pipeline integration from the same deal show panel.  
3. **Geocode postcode** into map centre when criteria postcodes exist (optional).

## Cross-references

- `04-deals.md` - calculator and deal analysis routes.  
- `29-deals-module-strategy.md` - listings drivers, sourcing strategy.  
- `06-pipeline.md` - Kanban.  
- `39-deal-calculator-v1-v2-parity-and-refurb-plan.md` - calculator depth.
