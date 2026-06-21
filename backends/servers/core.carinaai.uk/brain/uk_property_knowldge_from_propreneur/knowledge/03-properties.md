# Properties (Portfolio Hub)

**Last updated:** 2026-05-15

## Overview
Central hub for managing property assets. Each property stores address, physical attributes, financial metrics, EPC data, HMO licence info, documents, and tenancy records.

**Feature flag:** `multi_property` (BillingModule::MultiProperty)  
**Routes:** `tenant.properties.*`  
**Controller:** `App\Http\Controllers\Tenant\PropertyController`  
**Model:** `App\Models\Tenant\Property` (table `properties`)  
**Services:** `PropertyService`, `PropertySearchService`, `PropertyFinancialService`, `PostcodeService`

## Routes

| Method | URI | Action |
|--------|-----|--------|
| GET | `/properties` | List (searchable, filterable by type/status/strategy) |
| GET | `/properties/create` | Show create form |
| POST | `/properties` | Store new property |
| GET | `/properties/{property}` | Show detail with linked deals, compliance, pipeline |
| GET | `/properties/{property}/sa-performance` | Edit SA performance metrics (strategy `sa` or existing metrics) |
| PUT | `/properties/{property}/sa-performance` | Save `sa_metrics` JSONB |
| GET | `/properties/{property}/edit` | Show edit form |
| PUT | `/properties/{property}` | Update property |
| DELETE | `/properties/{property}` | Delete property |
| POST | `/properties/{property}/copy` | Duplicate property |
| POST | `/properties/{property}/documents` | Upload document to property vault |
| DELETE | `/properties/{property}/documents/{document}` | Delete document |
| GET | `/properties/{property}/documents/{document}/download` | Download document |
| GET | `/properties/{property}/documents/{document}/versions` | Document version history |
| POST | `/properties/{property}/tenancies` | Create tenancy record |
| PUT | `/properties/{property}/tenancies/{tenancy}` | Update tenancy |
| DELETE | `/properties/{property}/tenancies/{tenancy}` | Delete tenancy |
| POST | `/properties/{property}/tenancies/{tenancy}/end` | End tenancy |
| GET | `/properties/postcode/lookup/{postcode}` | Address lookup |
| GET | `/properties/postcode/validate/{postcode}` | Postcode validation |
| GET | `/properties/tenancies` | Tenancy directory |
| POST | `/properties/tenancies` | Store tenancy direct from directory |

## Property Model

**Table:** `properties` (tenant-scoped, UUID primary key)

**Address:** `address_line1`, `address_line2`, `city`, `county`, `postcode`, `country`, `latitude`, `longitude`

**Physical:** `property_type`, `bedrooms`, `bathrooms`, `reception_rooms`, `sqft`, `sqm`, `tenure` (freehold/leasehold), `lease_years_remaining`, `garden`, `parking`, `construction_date`, `council_tax_band`, `epc_rating`, `epc_potential_rating`, `epc_expiry`

**Status/Strategy:** `status` (draft/active/sold/rented), `strategy` (btl/brr/hmo/sa/r2r/flip/commercial/development/land)

**Financial:** `purchase_price`, `current_value`, `mortgage_balance`, `monthly_mortgage`, `monthly_rent`, `gross_yield`, `net_yield`, `roi_percentage`, `monthly_cashflow`, `annual_cashflow`, `total_invested`

**HMO:** `rooms_count`, `hmo_license_required`, `hmo_license_number`, `hmo_license_expiry`

**Sourcing:** `land_registry_id`, `last_sold_price`, `last_sold_date`, `source`, `source_url`, `rightmove_id`, `zoopla_id`

**SA performance:** `sa_metrics` JSONB (nullable) - occupancy, nightly rate, revenue, Airbnb quality score, reviews, Guest Favorite / Superhost, competitive-set benchmarks. Service: `SaPerformanceService`. Carina includes metrics in property context when populated. Portfolio view: `GET /reporting/sa-portfolio` (`tenant.reporting.sa-portfolio`).

**Relationships:** `deals()` (DealAnalysis), `pipelineDeals()` (PipelineDeal), `complianceItems()` (ComplianceItem), `documents()` (PropertyDocument), `tenancies()` (PropertyTenancy), `creator()` (User)

## Documents (Vault)

`App\Models\Tenant\PropertyDocument` - file uploads per property with version tracking. Upload/download via property show page. Compliance vault deep-link (`#vault-documents`).

## Tenancy Records

`App\Models\Tenant\PropertyTenancy` - tenant name, rent amount, deposit, start/end dates, notice period. Directory view at `/properties/tenancies`.

## Area Profiles

`App\Models\Tenant\AreaProfile` - named sourcing area bundles, optional map pins.

## UK Property Strategies

- `btl` - Buy to Let (standard rental)
- `brr` - Buy, Refurbish, Refinance
- `hmo` - House in Multiple Occupation
- `sa` - Serviced Accommodation
- `r2r` - Rent to Rent
- `flip` - Property Flipping
- `commercial` - Commercial Property
- `development` - Development / New Build
- `land` - Land Banking

## Calculations

```
gross_yield = (monthly_rent × 12) / current_value × 100
net_yield   = ((monthly_rent × 12) - annual_expenses) / current_value × 100
roi         = (annual_cashflow / total_invested) × 100
```
