# Fire risk assessment (full FRA) - UK HMO

Tags: `hmo`, `fire_safety`, `compliance`, `fra`, `carina`

Builds on `166-hmo-fire-safety-carina.md` (routine logbook) and `158-nexio-fire-safety-and-awaabs-law.md`.

## Regulatory basis

- **Regulatory Reform (Fire Safety) Order 2005 (FSO):** the responsible person must carry out a suitable and sufficient fire risk assessment and keep it under review.
- **Fire Safety Act 2021:** external walls, balconies, and fire doors to flats are in scope for multi-occupied residential buildings.
- **HMO Management Regulations reg 4(2):** restrictions on cooking in bedrooms and related fire precautions for licensable HMOs.

## FRA types (PAS 79 style)

| Type | Scope |
|------|--------|
| Type 1 | Non-destructive, common areas and tenant areas with consent (default in Nexio) |
| Type 2 | Type 1 plus destructive samples (e.g. linings behind hatches) |
| Type 3 | Type 2 plus individual dwellings (non-destructive inside flats) |
| Type 4 | Type 3 plus destructive inspection inside dwellings |

Record `assessment_type` on each `fire_risk_assessments` row. Type 1 is appropriate for most operator-led annual reviews; Types 3-4 need competent assessors and tenant access.

## Responsible person (FSO Article 3)

**Regulatory Reform (Fire Safety) Order 2005, Article 3** defines the responsible person as the person who has control of the premises (or part) as occupier, or otherwise has control of the maintenance, repair, or safety of the premises.

The responsible person (usually the landlord, manager, or agent with control of the premises) must:

- Carry out a suitable and sufficient **fire risk assessment**
- Take general fire precautions to ensure safety of relevant persons
- Maintain fire safety measures (alarms, doors, lighting, escape routes)
- Review the FRA when material changes occur (not only on a calendar)

Propreneur stores `responsible_person_name`, `responsible_person_role`, and optional `responsible_person_user_id` (workspace user) on each assessment.

## Fire door standards (FD30S)

Bedroom and protected-route doors in HMOs should be **FD30S** (30 minutes fire resistance, smoke-sealed) and **self-closing**. Routine `fire_door_inspection` logs (quarterly) complement the full FRA. Defect type `doors` covers failed closers, damaged seals, or non-compliant doors.

## Evacuation strategies

Record `evacuation_strategy` on each FRA:

| Strategy | When used |
|---|---|
| `simultaneous` | All occupants evacuate immediately on alarm (typical small HMO, single staircase) |
| `stay_put` | Defend in place in higher-risk blocks where compartmentation supports it (uncommon in small HMOs) |
| `phased` | Staged evacuation by floor or zone (larger or mixed-use buildings) |

HMO operators should align strategy with the FRA and signage; simultaneous evacuation is the default for most licensed HMO houses.

## Review frequency by property type

| Property type | Typical FRA review |
|---|---|
| Small HMO (house share) | **Annually** (Type 1); sooner after material change or enforcement |
| Large HMO / bedsit block | **Annually** minimum; competent assessor; may need Type 3/4 for dwellings |
| Single dwelling (common parts only) | **Annually** for common parts; review after void works or fire incident |
| After material alteration | **Immediate** review (layout, cladding, new cooking facilities) |

Set `review_frequency_months` and `next_review_date` on each `fire_risk_assessments` row. `isReviewDue()` flags review within 30 days or overdue.

## Cooking restriction in HMOs

`property_fire_safety_configs` flags:

- `cooking_in_bedrooms_restricted` - policy that tenants must not cook in bedrooms
- `cooking_restriction_enforced` - evidence the policy is actively enforced (signage, inspections, tenancy terms)
- `bedroom_door_self_closing` - bedroom doors are self-closing (fire compartmentation)

Defect type `materials` covers unsuitable linings, combustible storage, or breach of cooking restrictions found during inspection.

## Defect severity and remediation

| Severity | Typical use |
|----------|-------------|
| low | Minor maintenance, no immediate life risk |
| medium | Repair within planned works, monitor |
| high | Address within days; may affect escape or detection |
| critical | Immediate action; may require restriction of use |

Statuses: `open`, `in_progress`, `remediated`, `accepted_risk`. Open defects (not `remediated`) appear on the FRA index and property fire-safety panel.

## Nexio data model

| Table | Purpose |
|-------|---------|
| `fire_risk_assessments` | Full FRA record, review dates, outcome, responsible person |
| `fire_safety_defects` | Defects linked to property and optional FRA |
| `property_fire_safety_configs` | HMO materials / AOV / sprinkler flags per property |
| `fire_safety_logs.fire_risk_assessment_id` | Links routine tests to active FRA when finalised |

Service: `App\Services\Compliance\FireRiskAssessmentService`

Routes: `tenant.fire-risk-assessments.*` under `/fire-risk-assessments`

Property logbook: `tenant.properties.fire-safety.index` includes FRA summary panel.

## Review RAG

- **Red:** `next_review_date` in the past, or outcome `urgent_action`
- **Amber:** review due within 30 days, or outcome `requires_action`
- **Green:** otherwise

`isReviewDue()` is true when `next_review_date` is within 30 days or already past.

## Carina context

When answering fire safety questions for an HMO:

1. Distinguish **routine logs** (`fire_safety_logs`: weekly alarm, doors, lighting) from the **full FRA** (`fire_risk_assessments`).
2. Cite responsible person and next review date from the latest finalised FRA.
3. List open defects by severity and `target_remediation_date`.
4. Mention cooking restriction flags from `property_fire_safety_configs` when advising on Management Regulations compliance.
5. Recommend Type 1 annual review minimum; escalate to competent external assessor after material alterations or enforcement notice.

Related: `166-hmo-fire-safety-carina.md`, `get_fire_log_status` tool (routine logs only).
