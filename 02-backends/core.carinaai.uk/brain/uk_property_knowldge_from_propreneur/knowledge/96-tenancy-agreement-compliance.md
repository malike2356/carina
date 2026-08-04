# Tenancy agreement compliance (TenancyAgreement model)

Propreneur v2 tracks **legal compliance lifecycle** of a tenancy agreement separately from day-to-day **occupancy** records.

## Distinction from PropertyTenancy

| Concern | Model | Purpose |
|---|---|---|
| Occupancy and dossier | `PropertyTenancy` | Who lives in the property or room, rent payments, photos, ID, referencing, dossier documents |
| Legal agreement compliance | `TenancyAgreement` | AST terms, deposit protection deadlines, Section 8 / legacy Section 21 history, RRA 2025 obligations |

A `TenancyAgreement` may optionally link to a `PropertyTenancy` via `property_tenancy_id` when both records exist for the same let. Do not merge these models; occupancy workflows stay on `PropertyTenancy`.

**Routes:** `/tenancy-agreements` (`tenant.tenancy-agreements.*`) under the Multi Property module.

**Service:** `App\Services\Compliance\TenancyAgreementService`.

## Deposit protection (30-day rule)

When a deposit is taken on an assured shorthold tenancy:

1. Protect the deposit in one of the three **approved tenancy deposit schemes** in England and Wales:
   - **Deposit Protection Service (DPS)** - custodial or insured
   - **MyDeposits** - custodial or insured
   - **Tenancy Deposit Scheme (TDS)** - custodial or insured
2. Serve **prescribed information** to the tenant (scheme leaflet, deposit amount, property address, landlord contact).
3. Complete protection and prescribed information within **30 calendar days** of receipt (deadline computed from `lease_start_date` when creating an agreement with a deposit amount).

Failure within 30 days restricts valid Section 21 (where still applicable) and exposes the landlord to deposit penalty claims.

`TenancyAgreementService::create()` auto-sets `deposit_protection_deadline` to lease start + 30 days when `deposit_amount` is present.

**RAG:** deposit status shows **red** when `isDepositProtectionOverdue()` is true (deposit set, no certificate number, today past deadline).

**Alerts:** `getDepositProtectionAlerts()` lists active agreements with unprotected deposits where the deadline is within 14 days or already passed.

## Section 21 history and RRA 2025 abolition timeline

**Section 21** (Housing Act 1988) allowed no-fault possession on assured shorthold tenancies when prescribed steps were met.

**Renters Rights Act 2025 timeline (England):**

- Royal Assent: July 2025
- Staged implementation from **2025-2026**; product default treats **May 2026** as the cut-off for new ASTs where Section 21 cannot be used for new agreements
- **New assured tenancies** after implementation: Section 21 abolished; possession relies on **Section 8** grounds or mutual surrender
- **Existing tenancies** at implementation: transitional rules may preserve limited Section 21 rights until the tenancy ends or converts; record historical `section_21_served_date` on legacy agreements for audit only

Propreneur does not serve notices; it records dates and flags for portfolio compliance.

## Renters Rights Act 2025 context

The Renters Rights Act 2025 changes possession routes for new tenancies:

- **Section 21 (no-fault eviction)** is abolished for new ASTs after implementation; legacy tenancies may still have historical Section 21 records.
- Landlords must provide a **written tenancy agreement** (`written_tenancy_agreement_signed`).
- **Prescribed information** and **information sheet** obligations replace some legacy deposit paperwork patterns.
- **Ground 1A** (landlord occupation or sale) becomes a mandatory possession route under the new regime; use the Legal Notices module for drafting.

`TenancyAgreement` stores compliance flags and notice dates for audit; draft and issue formal notices via `LegalNotice` / `LegalNoticeService`.

## Section 8 grounds (overview)

Section 8 notices require specified grounds under Schedule 2 Housing Act 1988. Common grounds stored on agreements as comma-separated numbers in `section_8_grounds`:

| Ground | Typical use |
|---|---|
| 8 | At least two months rent arrears at notice and hearing (mandatory if conditions met) |
| 10 | Some rent arrears (discretionary) |
| 11 | Persistent late payment (discretionary) |
| 14 | Anti-social behaviour, nuisance, or criminal activity (discretionary; often 2 weeks' notice) |
| 1A (RRA 2025) | Landlord or family occupation, or sale (mandatory route post-RRA) |

Ground selection depends on facts, notice period, and whether the tenancy is pre- or post-RRA. Propreneur records served dates for compliance tracking; legal review is required before court.

## Right to rent obligations

Before granting a residential tenancy in England, landlords must conduct right to rent checks on all adult occupiers:

- Verify acceptable documents or Home Office share code.
- Record check date (`right_to_rent_checked_date`) and boolean `right_to_rent_checked`.
- Repeat checks for time-limited permission before expiry.

`getRightToRentAlerts()` returns active agreements where `right_to_rent_checked` is false.

Occupancy-level R2R detail (document type, share code, recheck dates) remains on `PropertyTenancy` and `RightToRentService`; the agreement record is the compliance summary for portfolio reporting.

## Status lifecycle

| Status | Meaning |
|---|---|
| `active` | Current agreement |
| `notice_given` | Section 21 or Section 8 served |
| `ended` | Tenancy ended (`end_date`, `end_reason`) |
| `surrendered` | Mutual surrender without court |

## RAG summary on agreements

| Colour | Triggers |
|---|---|
| Red | Section 21 served (legacy tracking) or deposit protection overdue |
| Amber | Periodic tenancy, or break clause within 60 days |
| Green | Otherwise |

## Carina help phrases

When users ask Carina about tenancy compliance:

- "Is the deposit protected in time?" - check `deposit_protection_deadline` and certificate number on `TenancyAgreement`.
- "Which scheme protects this deposit?" - DPS, MyDeposits, or TDS must be named in records; prescribed info served within 30 days.
- "Can we use Section 21?" - only for legacy ASTs before RRA cut-off; new tenancies use Section 8 or Ground 1A.
- "What Section 8 ground applies?" - Ground 8 for two months arrears, Ground 10 for some arrears, Ground 14 for ASB; facts must match the ground.
- "Has right to rent been checked?" - use `getRightToRentAlerts()` and occupancy dossier on `PropertyTenancy`.

## Related modules

- **Legal notices:** `/legal/notices` for drafting Section 8, Ground 1A, Section 13, prescribed info.
- **Property tenancy dossier:** `/properties/tenancies/{id}` for occupancy, payments, documents.
- **Compliance vault:** property-level certificates (gas, EPC, EICR) via `ComplianceItem`.
- **Rent reviews:** `104-rent-review-section-13.md`
- **RRA hub:** `98-rra-2025-compliance-centre.md`
