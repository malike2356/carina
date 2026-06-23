# Properties (Portfolio Hub)

## Overview
The Properties module is the central hub for managing property assets. Each property stores address, physical attributes, financial metrics, EPC data, HMO licence info, and strategy classification.

**Routes:** `tenant.properties.*`  
**Controller:** `App\Http\Controllers\Tenant\PropertyController`  
**Model:** `App\Models\Tenant\Property`  

## Routes

| Method | URI | Name | Action |
|--------|-----|------|--------|
| GET | `/properties` | `tenant.properties.index` | List all properties |
| GET | `/properties/create` | `tenant.properties.create` | Show create form |
| POST | `/properties` | `tenant.properties.store` | Store new property |
| POST | `/properties/{property}/copy` | `tenant.properties.duplicate` | Duplicate property row (scenario modelling) |
| GET | `/properties/postcode/lookup/{postcode}` | `tenant.properties.postcode.lookup` | JSON: postcodes.io-backed lookup (cached) |
| GET | `/properties/postcode/validate/{postcode}` | `tenant.properties.postcode.validate` | JSON: normalise + validity |
| POST | `/properties/{property}/tenancies` | `tenant.properties.tenancies.store` | Add tenancy record |
| PUT | `/properties/{property}/tenancies/{tenancy}` | `tenant.properties.tenancies.update` | Update tenancy |
| POST | `/properties/{property}/tenancies/{tenancy}/end` | `tenant.properties.tenancies.end` | Set end date (defaults to today) |
| POST | `/properties/{property}/documents` | `tenant.properties.documents.store` | Upload document (local disk) |
| GET | `/properties/{property}/documents/{document}/download` | `tenant.properties.documents.download` | Download |
| DELETE | `/properties/{property}/documents/{document}` | `tenant.properties.documents.destroy` | Delete file + row |
| GET | `/properties/{property}` | `tenant.properties.show` | View single property |
| GET | `/properties/{property}/edit` | `tenant.properties.edit` | Show edit form |
| PUT | `/properties/{property}` | `tenant.properties.update` | Update property |
| DELETE | `/properties/{property}` | `tenant.properties.destroy` | Delete property |

**Services:** `App\Services\Property\PropertyService` (portfolio stats, metrics, duplicate), `PropertySearchService` (list filters), `PropertyFinancialService` (UK yields, SDLT additional-property bands), `PostcodeService` (normalise, validate, lookup). Form requests: `App\Http\Requests\Tenant\StorePropertyRequest`, `UpdatePropertyRequest`, `StorePropertyTenancyRequest`, `UpdatePropertyTenancyRequest`.

**Tables:** `property_tenancies`, `property_documents` (tenant migrations).

**Document vault on show:** **`tenant.properties.show`** renders uploaded files under **`id="vault-documents"`** so other modules can deep-link (for example compliance **`tenant.compliance.show`**). See **`40-tenant-compliance-vault-documents-ui.md`**.

## Model: `Property`

**Table:** `properties` (tenant-scoped)

**Fillable columns:**

| Category | Columns |
|----------|---------|
| Address | `address_line1`, `address_line2`, `city`, `county`, `postcode`, `country`, `latitude`, `longitude` |
| Physical | `property_type`, `bedrooms`, `bathrooms`, `reception_rooms`, `sqft`, `sqm`, `tenure`, `lease_years_remaining`, `garden`, `parking` |
| EPC | `epc_rating`, `epc_potential_rating`, `epc_expiry` |
| Status/Strategy | `status`, `strategy` |
| Financial | `purchase_price`, `current_value`, `mortgage_balance`, `monthly_mortgage`, `monthly_rent`, `gross_yield`, `net_yield`, `roi_percentage`, `monthly_cashflow`, `annual_cashflow` |
| HMO | `rooms_count`, `hmo_license_required`, `hmo_license_number`, `hmo_license_expiry` |
| Sourcing | `land_registry_id`, `last_sold_price`, `last_sold_date`, `source`, `source_url`, `rightmove_id`, `zoopla_id` |
| Other | `notes`, `carina_summary`, `created_by` |

**Relationships:**

```php
public function deals()          // hasMany(DealAnalysis::class)
public function pipelineDeals()  // hasMany(PipelineDeal::class)
public function complianceItems() // hasMany(ComplianceItem::class)
public function creator()        // belongsTo(User::class, 'created_by')
```

**Searchable fields (Scout/Meilisearch):** `id`, `address` (composite), `property_type`, `strategy`, `status`, `bedrooms`, `city`, `postcode`, `monthly_rent`, `gross_yield`

## Controller: `PropertyController`

**Index:** Lists properties with optional search (address, city, postcode) and filters (property_type, status, strategy, bedrooms range). Paginated 20 per page.

**Create/Store:** Validates property data, auto-calculates yield if monthly_rent and current_value provided:

```php
// Gross yield = (monthly_rent * 12 / current_value) * 100
// Net yield = ((monthly_rent * 12) - annual_costs) / current_value * 100
// Monthly cashflow = monthly_rent - monthly_mortgage - monthly_costs
```

**Show:** Displays full property detail with linked deals, compliance items, pipeline items, and activity log.

## Views

- `resources/views/tenant/properties/index.blade.php` - table with search/filter
- `resources/views/tenant/properties/create.blade.php` - form with sections
- `resources/views/tenant/properties/show.blade.php` - detail + relationships
- `resources/views/tenant/properties/edit.blade.php` - same form as create

## Key Calculations

```
gross_yield = (monthly_rent × 12) / current_value × 100
net_yield   = ((monthly_rent × 12) - annual_expenses) / current_value × 100
roi         = (annual_cashflow / total_invested) × 100
```

## UK Property Strategies (enum)

- `btl` - Buy to Let (standard rental)
- `brr` - Buy, Refurbish, Refinance
- `hmo` - House in Multiple Occupation
- `sa` - Serviced Accommodation
- `r2r` - Rent to Rent
- `flip` - Property Flipping
- `commercial` - Commercial Property
- `development` - Development / New Build
- `land` - Land Banking