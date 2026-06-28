# Regulation Registry

**Last updated:** 2026-07-01 (prompt 4 - v1 parity gap)

## Purpose

The regulation registry is the tenant-scoped source of truth for UK property legislation and statutory guidance. Each row represents a named regulation (Act, statutory instrument, or recognised framework such as HHSRS) with category, reference metadata, effective and review dates, and an official source URL.

Workspace **compliance requirements** (`compliance_requirements`) can optionally link to a regulation via `regulation_id`. That link tells staff and Carina which legal basis applies when logging checks, building starter checklists, or explaining obligations on a property or deal.

Regulations are **archived** (`is_active = false`), not deleted, so historical requirement links stay intact.

## Canonical UK regulations (seeded)

The tenant migration `2026_07_01_000004_create_regulations_table.php` seeds twelve canonical entries:

| Short code | Name | Category |
|---|---|---|
| HPA_2016 | Housing & Planning Act 2016 | planning |
| RRA_2025 | Renters Rights Act 2025 | tenancy |
| HHSRS | Housing Health & Safety Rating System | general |
| HMO_MGT_2006 | HMO Management Regulations 2006 | hmo |
| GAS_SAFETY_1998 | Gas Safety (Installation and Use) Regulations 1998 | gas_safety |
| EICR_2020 | Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020 | electrical |
| FIRE_SAFETY_2005 | Regulatory Reform (Fire Safety) Order 2005 | fire_safety |
| LEGIONELLA_2002 | Legionella (Control of Substances Hazardous to Health) Regulations 2002 | general |
| DEREGULATION_2015 | Deregulation Act 2015 | tenancy |
| PFEA_1977 | Protection from Eviction Act 1977 | tenancy |
| TFA_2019 | Tenant Fees Act 2019 | tenancy |
| EPB_2012 | Energy Performance of Buildings Regulations 2012 | general |

Tenants may add custom regulations through the GUI; seeded rows are not overwritten on later migrations.

### Key obligations summary (operational)

| Short code | Key obligations for property managers |
|---|---|
| HPA_2016 | Civil penalties up to £30,000 per offence; banning orders; rent repayment order framework; rogue landlord database |
| RRA_2025 | Abolition of Section 21 for new tenancies; PRS Database registration; ombudsman membership; Decent Homes; holding deposit cap; written tenancy |
| HHSRS | 29 hazards assessed; Category 1 mandatory enforcement; Category 2 discretionary |
| HMO_MGT_2006 | Maintain fixtures, fire precautions, refuse, supply tenant information; no cooking in bedrooms without safeguards |
| GAS_SAFETY_1998 | Annual gas safety check by Gas Safe engineer; copy of CP12 to tenants within 28 days |
| EICR_2020 | Five-yearly EICR for private rented dwellings in England; remediate C1/C2/further investigation codes |
| FIRE_SAFETY_2005 | Suitable fire risk assessment; responsible person; maintain alarms, doors, escape routes |
| LEGIONELLA_2002 | Risk assessment and control of water systems; temperature monitoring; records (L8 ACoP) |
| DEREGULATION_2015 | Section 21 validity conditions (retaliatory eviction defence); prescribed forms |
| PFEA_1977 | Unlawful eviction and harassment are criminal; proper court process for possession |
| TFA_2019 | Prohibited tenant fees; holding deposit cap one week's rent; permitted payments list only |
| EPB_2012 | Valid EPC before marketing; minimum EPC standards for letting where applicable |

## Data model

**Table:** `regulations` (tenant DB)

**Model:** `App\Models\Tenant\Regulation`

Key fields: `name`, `short_code` (unique, nullable), `category`, `description`, `source_url`, `reference_number`, `effective_date`, `review_date`, `is_active`, `created_by_user_id`.

**Helper methods:**

- `isEffective()` - active and effective date is null or in the past
- `isExpired()` - review date is in the past
- `scopeActive()` - query scope for active rows
- `categoryLabel()` - human-readable category name
- `requirements()` - hasMany `ComplianceRequirement`

**ComplianceRequirement link:**

- Column: `compliance_requirements.regulation_id` (nullable FK, `nullOnDelete`)
- Relationship: `ComplianceRequirement::regulation()` belongsTo `Regulation`

## Service and routes

**Service:** `App\Services\Compliance\RegulationService`

- `all()` - active regulations ordered by category then name
- `byCategory(string $category)` - active regulations in one category
- `createRegulation(array $data)` - create row
- `getRequirementsFor(Regulation $regulation)` - linked requirements

**Controller:** `App\Http\Controllers\Tenant\Compliance\RegulationController`

**Routes:** `tenant.compliance.regulations.*` under `/compliance/regulations`

| Route | Action |
|---|---|
| GET `/compliance/regulations` | Index (grouped by category) |
| GET `/compliance/regulations/create` | Create form |
| POST `/compliance/regulations` | Store |
| GET `/compliance/regulations/{regulation}` | Show detail + linked requirements |
| GET `/compliance/regulations/{regulation}/edit` | Edit form |
| PUT `/compliance/regulations/{regulation}` | Update |
| POST `/compliance/regulations/{regulation}/archive` | Set `is_active = false` |

**Feature flag:** `compliance` (`BillingModule::Compliance`), same middleware group as other compliance routes.

## Carina context

When Carina answers compliance questions, baseline context can include:

- Active regulations by category (`RegulationService::all()` or `byCategory()`)
- Whether a workspace requirement names a linked regulation (`ComplianceRequirement` with `regulation` eager-loaded)
- Effective and review dates for expiry-style prompts (`isEffective()`, `isExpired()`)

Carina should cite the regulation **name** and **short_code** when explaining legal obligations, and point users to the regulation show page or official `source_url` for full text. Do not treat registry descriptions as legal advice; they are operational summaries for property managers.

Related knowledge: `07-compliance.md`, `117-compliance-deep.md`, `91-uk-property-compliance-and-hmrc.md`.

## Tests

`tests/Feature/Compliance/RegulationTest.php` covers create, archive, requirement linking, and canonical seed count.
