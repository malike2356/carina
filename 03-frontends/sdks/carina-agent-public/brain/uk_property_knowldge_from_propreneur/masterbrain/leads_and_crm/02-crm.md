# CRM (Contact Management)

## Overview
The CRM module manages contacts - vendors, agents, solicitors, brokers, tenants, investors, and other property professionals. Each contact can be linked to properties, deals, pipeline items, and activities.

**Routes:** `tenant.contacts.*`  
**Controller:** `App\Http\Controllers\Tenant\ContactController`  
**Model:** `App\Models\Tenant\Contact`  

## Routes

| Method | URI | Name |
|--------|-----|------|
| GET | `/contacts` | `tenant.contacts.index` |
| GET | `/contacts/create` | `tenant.contacts.create` |
| POST | `/contacts` | `tenant.contacts.store` |
| GET | `/contacts/{contact}` | `tenant.contacts.show` |
| GET | `/contacts/{contact}/edit` | `tenant.contacts.edit` |
| PUT | `/contacts/{contact}` | `tenant.contacts.update` |
| DELETE | `/contacts/{contact}` | `tenant.contacts.destroy` |

## Model: `Contact`

**Table:** `contacts` (tenant-scoped)

**Fillable columns:**

| Column | Type | Description |
|--------|------|-------------|
| `first_name` | string | Required |
| `last_name` | string | Required |
| `email` | string | Optional, unique per tenant |
| `phone` | string | Optional |
| `mobile` | string | Optional |
| `company` | string | Optional (e.g., "Savills", "HSBC") |
| `type` | string | vendor, agent, solicitor, broker, tenant, investor, contractor, other |
| `address_line1` | string | Optional |
| `city` | string | Optional |
| `postcode` | string | Optional |
| `source` | string | Optional (e.g., "Rightmove", "Referral", "Land Registry") |
| `notes` | text | Optional |
| `assigned_to` | UUID (FK → users) | Optional assignee |
| `created_by` | UUID (FK → users) | Auto-set on creation |
| `tags` | JSONB | Array of tags |
| `custom_fields` | JSONB | Custom key-value pairs |

**Virtual attribute:**

```php
public function getNameAttribute(): string
{
    return "{$this->first_name} {$this->last_name}";
}

// Usage: $contact->name returns "John Smith"
```

**Relationships:**

```php
public function assignee()      // belongsTo(User::class, 'assigned_to')
public function creator()       // belongsTo(User::class, 'created_by')
public function activities()    // hasMany(Activity::class)
public function pipelineDeals() // hasMany(PipelineDeal::class)
```

## Controller: `ContactController`

**Index:** Searchable by first_name, last_name, email, company. Filterable by type. Paginated 20 per page.

**Store/Update validation:**
```php
[
    'first_name' => 'required|string|max:100',
    'last_name'  => 'required|string|max:100',
    'email'      => 'nullable|email|max:150',
    'phone'      => 'nullable|string|max:30',
    'mobile'     => 'nullable|string|max:30',
    'company'    => 'nullable|string|max:150',
    'type'       => 'required|string',
    'address_line1' => 'nullable|string|max:200',
    'city'       => 'nullable|string|max:100',
    'postcode'   => 'nullable|string|max:10',
    'source'     => 'nullable|string|max:100',
    'notes'      => 'nullable|string',
    'tags'       => 'nullable|array',
]
```

**Show:** Displays contact details with activity log (last 10 activities).

## Contact Types

| Value | Label | Typical Use |
|-------|-------|-------------|
| `vendor` | Vendor | Property seller |
| `agent` | Agent | Estate agent |
| `solicitor` | Solicitor | Conveyancer / legal rep |
| `broker` | Broker | Mortgage broker |
| `tenant` | Tenant | Renting a property |
| `investor` | Investor | JV partner / funder |
| `contractor` | Contractor | Builder / tradesperson |
| `other` | Other | Anything else |

## Views

- `resources/views/tenant/contacts/index.blade.php` - table with search + type filter
- `resources/views/tenant/contacts/create.blade.php` - form (first_name, last_name split)
- `resources/views/tenant/contacts/show.blade.php` - detail + activity log
- `resources/views/tenant/contacts/edit.blade.php` - edit form (pre-filled)

## Important Implementation Details

1. **Name handling:** The form uses `first_name` and `last_name` as separate inputs. The model provides `$contact->name` as a virtual attribute for display. Never store a single `name` field.

2. **Search:** PostgreSQL `ilike` for case-insensitive partial matching across name parts, email, and company.

3. **Soft Deletes:** Contacts use `SoftDeletes` trait - destroyed contacts remain in DB with `deleted_at` timestamp.

4. **Searchable:** Implements Laravel Scout for Meilisearch/algolia full-text search of contacts.

## Related

