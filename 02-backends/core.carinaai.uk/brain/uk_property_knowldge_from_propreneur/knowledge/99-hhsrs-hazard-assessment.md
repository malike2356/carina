# HHSRS hazard assessment module

Propreneur v2 implements the UK **Housing Health and Safety Rating System (HHSRS)** for private rented dwellings. Introduced by the Housing Act 2004, HHSRS lets local authorities assess health and safety risks from housing deficiencies. Landlords and agents use structured assessments to evidence condition before purchase, during management, or when defending enforcement.

**Routes:** `/hhsrs` (`tenant.hhsrs.*`) under the Multi Property module.

**Service:** `App\Services\Compliance\HhsrsService`.

**Models:** `HhsrsAssessment`, `HhsrsHazardRating`.

## The 29 hazard categories

Each assessment auto-creates one row per statutory hazard (`hhsrs_hazard_ratings.hazard_code`):

| Code | Display name |
|---|---|
| damp_mould_growth | Damp and mould growth |
| excess_cold | Excess cold |
| excess_heat | Excess heat |
| asbestos_mmmf | Asbestos and MMF |
| biocides | Biocides |
| carbon_monoxide_fuel | Carbon monoxide and fuel combustion products |
| lead | Lead |
| radiation | Radiation |
| uncombusted_fuel_gas | Uncombusted fuel gas |
| volatile_organic_compounds | Volatile organic compounds |
| crowding_space | Crowding and space |
| entry_by_intruders | Entry by intruders |
| lighting | Lighting |
| noise | Noise |
| domestic_hygiene_pests | Domestic hygiene, pests and refuse |
| food_safety | Food safety |
| personal_hygiene_water | Personal hygiene, sanitation and drainage |
| water_supply | Water supply |
| falls_on_level | Falls associated with baths etc. |
| falls_on_stairs | Falls on stairs |
| falls_between_levels | Falls between levels |
| electrical_hazards | Electrical hazards |
| fire | Fire |
| flames_hot_surfaces | Flames, hot surfaces etc. |
| collision_entrapment | Collision and entrapment |
| explosions | Explosions |
| position_operability_amenities | Position, operability and amenities |
| structural_collapse_falling | Structural collapse and falling elements |
| ergonomics | Ergonomics |

**UI grouping:** Physiological (10), Psychological (4), Infection (4), Safety Hazards (11).

## Scoring formula

For each hazard marked **present**, the assessor records:

- **Likelihood score (L):** 1 (very unlikely) to 5 (very likely)
- **Harm outcome score (H):** 1 to 4, mapped to statutory weightings:
  - 1 (Class I, extreme) -> weight **3000**
  - 2 (Class II) -> **300**
  - 3 (Class III) -> **30**
  - 4 (Class IV, moderate) -> **10**
- **Spread of harm (S):** percentage of occupiers who would suffer harm (0-100)

**Hazard score:**

```
hazard_score = L x harm_weight(H) x S / 100
```

Example: L=3, H=2 (weight 300), S=50 -> `3 x 300 x 50 / 100 = 450`.

`HhsrsHazardRating::computeHazardScore()` implements this. `HhsrsService::updateHazardRating()` persists score and category after each save.

## Category 1 vs Category 2

| Category | Threshold | Enforcement |
|---|---|---|
| **Category 1** | `hazard_score >= 1000` | **Mandatory** action by the local authority. Typical remedies: Improvement Notice, Prohibition Order, Emergency Remedial Action. Failure to comply can lead to prosecution and fines. |
| **Category 2** | Hazard **present** with score **0-999** (below Cat 1 threshold) | **Discretionary** action; authority may require works but is not obliged to enforce in every case. |
| **None** | Hazard not present, or present but scored below Cat 2 thresholds and treated as low risk | Record for audit; monitor at next review. |

`finaliseAssessment()` sets `overall_outcome`:

- `category_1_found` if any rating is `cat_1`
- else `category_2_found` if any `cat_2`
- else `satisfactory`

## Improvement Notices and council inspections

When a council inspection finds Category 1 hazards, it may:

1. Charge for the inspection (fee schedules vary by authority).
2. Issue an **Improvement Notice** requiring specified works within a deadline.
3. Escalate to a **Prohibition Order** (restrict occupation) if risks remain.

Propreneur records `remediation_required`, `remediation_deadline`, and `remediated_at` on each hazard rating for landlord remediation tracking. Link the formal report PDF via `report_document_id` on the assessment (`documents` table).

## HHSRS 2 reform context

The UK government has consulted on **HHSRS 2**, which may simplify hazard groupings, adjust weightings, and align enforcement with the Renters Rights Act era. Propreneur's 29-code model matches the current statutory list; when HHSRS 2 is enacted, migrate codes via a tenant migration and update `HhsrsHazardRating::hazardCodes()`. The regulation registry row `HHSRS` in `regulations` links compliance requirements to this framework.

## Carina help context

When users ask Carina about housing conditions, enforcement, or damp/fire risks:

- Explain Cat 1 vs Cat 2 using the score threshold (1000).
- Reference the 29 hazards by code and group (physiological, psychological, infection, safety).
- Remind that council **Improvement Notices** follow Cat 1 findings; discretionary action for Cat 2.
- Point to workspace routes: list `/hhsrs`, create assessment, rate hazards on show page, finalise when complete.
- Cross-link: fire safety (`/fire-risk-assessments`), tenancy compliance (`/tenancy-agreements`), regulation registry (`HHSRS` short code).

## Related files

- Migration: `database/migrations/tenant/2026_07_01_000007_create_hhsrs_assessments_table.php`
- Tests: `tests/Feature/Compliance/HhsrsTest.php`
- Knowledge: `94-compliance-audit-framework.md`, `96-tenancy-agreement-compliance.md`, `97-regulation-registry.md`
