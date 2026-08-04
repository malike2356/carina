# Property inspection and evidence management

**Last updated:** 2026-06-05

## Overview

Structured property inspections cover all rooms and areas, with defect tracking and a legal-grade evidence log for enforcement defence. Distinct from **CommunalAreaInspection** (per-visit communal area checks only).

**Routes:** `tenant.inspections.*`, `tenant.tenant-notices.*`  
**Controllers:** `PropertyInspectionController`, `TenantNoticeLogController`  
**Service:** `PropertyInspectionService`  
**Models:** `PropertyInspection`, `InspectionRoomRecord`, `InspectionDefect`, `TenantNoticeLog`

## Inspection types

| Type | Typical use |
|------|-------------|
| `routine` | Periodic landlord inspection |
| `move_in` | Check-in inventory and condition baseline |
| `move_out` | End-of-tenancy dilapidations evidence |
| `pre_void` | Before reletting or works |
| `post_remediation` | Verify works completed |
| `council_triggered` | HHSRS or local authority visit follow-up |
| `insurance` | Claim or policy compliance visit |
| `compliance` | Regulatory or licence condition audit |

## Condition ratings

- **good:** No material issues; fit for intended use
- **fair:** Minor wear; monitor at next visit
- **poor:** Repair needed within reasonable timeframe
- **urgent:** Immediate risk to health, safety, or security

Exterior and communal areas use good / fair / poor only. Overall rating may be urgent when aggregate risk is high.

## Defect severity and expected response times

| Severity | Meaning | Expected response |
|----------|---------|-------------------|
| `urgent` | Immediate risk to health, safety, or security | **24 hours** (Awaab's Law 24h response where qualifying hazard) |
| `major` | Significant habitability or compliance risk | **7 days** to start remediation; document interim measures |
| `moderate` | Functional impact; worsening if ignored | **28 days** target resolution |
| `minor` | Cosmetic or low impact | **Next planned maintenance** cycle or scheduled inspection |

Operational targets support portfolio RAG; statutory deadlines (e.g. Awaab's 14-day repair) may be shorter for specific hazards.

Defect categories include damp_mould, structural, plumbing, electrical, fire_safety, security, heating, windows_doors, fixtures, pest, general.

Statuses: `open`, `works_ordered`, `resolved`, `landlord_accepted`.

## Evidence for enforcement defence

### Photo evidence best practice

Record **photo_evidence_notes** on every material defect:

- **Timestamp** visible (device setting or dated board in frame)
- **Label location** (room name, elevation, asset tag)
- **Before and after** pairs when remediation completes
- Consistent angle for deposit disputes (same corner reference as check-in)

Link `document_id` to Document Vault where PDFs or image bundles are stored.

A completed inspection with room records, dated defects, and resolution notes supports:

- HHSRS / damp and mould responses
- Deposit dispute adjudication (check-in vs check-out)
- Section 8 rent arrears or breach of tenancy (condition at service of notice)
- Insurance claims (pre-loss condition)

**CommunalAreaInspection** remains the lightweight log for stairwells and shared parts on a visit-by-visit basis. **PropertyInspection** is the full property-wide record.

## Tenant notice log

Statutory and contractual notices served to tenants must be logged with delivery proof.

| Notice type | Notes |
|-------------|-------|
| `section_13` | Rent increase (assured periodic tenancy) |
| `section_21` | No-fault possession (England); validity depends on form, deposit, EPC, etc. |
| `section_8` | Fault-based possession; grounds in notice |
| `repair_notice` | Tenant or council repair obligation |
| `entry_notice` | Right of access (typically 24 hours) |
| `deposit_prescribed_info` | Prescribed information within 30 days |
| `rent_increase_notice` | Non-S13 increases where applicable |
| `inspection_notice` | Access for inspection |
| `other` | Licence conditions, HMO management notices, etc. |

### Delivery methods and validity

| Method | When valid |
|--------|------------|
| `hand_delivered` | To tenant at property; note date and witness if disputed |
| `post_1st_class` | Allow service periods per notice rules |
| `post_recorded` | Proof of posting and delivery; preferred for possession notices |
| `email_agreed` | Only if tenancy agrees email as notice channel |
| `personal_service` | Process server or court officer |

**Deemed service:** for **recorded post**, the notice is often deemed served **2 calendar days** after posting (unless proven otherwise). Propreneur stores actual `delivery_date`; Carina should remind users to add 2 days when calculating appeal deadlines for recorded delivery.

Set `delivery_confirmed` and `delivery_date` when proof exists. Use `delivery_evidence_notes` for tracking numbers, signatures, or email read receipts. Attach notice PDF via `document_id`.

## Service queries

- `getPropertiesWithUrgentDefects()` - portfolio properties with open urgent defects
- `getOverdueInspections()` - scheduled but past `scheduled_date`, not completed
- `getInspectionSchedule($withinDays)` - upcoming scheduled inspections

## Carina context

When users ask about inspections, defects, or notices, Carina should:

1. Distinguish communal area inspections from full property inspections
2. Recommend logging defects with photo evidence notes and dates
3. Remind that Section 21 and Section 8 validity depends on prescribed forms, deposit protection, EPC, and correct service (not just logging in Propreneur)
4. Suggest linking works orders when `requires_works_order` is set on a defect
5. Reference `tenant.inspections.index` and `tenant.tenant-notices.index` for workspace navigation

Related: `96-tenancy-agreement-compliance.md`, `07-compliance.md`, communal inspections in HMO compliance knowledge.