- Interactions: each contact has many `ContactInteraction` records (calls, emails, meetings, notes, tasks, letters, viewings)
- Pipeline Items: contacts can be linked to pipeline deals
- Dashboard: contact count displayed in Command Centre metrics

## Investor intelligence (shipped 2026-05-02)

When `type = 'investor'`, use structured `investment_profile` and `investment_criteria` JSON on `contacts`, numeric score columns (`investment_score_engagement` 0-35, `investment_score_capacity` 0-40, `investment_score_match` 0-25, `investment_score_total` 0-100), `engagement_stage` (`new`, `active`, `warm`, `cold`, `lost`), budgets (`min_budget`, `max_budget`), `preferred_asset_classes`, `target_yield_min`, `investment_horizon_months`, `leverage_required`, `max_ltv`, `total_invested`, `deals_won`, `last_engagement_at`, `last_investor_score_at`. Optional one-to-one `investor_profiles` (past deals, capital by asset class, engagement history, communication preferences, `profile_tags`). Migration: `database/migrations/tenant/2026_05_02_700000_contacts_investor_intelligence.php`.

Services: `App\Services\Scoring\ContactScoringService` (per-contact and `scoreAllInvestors()`), `App\Services\Scoring\InvestorScoringRunner` (all active workspaces). Matching: `App\Services\Deals\SourcingMatchService::calculateInvestorPipelineDealScore()` (0-25 vs a `PipelineDeal` with property), `findTopInvestorsForDeal()`, `findMatchedPipelineDealsForInvestor()`. Criterion alert scoring `score(SourcingCriterion, array $property)` now uses min/max price, postcode prefixes, and min yield when present.

JSON API (same `/api/crm` gate): `GET contacts/{id}/investor-score`, `POST contacts/{id}/investor-score` (recalculate), `GET contacts/{id}/matched-pipeline-deals`, `GET pipeline-deals/{id}/matched-investors`. Command `php artisan investors:score` (`--all` all workspaces, `--batch` queue `ScoreAllInvestorsJob`). Schedule: daily `ScoreAllInvestorsJob` in `routes/console.php`. Demo seeder: `Database\Seeders\Tenant\InvestorDemoDataSeeder`. Factory state: `Contact::factory()->investor()`.

See `brain/knowledge/32-contact-intelligence-and-lead-scoring.md` for product philosophy; implementation details follow code above.

## Update 2026-05-02 (shipped implementation)

**Web UI (unchanged URL prefix):** `tenant.contacts.*` on `/contacts/*`, gated by `subscription.feature:crm` and `feature:crm`. Controller: `App\Http\Controllers\Tenant\ContactController` using `App\Services\Crm\ContactService`, `App\Services\Crm\InteractionService`, and `App\Http\Requests\Crm\StoreContactRequest` / `UpdateContactRequest`. Contacts are resolved with `Contact::query()->findOrFail((int) $request->route('contact'))` so lookups run after tenancy is initialised (see note below).

**JSON API:** `routes/tenant_crm_api.php` (required from `routes/tenant.php`). Prefix `/api/crm`. Named routes `tenant.api.crm.*`. Same subscription and feature gates. Controllers under `App\Http\Controllers\Api\Crm\` (`ContactController`, `ContactInteractionController`, `ContactImportExportController`). CSV import (`POST contacts/import`, throttle 20/min), CSV or XLSX export (`GET contacts/export` with optional `format=xlsx`), CSV template (`GET contacts/template`).

**Tables (tenant DB):** `contacts` includes optional `name`, `role`, consolidated `address`, `last_contacted_at`, JSONB `notes` (object, commonly `{ "text": "..." }`), plus existing structured address fields. `contact_interactions` replaces the former `activities` table (migration `2026_05_02_120000_crm_contact_interactions_and_contact_columns.php` migrates rows then drops `activities`). Model: `App\Models\Tenant\ContactInteraction`.

**Types:** canonical list in `App\Support\CrmContactType::VALUES` (includes buyer, seller, lender, surveyor, company, individual, legacy vendor or broker, etc.).

**Services:** `App\Services\Crm\ContactService` (CRUD, search filters, cache key `crm:contact:{tenantId}:{id}` for `findCached`), `InteractionService` (timeline, upcoming meeting or call or task by `occurred_at`), `ContactImportService`, `ContactExportService` (OpenSpout XLSX for Excel). Presenter: `App\Support\CrmContactPresenter`.

**Tenancy and route binding:** Tenant domain routes apply middleware `web` then `InitializeTenancyBySubdomain`. `SubstituteBindings` runs inside the `web` stack before tenancy switches the default connection, so tenant implicit model binding can query the wrong database. CRM controllers avoid implicit `Contact` / `ContactInteraction` injection and resolve IDs from the route inside controller actions.

**Tests:** `tests/Feature/Crm/CrmContactApiTest.php`, `CrmContactInteractionApiTest.php`, `CrmContactImportExportTest.php`, `tests/Unit/Crm/ContactServiceTest.php`.