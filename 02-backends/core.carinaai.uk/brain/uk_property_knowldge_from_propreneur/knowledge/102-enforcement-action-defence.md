# Enforcement Action Defence Centre

**Last updated:** 2026-07-01 (prompt 10)

## Purpose

The Enforcement Action Defence Centre helps UK landlords track, manage, and defend against council and tribunal enforcement. Financial exposure can reach **£30,000 per offence** under the Housing & Planning Act 2016 civil penalty regime, and **up to 12 months' rent** under Rent Repayment Orders (RROs).

Routes: `tenant.compliance.enforcement.*` under `/compliance/enforcement`.

## Notice types and legal basis

| Type key | Label | Legal basis |
|---|---|---|
| `improvement_notice` | Improvement Notice | Housing Act 2004 ss.11-12: council requires remediation of a Category 1 or 2 HHSRS hazard |
| `prohibition_order` | Prohibition Order | Housing Act 2004 s.20: prohibits use of all or part of the dwelling |
| `emergency_prohibition_order` | Emergency Prohibition Order | Housing Act 2004 s.40: immediate prohibition where imminent risk of serious harm |
| `hazard_awareness_notice` | Hazard Awareness Notice | Housing Act 2004 s.28: advisory only; no legal obligation to act |
| `housing_financial_penalty` | Housing Financial Penalty | Housing & Planning Act 2016 s.126: civil penalty for specified housing offences |
| `rent_repayment_order` | Rent Repayment Order | Housing & Planning Act 2016 ss.40-41: tenant application to First-tier Tribunal |
| `banning_order_application` | Banning Order Application | Housing & Planning Act 2016 s.14: application to ban landlord or agent from letting |
| `planning_enforcement_notice` | Planning Enforcement Notice | Town and Country Planning Act 1990: breach of planning control (e.g. unauthorised HMO) |
| `overcrowding_notice` | Overcrowding Notice | Housing Act 1985: notice of excessive occupation |

**Improvement and prohibition notices:** Landlord typically has **21 days** to appeal to the First-tier Tribunal (Property Chamber) after service. Failure to comply with an improvement notice is a criminal offence.

## Housing financial penalty structure (HPA 2016)

**Representations process timeline:**

1. **Notice of intent** (`notice_of_intent`): council sets out intended penalty amount and facts; landlord has **28 days** to make written representations.
2. **Representations** (`representations_pending`): landlord submits evidence and arguments; council must consider them before issuing a final notice.
3. **Final notice** (`final_notice`): penalty amount confirmed; payment due; landlord has **28 days** to appeal to the First-tier Tribunal.
4. **Appeal** (`appealed`): tribunal reviews lawfulness and amount.
5. **Paid** (`paid`) or **Overturned** (`overturned`): resolved.

Improvement and prohibition notices: typically **21 days** to appeal to the tribunal from service date.

Maximum penalty per offence: **£30,000** (England). Penalties are civil, not criminal, but non-payment can lead to recovery action.

**Evidence to retain:** gas safety records, EICR certificates, HMO licence copies, tenant correspondence, remediation invoices, photographs with timestamps, council inspection reports.

## Rent Repayment Order (RRO) eligibility

A tenant (or local authority on behalf of a tenant) may apply to the First-tier Tribunal for an RRO where the landlord has committed a **rent-related offence**, including:

- Letting an unlicensed HMO (mandatory licensing areas)
- Breach of HMO management regulations
- Failure to comply with improvement or prohibition notices
- Illegal eviction or harassment
- Certain offences under the Housing & Planning Act 2016

**Maximum recovery:** up to **12 months' rent** repaid to the applicant. Multiple tenants in the same property may each claim.

**RRO eligibility triggers** (rent-related offences and related conduct):

- Operating an **unlicensed HMO** where a licence is required
- **Breach of banning order** (letting while banned)
- **Failure to comply** with an improvement notice or prohibition order
- **Breach of selective licensing** in a designated area
- Using **violence** to secure entry
- **Withdrawing services** (utilities, access) in harassment scenarios
- Deposit not protected, illegal fees, HHSRS Category 1, overcrowding, unauthorised HMO use (tracked as risk factors)

**Risk factors in Propreneur** (`rent_repayment_risks.risk_factors` JSONB): `unlicensed_hmo`, `rra_breach`, `deposit_unprotected`, `illegal_fees`, `retaliatory_eviction`, `hhsrs_category_1`, `no_gas_safety`, `no_eicr`, `overcrowding`, `unauthorised_hmo`

## Evidence and council communication

**Inspect and record everything:** contemporaneous photographs (timestamp visible), gas/EICR/EPC certificates, licence copies, tenant correspondence, contractor invoices, inspection reports, and meter readings. Link files to Document Vault and enforcement notice rows.

**Council communication strategy:**

- Log every call, email, letter, and visit in `council_communication_logs` with officer name and outcome
- Respond in writing; keep factual and professional
- Do **not** make admissions that create criminal exposure; seek housing solicitor advice before agreeing fault or paying penalties
- Request inspection reports and photographs the council relied upon (subject access / FOI where appropriate)

## Tribunal process

**Forum:** First-tier Tribunal (Property Chamber) for RROs, penalty appeals, and improvement/prohibition order appeals.

**Typical stages:**

1. Application or appeal lodged (`tribunal_cases.lodged_date`)
2. Case management directions
3. Hearing (`hearing_date`); `TribunalCase::isHearingDue()` flags hearings within 14 days
4. Decision (`outcome`: upheld, partially_upheld, dismissed, withdrawn)

Record legal representation, estimated and actual costs on each `tribunal_cases` row.

## Council communication log

Every contact with the council (`council_communication_logs`) should record:

- Date and time (`contact_date`)
- Type: call, email, letter, visit, portal_message
- Direction: inbound or outbound
- Officer name and organisation
- Summary and outcome
- Whether a professional adviser was present (`professional_present`)

This audit trail is critical for tribunal defence and demonstrating reasonable steps taken.

## Data model summary

| Table | Model | Purpose |
|---|---|---|
| `enforcement_notices` | `Enforcement\EnforcementNotice` | All notice types and appeal status |
| `housing_financial_penalties` | `Enforcement\HousingFinancialPenalty` | Civil penalty workflow |
| `rent_repayment_risks` | `Enforcement\RentRepaymentRisk` | Proactive RRO exposure tracking |
| `tribunal_cases` | `Enforcement\TribunalCase` | Tribunal appeals and RRO claims |
| `council_communication_logs` | `Enforcement\CouncilCommunicationLog` | Chronological council contact log |

**Service:** `App\Services\Compliance\EnforcementService`

- `getActiveEnforcement()` - notices not complied or withdrawn
- `getPenaltiesOutstanding()` - penalties not paid or overturned
- `getTotalFinancialExposure()` - sum of outstanding penalties plus RRO exposure
- `getOverdueDeadlines()` - past response, appeal, and representations deadlines

## Carina context

When a user opens the Enforcement Defence Centre or a notice detail page, Carina should:

1. Explain the notice type and typical deadlines in plain English
2. Summarise total financial exposure from `getTotalFinancialExposure()`
3. Flag overdue deadlines from `getOverdueDeadlines()`
4. Recommend evidence to gather (certificates, photos, correspondence log entries)
5. Remind that Propreneur tracks obligations but does not replace qualified housing or legal advice

Carina must not invent penalty amounts, tribunal outcomes, or council deadlines not recorded in the workspace.
