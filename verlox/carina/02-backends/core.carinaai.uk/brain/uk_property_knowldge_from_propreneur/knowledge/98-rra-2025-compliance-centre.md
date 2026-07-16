# RRA 2025 Compliance Centre (Propreneur module)

Tags: `rra_2025`, `compliance`, `decent_homes`, `prs_database`, `landlord_obligations`

## Propreneur module

Tenant route hub: **`/compliance/rra-2025`** (`tenant.compliance.rra2025.*`).

Tracks workspace-level PRS Database registration, ombudsman membership, per-property Decent Homes assessments, pre-tenancy payment compliance, and quarterly PRS reporting placeholders.

Related HMO operator guide: **`167-rra-2025-hmo-guide.md`** (Section 21, Section 8, Awaab's Law).

## PRS Database registration

Landlords letting residential property in England must register on the national **Private Rented Sector (PRS) Database** when the system goes live under the Renters' Rights Act 2025.

**Timeline (operational planning):**

- Legislation received Royal Assent July 2025
- Registration obligation applies when the **government PRS portal** opens (monitor gov.uk landlord guidance; Propreneur stores workspace status until live)
- Letting without registration when required will be a civil offence with penalties set in regulations
- Agents may register on behalf of landlords where permitted; record `registration_type` as `landlord` or `agent`

Propreneur workspace fields (`prs_registrations`):

- Registration type: `landlord` or `agent`
- Registration number and scheme name
- Registration and expiry dates
- Status: `pending`, `registered`, `expired`, `not_required`

One workspace-level record is maintained; update in place from the RRA 2025 hub.

## PRS Ombudsman membership

Landlords and letting agents must belong to an approved redress scheme (for example The Property Ombudsman or Property Redress Scheme).

Propreneur workspace fields (`prs_ombudsman_memberships`):

- Scheme name and membership number
- Joined and renewal dates
- Status: `active`, `expired`, `not_applicable`
- Annual fee (optional)

Renewal due within 30 days shows amber RAG on the hub.

## Decent Homes Standard (four criteria)

Each property requires a documented assessment against all four criteria. All four must pass for `meets_decent_homes_standard = true`.

### 1. No Category 1 HHSRS hazard (`criterion_non_decent_hazard`)

The property must not contain a Category 1 hazard under the Housing Health and Safety Rating System (HHSRS). Category 1 hazards are the most serious risks to health and safety (for example severe damp, dangerous stairs, excess cold).

### 2. Reasonable state of repair (`criterion_reasonable_state_of_repair`)

Key building elements (structure, roof, windows, doors, sanitary fittings, plumbing, electrics) must be in a reasonable state of repair without significant defects.

### 3. Reasonably modern facilities (`criterion_reasonably_modern_facilities`)

Kitchen should generally be less than 20 years old; bathroom less than 30 years old; adequate insulation and heating provision for the property type.

### 4. Thermal comfort (`criterion_thermal_comfort`)

Effective insulation and efficient heating so occupants can maintain thermal comfort without excessive cost or risk.

Assessments are stored in `decent_homes_assessments` with status `draft` or `finalised`. Failed criteria names are available via `getFailedCriteria()` on the model.

## Pre-tenancy payment compliance

RRA 2025 restricts charges before a tenancy starts.

Propreneur logs (`pre_tenancy_payment_logs`):

| Type | Meaning |
|------|---------|
| `holding_deposit` | Refundable holding deposit; capped at one week's rent |
| `rent_in_advance` | Permitted rent paid before start |
| `prohibited_payment` | Flagged breach; shown red on hub and payment index |

### Holding deposit cap formula

Maximum holding deposit = **one week's rent**.

If rent is quoted monthly:

```
weekly_rent = monthly_rent_pcm x 12 / 52
holding_deposit_cap = weekly_rent
is_within_cap = holding_deposit_amount <= holding_deposit_cap
```

Example: £950 PCM -> weekly rent = 950 x 12 / 52 = £219.23 (round to pence). A holding deposit of £219.23 or less passes; above fails.

### Prohibited payments (Tenant Fees Act 2019, retained under RRA era)

**Permitted payments** to tenants in England are essentially: rent, tenancy deposit (capped), holding deposit (capped), default fees (late rent, lost keys), variation/assignment fees (capped), and council tax / utilities where the tenancy agreement requires payment.

**Prohibited** (log as `prohibited_payment` if ever taken or requested):

- Letting fees, referencing fees charged to tenants, inventory check-in/check-out fees
- Admin fees, renewal fees, guarantor fees charged to tenants
- Charges for consent to assign or sub-let beyond statutory caps
- Most third-party service charges unless expressly permitted by statute

Prohibited payments must not be charged; log breaches for audit trail and red RAG on the hub.

## Written tenancy agreements

All assured tenancies require a written agreement. Track via **Tenancy Agreements** module (`tenancy_agreements.written_tenancy_agreement_signed`); see **`96-tenancy-agreement-compliance.md`**.

## No rent bidding above advertised rent

Landlords must not accept offers above the advertised rent. Operational policy; not a separate table in this module. Enforce via letting workflow and CRM notes.

## Quarterly PRS reporting

When the national PRS system is live, landlords may have quarterly reporting duties. Propreneur stores `rra_quarterly_reports` by `quarter_year` and `quarter_number` (1-4) with status `pending`, `submitted`, or `overdue`.

Use **Quarterly reports** under the RRA hub to flag the current quarter and record submission reference when filed.

## Carina context

Carina can summarise workspace RRA status via `RrA2025Service::getWorkspaceComplianceStatus()`:

- PRS registration RAG and ombudsman RAG
- Count of properties without finalised Decent Homes assessment or failing latest assessment
- Overdue quarterly reports
- Prohibited pre-tenancy payments

Suggested user prompts:

- "What is our RRA 2025 compliance status?"
- "Which properties fail Decent Homes?"
- "Are any holding deposits over the cap?"
- "Is our PRS ombudsman membership due for renewal?"

Hub URL for staff: `/compliance/rra-2025`.
