# Rent review and Section 13 (RentReview model)

Propreneur v2 tracks **periodic tenancy rent increases** under Section 13 of the Housing Act 1988, contractual review clauses, and voluntary rent agreements.

## Legal basis: Section 13

Section 13 gives landlords the right to propose a new rent on **periodic** assured shorthold tenancies (AST) and assured tenancies where no other rent review mechanism applies.

Key rules:

| Tenancy | Minimum notice | Prescribed form |
|---|---|---|
| AST (monthly rent) | 1 month | Form 4 |
| Assured (non-AST) | 6 months | Form 4 |

The proposed rent takes effect on the date stated in the notice (`valid_from_date`) unless the tenant challenges by referring the case to the **First-tier Tribunal (Property Chamber)** before that date.

**Once per year:** on a periodic tenancy, rent can generally only be increased once in any 12-month period under Section 13.

## Routes and service

| Item | Location |
|---|---|
| UI | `/rent-reviews` (`tenant.rent-reviews.*`) |
| Service | `App\Services\Compliance\RentReviewService` |
| Model | `App\Models\Tenant\RentReview` |

Under the Multi Property module (same middleware group as tenancy agreements).

## Workflow statuses

| Status | Meaning |
|---|---|
| `draft` | Review prepared; notice not yet served |
| `notice_served` | Form 4 notice served; waiting for tenant response or valid-from date |
| `tenant_responded` | Tenant accepted, challenged, or recorded as no response |
| `tribunal_pending` | Tenant referred to First-tier Tribunal |
| `tribunal_determined` | Tribunal set market rent |
| `implemented` | Final rent applied; linked `TenancyAgreement.rent_pcm` updated |
| `withdrawn` | Review cancelled |

## Form 4 notice

The notice must use the prescribed **Form 4** wording (Housing Act 1988 s.13). Propreneur records:

- `notice_date`, `notice_period_days`, computed `valid_from_date`
- `form_used` (default: `Form 4 (Housing Act 1988 s.13)`)
- `delivery_method` and optional delivery confirmation

`RentReviewService::serveNotice()` sets status to `notice_served` and resets `tenant_response` to `pending`.

## Tenant challenge and tribunal

If the tenant disputes the proposed rent, they may refer the matter to the **First-tier Tribunal (Property Chamber)** before the effective date.

Propreneur tracks:

- `tenant_response` = `challenged`
- `tribunal_referred`, `tribunal_referred_date`, `tribunal_case_reference`
- `tribunal_hearing_date`, `tribunal_determined_rent_pcm`, `tribunal_effective_date`

`RentReview::canBeTribunalReferred()` is true when response is `challenged` and not yet referred.

The tribunal determines **market rent** for the property; the landlord must accept that determination.

## Implementing the increase

`RentReviewService::implementIncrease()` sets `final_agreed_rent_pcm` and `final_effective_date`, marks status `implemented`, and updates `TenancyAgreement.rent_pcm` when `tenancy_agreement_id` is linked.

Use tribunal-determined rent when applicable; otherwise use proposed rent if tenant accepted or did not respond in time (subject to legal advice).

## Renters Rights Act 2025 implications

The Renters Rights Act 2025 (RRA 2025) abolishes Section 21 no-fault eviction for new tenancies and strengthens tenant protections around rent:

- **Section 21 removed** for new ASTs after implementation; rent increases via Section 13 become the primary unilateral increase route on periodic tenancies without a contractual review clause.
- **Rent challenge cap:** tenants may challenge proposed rent via the First-tier Tribunal; under RRA reforms landlords should plan for **at most one Section 13 increase per 12 months** on periodic tenancies, and tribunal determination sets **market rent** (not above market for the property at hearing).
- **Challenge rights strengthened:** tenants retain clear routes to challenge excessive rent; landlords should expect scrutiny of market evidence (`justification` field).
- **Written tenancy agreement** and transparency obligations align with `TenancyAgreement` compliance flags; rent review history supports audit if a tenant alleges retaliatory or unfair increases.

Propreneur does not provide legal advice. Record facts, dates, and documents; seek solicitor review before serving Form 4 in borderline cases.

## Review types

| `review_type` | Use |
|---|---|
| `section_13` | Statutory periodic increase (Form 4) |
| `contractual` | Increase under a rent review clause in the tenancy agreement |
| `voluntary_agreement` | Agreed increase with tenant (no Form 4 required) |

## Carina context

When users ask Carina about rent increases, portfolio risk, or RRA 2025 rent caps:

- Link to active `RentReview` records for the property (`getPropertyRentHistory()`).
- Flag reviews where `isNoticeDeadlineSoon()` is true (valid from within 14 days, status `notice_served`).
- Remind that Section 13 applies to **periodic** tenancies; fixed-term increases may need contractual review or renewal negotiation instead.
- Cross-reference `TenancyAgreement` for tenancy type (AST vs assured), periodic flag, and current `rent_pcm`.
- Note RRA 2025: no Section 21 as alternative pressure; tribunal challenge is the tenant's primary statutory remedy against proposed Section 13 rent.

## Related modules

- `TenancyAgreement` (`/tenancy-agreements`): legal agreement record and current rent
- `PropertyTenancy`: occupancy dossier (separate from Section 13 compliance)
- Legal Notices module: formal notice drafting where integrated
- Knowledge: `96-tenancy-agreement-compliance.md`, `07-compliance.md`
