# Asbestos and water safety (Legionella)

**Last updated:** 2026-06-05

## Purpose

UK landlords and managing agents must manage asbestos in non-domestic and shared parts of dwellings (Control of Asbestos Regulations 2012) and control legionella risk in water systems (HSE Approved Code of Practice L8, COSHH). Propreneur tracks asbestos registers, material locations, legionella risk assessments, and water hygiene monitoring logs per property.

**Service:** `App\Services\Compliance\AsbestosWaterSafetyService`

**Models:** `AsbestosRegister`, `AsbestosMaterial`, `LegionellaAssessment`, `WaterHygieneLog`

**Tables:** `asbestos_registers`, `asbestos_materials`, `legionella_assessments`, `water_hygiene_logs`

Compliance dashboard snapshot key: `asbestos_water` (overdue registers and assessments).

## Asbestos: duty to manage (CAR 2012)

The **dutyholder** (usually the landlord or person with control of maintenance) must:

1. Take reasonable steps to find asbestos-containing materials (ACMs) and assess their condition
2. Presume materials contain asbestos unless strong evidence shows otherwise
3. Keep an up-to-date record of ACM location and condition
4. Assess risk and implement a management plan
5. Provide information to anyone liable to disturb ACMs (contractors, staff)

Pre-2000 buildings are higher risk; Propreneur flags properties without a register when `year_built < 2000`, or HMO/commercial/strategy-hmo when year built is unknown.

## Survey types (when each applies)

| Type key | Name | When to use |
|---|---|---|
| `management` | Management survey | **Occupied properties**; locate ACMs that could be disturbed during normal occupation, maintenance, or installation |
| `refurbishment_demolition` | Refurbishment / demolition survey | **Before structural work**, refurbishment, or demolition; fully locates ACMs in scope of works |
| `presumptive` | Presumptive survey | **Limited access**; assumes ACM in typical locations until full survey possible |

Record `survey_type`, surveyor details, `survey_date`, `report_document_id`, and `next_review_date` on `asbestos_registers`. Set `no_acm_found = true` when the competent surveyor confirms no ACM.

## Material condition and action matrix

Each `asbestos_materials` row records location, `material_type`, `asbestos_type` (chrysotile, amosite, crocidolite, unknown), `condition`, `risk_score`, and `management_action`.

| Condition | Risk | Typical management action |
|---|---|---|
| `good` | low | `leave_in_place` or `monitor` |
| `fair` | low / medium | `monitor`; review at next register review |
| `poor` | medium / high | `seal` (encapsulate) or plan `remove` |
| `damaged` | high | Urgent `remove` or isolate; restrict access until remediated |

`needsAction()` is true when condition is `poor` or `damaged`. `hasHighRiskMaterials()` on the register drives amber RAG.

Register RAG:

- **Red:** `next_review_date` in the past
- **Amber:** review due within 30 days or any high-risk material
- **Green:** otherwise

## Legionella: HSE L8 ACoP summary

Landlords must:

- Identify and assess sources of risk (storage tanks, dead legs, showers, infrequent use)
- Implement control measures (temperature regime, flushing, descaling)
- Monitor and keep records
- Review the assessment when circumstances change

Propreneur stores `legionella_assessments` with `supply_type`, tank and dead-leg flags, shower count, `property_occupancy_pattern` (`continuous`, `seasonal`, `intermittent`), `risk_level`, `control_measures_required`, `monitoring_frequency`, and `next_review_date` (default +1 year from assessment date on create).

## Temperature control targets

Recorded on `water_hygiene_logs` with `log_type = temperature_check`. Service auto-flags pass/fail:

| Reading | Target | Measurement rule |
|---|---|---|
| Hot water at outlet | **>= 55C** | Within **1 minute** of running the tap |
| Cold water at outlet | **<= 20C** | Within **2 minutes** of running the tap |
| Hot water storage | **>= 60C** | Cylinder / calorifier store (log via tank inspection notes) |

`hot_within_target` and `cold_within_target` are set when logging temperatures. `getFailingWaterTemperatures()` lists checks outside target in the last 90 days.

## Monitoring frequencies by risk level

| Risk level | Typical monitoring |
|---|---|
| Low | Annual legionella review; quarterly temperature checks on representative outlets |
| Medium | Six-monthly review; quarterly temperatures; showerhead descale every 3 months |
| High | Quarterly review; monthly temperatures on all outlets; weekly dead-leg flush if intermittently occupied |

Align `monitoring_frequency` on the assessment with actual `water_hygiene_logs` cadence.

## Routine water hygiene tasks

| Log type | Schedule |
|---|---|
| `temperature_check` | Quarterly minimum for rented stock; more often if high risk |
| `showerhead_descale` | **Every 3 months** where showers present |
| `dead_leg_flush` | **Weekly** if property **intermittently occupied** or void between lets |
| `tank_clean` / `tank_inspection` | Per risk assessment and L8 guidance when storage tanks exist |

`getWaterHygieneSchedule()` lists properties with a legionella assessment but no temperature check in the expected window.

## Overdue and portfolio queries

- `getRegistersOverdue()` - asbestos register past `next_review_date`
- `getAssessmentsOverdue()` - legionella assessment past `next_review_date`
- `getPropertiesMissingAsbestosRegister()` - pre-2000 or HMO-type properties with no register

Link survey PDFs and photos via `report_document_id` and `photo_document_id` in the document vault.

## Carina help context

When users ask about asbestos surveys, legionella, or water temperatures:

- Distinguish **asbestos register** (building fabric) from **legionella assessment** (water systems).
- For pre-2000 properties, recommend a management survey if no register exists.
- Cite L8 targets: hot >= 55C at outlet (1 min), cold <= 20C (2 min), storage >= 60C.
- Remind operators to log shower descaling every 3 months and weekly flushing for void or intermittent lets.
- Point to failing temperature logs and overdue review dates from `AsbestosWaterSafetyService`.
- Cross-link HHSRS hazard `asbestos_mmmf` (`99-hhsrs-hazard-assessment.md`) and regulation `LEGIONELLA_2002` (`97-regulation-registry.md`).

Propreneur records operational compliance; licensed asbestos surveyors and water hygiene contractors should carry out physical works.

## Related knowledge

- `99-hhsrs-hazard-assessment.md` - asbestos_mmmf hazard scoring
- `97-regulation-registry.md` - LEGIONELLA_2002 seed row
- `07-compliance.md` - compliance hub overview
- `100-fire-risk-assessment-full.md` - separate fire risk regime
