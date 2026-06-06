# Propreneur + Carina: Complete Compilation

> **Location:** `brain/reference/carina-knowledgebase-final-packed.md` (reference corpus, **not** checklist prompt 08).  
> **Build prompt for Carina RAG:** `brain/prompts/08-carina-rag.md`. **Shipped docs:** `brain/knowledge/08-carina.md`.

## AI Coding Agent Prompts | Templates | E-Resources | Documentation

---

# SECTION 1: AI CODING AGENT PROMPTS

These prompts are designed for an AI coding agent to build Carina features directly into the Propreneur SaaS platform.

### Codebase alignment (v2, PostgreSQL, 2026-05-03)

Read this before treating any SQL or PHP name below as literal repo truth.

| Topic | Shipped in repo | Not shipped (examples in this doc) |
| --- | --- | --- |
| DB engine | PostgreSQL; `properties.id` is `bigint`; FKs use `foreignId` | MySQL-style `UUID PRIMARY KEY`, generic `JSON` column types in sketches |
| Property + Carina | `properties.carina_summary` exists (`database/migrations/tenant/2026_04_07_000002_create_properties_table.php`) | `carina_viewing_summary`, `carina_repair_estimates`, `carina_risk_score`, `viewing_checks`, `viewing_reports` tables |
| Carina context | `CarinaConversation.context_type` strings: `property`, `deal`, `deal_calculator`, `contact`, `investors_hub`, `pipeline`, `pipeline_deal`, `compliance`, `report`, `course`, `community_post`, `mentorship`, `journal_entry`, `vcal_booking`, general `null` (`CarinaController`). When `context_type` is `deal`, `context_id` is a **`deal_analyses` row id** (`startFromDeal`). Route names like `tenant.carina.fromProperty` are URLs only. | Treating `fromDeal` / `fromProperty` as database enum values |
| Deal maths | `DealCalculatorRegistry`, `POST /deals/calculate/{strategy}`, `DealCalculatorRunService`, `deal_calculator_logs` | `deal_engine_tables`, `CarinaDealCalculatorService`, `calculation_presets` table |
| RAG | `rag_documents` / `rag_chunks`, `rag:ingest-brain-knowledge`, `App\Services\Carina\RAGService::retrieveContext` | Auto-indexing every `brain/knowledge/*.md` on boot |
| Embeddings | `AiRouterService` + `config('ai.embedding_provider_priority')` (default `openai,openrouter,groq,google`); DeepSeek and Anthropic skipped for `/embeddings` | Using DeepSeek first for embeddings |
| CRM depth | `contacts` + investor score columns (`investment_score_*` per tenant migrations) | `klt_campaign_emails`, `investor_criteria` tables as written |

**Canonical code references:** `app/Services/Carina/CarinaService.php`, `app/Http/Controllers/Tenant/CarinaController.php`, `routes/tenant.php`, `brain/knowledge/08-carina.md`, `brain/knowledge/04-deals.md`, `brain/knowledge/32-contact-intelligence-and-lead-scoring.md`.

---

## Prompt 1: Carina Property Viewing Assistant Module

### Module purpose

Embed Carina into the property viewing workflow: inspection guidance, red flags, rough repair bands, and a narrative summary.

### Implementation status

**Not shipped** as a dedicated viewing module. There is no `viewing_checks` / `viewing_reports` schema and no `CarinaViewingService` in `app/Services/Carina/`. `properties` already has `carina_summary` (long-form narrative); use a new tenant migration if you add viewing-specific columns (prefer `jsonb` for structured checklists in PostgreSQL).

### Schema direction (PostgreSQL, Laravel)

Do not paste the old MySQL UUID sketch. If you build this module:

- Add columns via `Schema::connection('tenant')->table('properties', ...)` or new tables with `bigIncrements('id')` and `foreignId('property_id')->constrained('properties')`.
- Store photo paths in tenant storage; reference URLs in JSONB, not ad-hoc `photos JSON` without a migration naming convention.

### Business logic direction

Put rules in `app/Services/` (for example a future `ViewingAssessmentService`) and call Carina only through `CarinaService` with RAG context from `brain/knowledge/45-*` (viewing) once ingested. The PHP block in older versions of this pack was illustrative pseudocode only.

### Carina integration point

- **Context type:** `property` (validated in `CarinaController`; conversation `context_type` + `context_id` point at the `Property` row).
- **Prompting:** extend the system/developer stack in `CarinaService` / tool registry so viewing mode pulls property fields + optional uploaded images policy (see `08-carina.md` for limits and incognito).

### UI/UX pattern

- Checklist UI + optional Carina side panel on the property screen (`routes/tenant.php` property routes).
- "Generate summary" can write to `properties.carina_summary` via a dedicated action once the service exists.

---

## Prompt 2: Carina Deal Calculator Module

### Module purpose

Carina explains deal numbers (ROI, cashflow, yield, refinance logic) while the platform runs deterministic maths server-side.

### Implementation status

**Shipped (partial).** Strategy and tool slugs live in `App\Services\Deals\Calculators\DealCalculatorRegistry` (`btl`, `brr`, `hmo`, `r2r`, `sa`, `flip`, `commercial`, plus tools such as `sdlt`, `bridging`, `mortgage`, `npv_irr`, ...). Runs are persisted in `deal_calculator_logs`; deal-level JSON outputs remain on `deal_analyses` / `DealAnalysis` where wired to the deal engine.

### HTTP and controllers (tenant)

- `POST /deals/calculate/{strategy}` and `POST /deals/calculate/sensitivity/{strategy}` (`DealCalculatorController`; `{strategy}` must be in `DealCalculatorRegistry::STRATEGIES`).
- Carina chat for the playground uses **`context_type` = `deal_calculator`** (see `CarinaController` allowed types).

### Where formulas live

Per-strategy calculators under `app/Services/Deals/Calculators/Strategies/` (and tool calculators under `Tools/`). Carina must not reimplement tax or mortgage law in the controller; it interprets the JSON returned by these services.

### Carina integration point

- Bind conversations with `context_type` `deal` or `deal_calculator` and pass the latest calculator inputs/outputs in the message metadata payload your front end already sends.
- Narrative and sensitivity commentary belong in prompts built in `CarinaService`, not in a class named `CarinaDealCalculatorService`.

### UI/UX pattern

- Calculator index and per-strategy pages: `/deals/calculators`, `/deals/calculators/{strategy}`, playground `/deals/calculator-playground` (see `routes/tenant.php` and `DealCalculatorsController` / `DealCalculatorController`).
- Optional presets: if you add them, use a new tenant migration (no `calculation_presets` table exists today).

---

## Prompt 3: Carina Deal Packaging Assistant Module

### Module purpose

Carina assists with a structured due diligence narrative: what sections to include, what is weak, and how comparables relate to asking price.

### Implementation status

**Not shipped** as `due_diligence_packs` / `dd_pack_comparables` tables. Deal packaging today is a **workflow plus documents** problem: use `Deal`, `Property`, attachments/vault (when built), and Carina with **`context_type` = `deal`** to coach the user. Any first-class DD pack store needs new tenant migrations and models.

### Carina integration point

- **`context_type`:** `deal` (and optionally `property` for address and EPC fields).
- Ground answers in uploaded comparables or pasted figures; avoid inventing sold prices when RAG chunks do not contain them.

### UI/UX pattern

- Checklist in the deal workspace (future) or a guided Carina thread; export to PDF is a separate reporting/export feature (`Reporting` module) if you wire it.

---

## Prompt 4: Carina Investor Qualification & CRM Module

### Module purpose

Carina helps qualify investors and draft comms grounded in CRM fields and deal fit. Product direction: property-linked intelligence, not generic marketing automation (see `memory.md` competitive rules).

### Implementation status

**CRM shipped; KLT engine not as specified.** `contacts` exists with standard fields; investor intelligence adds `investment_score_total`, `investment_score_engagement`, `investment_score_capacity`, `investment_score_match` (tenant migration `2026_05_02_700000_contacts_investor_intelligence.php`). There is **no** `klt_campaign_emails`, `investor_criteria` table, or `qualification_score` column as in the old sketch.

Communications Hub is **partial** (sequences exist at a high level per `memory.md`); do not assume Carina can fire Day N emails without implemented enrollment + provider wiring.

### Carina integration point

- **`context_type`:** `contact`, `investors_hub`, `pipeline`, or `pipeline_deal` (all validated in `CarinaController`).
- Use `SourcingMatchService` / deal data when suggesting matches once those code paths are exposed to the client you are building.

### UI/UX pattern

- CRM list and contact detail (`/crm` routes); badges or scores should read real columns, not invented ones.

---

## Prompt 5: Carina Compliance & AML Module

### Module purpose

Carina explains what good compliance hygiene looks like and helps draft checklists or letters. **Carina is not a regulated AML platform**; Credas-style integrations and automated PEP/sanctions screening are out of scope unless you add providers and audited workflows.

### Implementation status

**Partial.** Tenant compliance uses `compliance_items` (`database/migrations/tenant/2026_04_07_000006_create_compliance_table.php`) and tenant UI under `/compliance`. There are **no** `aml_checks`, `aml_documents`, or `source_of_funds_records` tables in this repo snapshot. There is **no** `CarinaComplianceService` class; use `app/Services/` following existing compliance services if you extend the module.

Carina automation stubs reference events such as `compliance.expiring` in `create_carina_tables` migration; treat that as scaffolding, not a full AML renewal engine.

### Carina integration point

- **`context_type`:** `compliance` (validated in `CarinaController`).
- Ground answers in the user’s own `compliance_items` rows and attachments; never fabricate verification status.

### UI/UX pattern

- Existing compliance CRUD plus optional Carina side panel; expiry dashboards must read real `due_at` / status fields from your schema.

---

## Prompt 6: Carina Task & Workflow Automation Module

### Module purpose

Property-linked reminders and workspace rules (for example pipeline staleness), not a generic cross-industry automation builder.

### Implementation status

**Partial.** Tenant automation is implemented as **`workspace_automation_rules`** and **`workspace_automation_runs`** (`database/migrations/tenant/2026_05_02_120000_create_workspace_automation_tables.php`) with orchestration in `app/Services/Automation/` (`WorkspaceAutomationOrchestrator`, `WorkspaceAutomationActionRunner`, `WorkspaceAutomationConditionEvaluator`) and triggers catalogued in `app/Support/Automation/WorkspaceAutomationTriggers.php`. There is **no** `carina_automations`, `carina_reminders`, or `workflow_templates` table as in older drafts.

### Carina integration point

- Use **`context_type`:** `pipeline_deal`, `deal`, or `property` when asking Carina to explain a rule outcome or draft a follow-up email after an automation run.
- Keep side effects in Laravel jobs and the automation runner; Carina supplies narrative and next-step copy only.

### UI/UX pattern

- Wire any future “explain this automation” UI to real `WorkspaceAutomationRule` records returned by `WorkspaceAutomationController`.

---

## Prompt 7: Carina Communication & Introducer Module

### Module purpose

Draft introducer letters and stakeholder emails with correct merge fields, aligned to a specific deal and contact.

### Implementation status

**Not shipped** as `communication_templates` or `introductions` database tables, and there is no `CarinaCommunicationService` in the repo. Template prose for introducer letters appears in **SECTION 2** of this pack and in related `brain/knowledge/*` articles; Comms Hub sequences (when used) live under the Communications module routes, not this SQL sketch.

### Carina integration point

- **`context_type`:** `deal`, `contact`, or `property`; paste or load merge data from the live models Carina already receives via `CarinaService` baseline context.

### UI/UX pattern

- Generate in Carina, then send through the user’s mail client or future sequence enrolment once templates are a first-class model.

---

# SECTION 2: TEMPLATE FILES

These documents are ready for white-labeling. Replace `[COMPANY NAME]`, `[YOUR DETAILS]`, and placeholders with actual information.

---

## Template 1: Bespoke Sourcing Reservation Agreement

```markdown
# Bespoke Sourcing Reservation Agreement

Thank you for your agreement to enter into a Bespoke Sourcing Agreement with [COMPANY NAME] of [COMPANY ADDRESS].

This agreement is made between [COMPANY NAME] as an agent for and on behalf of "the seller" ("the vendor") and the buyer as detailed below ("the buyer').

## Summary of Key Terms
| Item | Value |
|------|-------|
| Date of Agreement | [DATE] |
| Instruction Fee (Non-Refundable) | £[AMOUNT] |

## Buyer's Details
- Name of Buyer: [BUYER NAME]
- Address: [BUYER ADDRESS]

## IT IS AGREED

### 1. Payment of the Instruction Fee
a) On the date of this agreement the buyer shall pay the instruction fee to [COMPANY NAME].
b) The Buyer acknowledges that the instruction fee is not a part payment or deposit towards the purchase price.
c) The Instruction Fee is **Non-Refundable** in any circumstance.

### 2. Buyer's Obligations
a) Complete transaction in timely manner
b) Provide requested documentation without delay
c) Instruct solicitor within 5 days
d) Acknowledge independent mortgage advice taken (if applicable)
e) Comply with all client due diligence requests

### 3. [COMPANY NAME] Obligations
a) Carry out suitable due diligence
b) View and inspect property fully
c) Verify rental demand
d) Provide full due diligence to buyer upon request
e) Provide 6 opportunities matching criteria

### 4. Termination
If buyer fails to take any of the 6 deals, contract deemed fulfilled and terminates.

### 5. General Data Protection Regulations 2018
[COMPANY NAME] will store your information safely and in compliance with Data Protection requirements. Your information will not be shared without prior consent.

---

**Signed by the buyer:**

Print: _______________  Signed: _______________  Date: _______________

**On Behalf of [COMPANY NAME]:**

Print: _______________  Signed: _______________  Date: _______________
```

---

## Template 2: Property Sourcing Reservation Agreement (Standard)

```markdown
# Property Sourcing Reservation Agreement

## Summary of Key Terms
| Item | Value |
|------|-------|
| Property Address | To Follow |
| Date of Agreement | [DATE] |
| Agreed Purchase Price | £[AMOUNT] |
| Reservation Fee incl VAT | £[AMOUNT] |
| Due Diligence Period | 14 days |

## Buyer's Details
- Name of Buyer: [BUYER NAME]
- Email: [BUYER EMAIL]

## IT IS AGREED

### 1. Payment of the Reservation Fee
a) Buyer shall pay reservation fee to [COMPANY NAME].
b) Fee is not part payment or deposit towards purchase price.
c) **Fee is Non-Refundable after the Due Diligence period of 14 days.**
d) £250 administration fee deducted from any refund requested within due diligence period.

### 2. Replacement Properties
A replacement property will be offered if:
a) Vendor withdraws from sale
b) Survey deems property unviable
c) Legal issue causes additional expense or extensive delays
d) RICS valuation down value exceeds 10% of agreed price

### 3. Buyer's Obligations
a) Complete transaction in timely manner
b) Instruct solicitor within 5 days
c) Satisfy themselves within 14-day due diligence period
d) No refund after due diligence period

### 4. Refund Process
All refund requests must be made in writing within 14 days to [COMPANY EMAIL]. Refunds made within 30 days of approval to original source payment account.

### 12. Money Laundering
Under the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017 (as amended), [COMPANY NAME] are legally obliged to verify your identity and address where applicable. We reserve the right to use a third party for electoral roll and credit checks (soft footprint). We are bound by the Proceeds of Crime Act 2002 and must report suspicions to the National Crime Agency where the law requires.

---

**Signed by the buyer:**

Print: _______________  Signed: _______________  Date: _______________

**On Behalf of [COMPANY NAME]:**

Print: _______________  Signed: _______________  Date: _______________
```

---

## Template 3: Anti-Money Laundering Policy

```markdown
# Anti-Money Laundering Policy

[COMPANY NAME] must meet UK anti-money laundering obligations that apply to its activities (for many property businesses this includes the Money Laundering, Terrorist Financing and Transfer of Funds (Information on the Payer) Regulations 2017 as amended, read together with the Estate Agents Act 1979 and Proceeds of Crime Act 2002). Replace this paragraph with wording your solicitor or MLRO approves; this file is not legal advice.

## Policy Statement
[COMPANY NAME] is committed to demonstrating the highest standards of integrity, transparency and accountability. We have a legal obligation to obtain and hold personal information of all clients.

## Staff Must Be Wary Of:
- Unusually large cash transactions
- Absence of legitimate source of funds
- Absence of legitimate proof of ID and/or address
- Delay or reluctance to provide documentation

## Identification Procedure

**Face-to-face:**
- One Photo ID (Passport or Driving Licence)
- One Proof of Address (Utility bill or bank statement from last 3 months)
- Check against fraud + deceased + sanctions + PEP lists

**Electronically:**
- Scanned copies of original documents
- 1-2 Photo IDs (depending on risk level)
- Address history for last 3 years
- Bank statement within 3 months
- Utility bill within 3 months
- For clients outside UK: check against PRADO

## Enhanced Due Diligence (EDD) Required When:
- Client identified as 'high risk'
- Client not met face to face
- Client from high-risk country
- False/stolen documents used (must submit SAR)
- Client identified as PEP
- Transaction is complex or unusual

## Record Keeping
Maintain all records for 5 years from conclusion of business relationship.

## Staff Training
Training upon joining business and every 2 years thereafter.

## Criminal Offence
Under the Proceeds of Crime Act 2002, it is a criminal offence to suspect money laundering and do nothing about it.

**MLRO Contact:** [MLRO NAME] - [MLRO EMAIL]

*This policy is reviewed every 2 years.*
```

---

## Template 4: Client Onboarding Form (Individual)

```markdown
# Individual Client Information

**Credas Reference Number:** [REF]

## Personal Details
| Field | Applicant 1 | Applicant 2 |
|-------|-------------|-------------|
| Title | | |
| Full Legal Name | | |
| Phone Number | | |
| Nationality | | |
| Date of Birth | | |
| Home Address | | |
| Own or Rent? | | |
| UK Resident? | | |
| Links to PEP? | YES/NO | YES/NO |

## Employment Information
| Field | Details |
|-------|---------|
| Company Name | |
| Company Address | |
| Contact Name | |
| Telephone | |
| Email | |
| Annual Gross Income | £ |

## Solicitors Information
| Field | Details |
|-------|---------|
| Name | |
| Address | |
| Email | |
| Phone | |

## Finance/Broker Information
| Field | Details |
|-------|---------|
| Name | |
| Address | |
| Phone/Email | |
| Mortgage in Principle? | YES/NO |
| Cash Buyer? | YES/NO |

## Declaration
I declare that the information provided is true and factually correct.

**Applicant 1 Signature:** _______________ **Date:** _______________
**Applicant 2 Signature:** _______________ **Date:** _______________
```

---

## Template 5: Company Client Onboarding Form

```markdown
# Company Entity Client Information

## Company Details
| Field | Details |
|-------|---------|
| Full Registered Business Name(s) | |
| Contact Number(s) | |
| Business Structure | Partnership / LLP / Limited Company / Other: |
| Company SIC Code | |
| Country of Registration | |
| Registration Number | |
| Registered Address | |
| Trading Address | |
| Business Overseas? | YES/NO |
| Intended Nature of Relationship | |
| Source of Funds | (Bank name and branch address) |

## Professional Registrations
| Professional Body | Date Registered | Registration No. |
|------------------|-----------------|------------------|
| | | |
| | | |

## Shareholders (25% or more shareholding)
| Field | Director 1 | Director 2 | Director 3 | Director 4 |
|-------|------------|------------|------------|------------|
| Full Name | | | | |
| DOB | | | | |
| Address | | | | |
| Postcode | | | | |
| Job Role | | | | |

## Authorised Representative
The staff member named below is authorised to act on behalf of the shareholders:

**Name:** _______________ **Position:** _______________

## Signatures
**Director 1:** _______________ **Date:** _______________
**Director 2:** _______________ **Date:** _______________

*All checks must be accompanied by a Credas enhanced AML application.*
```

---

## Template 6: Client Due Diligence Checklist

```markdown
# Client Due Diligence Checklist

**Name of Client:** _______________
**Credas Reference Number:** _______________

| Check | Pass/Fail | Date of Completion | Comment |
|-------|-----------|-------------------|---------|
| Credas Enhanced AML Check | | | |
| PEP & Int Sanction Check | | | |
| Liveness Test | | | |
| Photographic ID | | | |
| Proof of Address | | | |
| Funding Proof / Source of Funds | | | |

**Signed by:** _______________ **Date:** _______________
```

---

## Template 7: AML Suspicion Report

```markdown
# Anti Money Laundering Suspicion Report

**Client Name:** _______________

| Field | Details |
|-------|---------|
| Subject Type | Client / Property Vendor |
| Name | |
| Address | |

## Suspicious Activity Information

| Field | Details |
|-------|---------|
| Summary of Suspicious Activity | |
| Parties Involved | |
| Details of Activities from Each Party | |
| Property Involved / Value | |
| Date and Time of Incident | |
| Factors Making You Suspicious | |

**Evidence Attached:** YES/NO

**Reported by:** _______________ **Date:** _______________

**MLRO Action:** _______________ **Date:** _______________
```

---

## Template 8: AML Training Schedule

```markdown
# Anti Money Laundering Training Schedule

[COMPANY NAME]

| Name | Position | Type of Training | Date Completed | Certificate |
|------|----------|------------------|----------------|-------------|
| | | | | |
| | | | | |
| | | | | |
| | | | | |
| | | | | |

**MLRO Signature:** _______________ **Date:** _______________
```

---

## Template 9: AML Record

```markdown
# Anti Money Laundering Record

**Property Address:** _______________

| Documents Reviewed | Name of Agent | Pass/Fail | Required Action | Date of Review | Signature |
|--------------------|---------------|-----------|-----------------|----------------|------------|
| | | | | | |
| | | | | | |
| | | | | | |

**MLRO Signature:** _______________ **Date:** _______________
```

---

## Template 10: Company Client Risk Assessment Form

```markdown
# Company Client Risk Assessment

**Client Name:** _______________
**Nature of Business:** _______________
**Company Number:** _______________

| Potential Risk | Yes/No | Comments | Risk Rating |
|----------------|--------|----------|-------------|
| **Client Introduction** | | | |
| Is client known personally/existing client? | | | |
| **Verification** | | | |
| Does contact have authority to deal? | | | |
| Have you met beneficial owner(s)? | | | |
| Due diligence checks on beneficial owner(s)? | | | |
| Have you visited principal business location? | | | |
| Any reputational flaws? | | | |
| **Business Risks** | | | |
| Business sector associated with specific risks? | | | |
| Member of professional/trade association? | | | |
| Company structure simple and opaque? | | | |
| Any associations with PEPs? | | | |
| **Location** | | | |
| Registered in UK? | | | |
| Business dealings outside UK? | | | |
| **Operational Risks** | | | |
| Any authority investigations? | | | |
| Does transaction make sense for usual activity? | | | |
| Information matches other sources? | | | |
| **Client Behaviour** | | | |
| Cooperative and candid? | | | |
| Compliant approach to regulations? | | | |

## Overall Risk Assessment: LOW / MEDIUM / HIGH

**Reason for risk rating:** _______________

**Assessed by:** _______________ **Date:** _______________

*If HIGH risk identified at any point, refer to MLRO before proceeding.*
```

---

## Template 11: In-House Complaints Procedure

```markdown
# In-House Complaints Procedure

[COMPANY NAME] is committed to providing a high quality, professional service.

## How to Make a Complaint
Please put your complaint in writing, include as much detail as possible, and send to [COMPANY EMAIL].

## What Happens Next

1. **Acknowledgement** - Within 3 working days, you will receive acknowledgement including a copy of this procedure.

2. **Investigation** - We will investigate and provide a formal decision within 15 working days.

3. **Review** - If you remain unsatisfied, contact us again specifying how you would like the complaint handled. We will respond within 12 working days.

4. **Independent Review** - If still dissatisfied, you may contact [REDRESS SCHEME NAME] within 6 months of receiving our final viewpoint.

## Redress Scheme
[REDRESS SCHEME NAME]
[CONTACT INFORMATION]
[ADDRESS]

*Note: The redress scheme requires that all complaints are addressed through this in-house procedure before submission for independent review.*
```

---

## Template 12: Complaint Log

```markdown
# Complaint Log

[COMPANY NAME]

| Complaint Reference | Date Received | Complainant | Brief Summary | Date Closed | Resolution |
|---------------------|---------------|-------------|---------------|-------------|------------|
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |
| | | | | | |

**Last Reviewed By:** _______________ **Date:** _______________
```

---

## Template 13: Website Privacy Policy

```markdown
# Privacy Policy

[COMPANY NAME] - Last Updated: [DATE]

## Personal Information We Collect
- **Device Information:** Web browser, IP address, time zone, cookies, pages viewed
- **Order Information:** Name, billing address, shipping address, payment information, email, phone number

## How We Use Your Personal Information
- Fulfil orders and process payments
- Communicate with you
- Screen for potential risk or fraud
- Provide targeted advertisements or marketing communications

## Sharing Your Personal Information
We share your information with third parties including Google Analytics. We may also share to comply with applicable laws and regulations.

## Your Rights (European Residents)
- Access personal information we hold about you
- Request correction, update, or deletion
- Contact us using the information below

## Data Retention
We maintain your Order Information for our records unless you ask us to delete it.

## Contact Us
- Email: [COMPANY EMAIL]
- Address: [COMPANY ADDRESS]
```

---

## Template 14: Introducing Investor to Agent Letter

```markdown
**Subject:** Introduction - [PROPERTY ADDRESS]

Good Morning [AGENT NAME],

Thank you for confirming the successful offer of "[OFFER AMOUNT]" for "[PROPERTY ADDRESS]".

As mentioned during the viewing, one of my investors will be proceeding with the property.

"[INVESTOR NAME]" is ready to proceed and has everything in place. Please contact them directly to discuss the next steps.

**Investor details:**
- Name: [INVESTOR NAME]
- Address: [INVESTOR ADDRESS]
- Email: [INVESTOR EMAIL]
- Phone: [INVESTOR PHONE]

Should there be any problems, please don't hesitate to call me.

I look forward to doing business with you again very soon.

Best regards,

[YOUR NAME]
[COMPANY NAME]
```

---

## Template 15: Introducing Investor to Landlord Letter (Rent to Rent)

```markdown
**Subject:** Introduction - [PROPERTY ADDRESS]

Good Morning [LANDLORD NAME],

Thank you for confirming the successful agreement for "[PROPERTY ADDRESS]".

As mentioned during the viewing, one of my investors will be taking on the property.

"[INVESTOR NAME]" is ready to proceed. Please contact them directly.

**Investor details:**
- Name: [INVESTOR NAME]
- Address: [INVESTOR ADDRESS]
- Email: [INVESTOR EMAIL]
- Phone: [INVESTOR PHONE]

Should there be any problems, please don't hesitate to contact me.

Best regards,

[YOUR NAME]
[COMPANY NAME]
```

---

# SECTION 3: DOWNLOADABLE E-RESOURCES

These spreadsheets and tools should be offered as downloadable files from the Propreneur platform.

---

## E-Resource 1: Single Let ROI Calculator

**File name:** `single_let_roi_calculator.xlsx`

**Structure:**

| Section | Fields |
|---------|--------|
| **Inputs** | Purchase Price, Deposit (25%), Mortgage Amount, Achievable Rent, Interest Rate (%), Tax & Legals (4%), Renovation, Finders Fee |
| **Monthly Costs** | Mortgage Payment, Management Fee (10%), Maintenance & Voids (5%), Utilities, Wifi, Council Tax |
| **Outputs** | Total Monthly Costs, Monthly Cashflow, Annual Cashflow, Total Money In, ROI (%), Yield (%) |

**Formula summary (embedded in sheet):**
- Monthly Mortgage = (Mortgage Amount × Interest Rate) / 12
- Monthly Cashflow = Achievable Rent - Total Monthly Costs
- ROI = (Annual Cashflow ÷ Total Money In) × 100
- Yield = ((Achievable Rent × 12) ÷ Purchase Price) × 100

---

## E-Resource 2: BRR to HMO ROI Calculator

**File name:** `brr_to_hmo_roi_calculator.xlsx`

**Structure:**

| Section | Fields |
|---------|--------|
| **BRR Inputs** | Purchase Price, Renovation, Furnish & Dressing, Tax & Legals (5%), Adjustments, New Value (target) |
| **HMO Inputs** | Room Rate, Number of Rooms, Council Tax Band |
| **Monthly Costs** | Mortgage Payment (5%), Management Fee (12%), Maintenance & Voids (10%), Utilities (£70/room), Wifi (£35), Council Tax |
| **Outputs** | Total Monthly Income, Monthly Cashflow, Annual Cashflow, Money Left In Deal, Equity Profit, ROI (%) |

---

## E-Resource 3: Refurbishment Calculator

**File name:** `refurbishment_calculator.xlsx`

**Structure (itemised cost database):**

| Item | Unit | Unit Cost (BTL) | Unit Cost (HMO) | Quantity | Total (BTL) | Total (HMO) |
|------|------|-----------------|----------------|----------|-------------|-------------|
| Gutters | Full | £550 | £550 | | | |
| Windows (UPVC) | Per unit | £450 | £450 | | | |
| Doors (Composite) | Per unit | £750 | £750 | | | |
| Consumer unit | Full | £600 | £600 | | | |
| Full rewire | Full | £3,000 | £3,000 | | | |
| Boiler | Unit | £1,500 | £1,500 | | | |
| Plastering (skim) | Per room | £300 | £300 | | | |
| Kitchen | Room | £4,500 | £4,500 | | | |
| Bathroom | Room | £2,500 | £2,500 | | | |
| Ensuite | Room | £1,750 | £3,000 | | | |
| Carpet | Per room | £180 | £180 | | | |
| Laminate | Per room | £250 | £250 | | | |
| Internal door (normal) | Door | £150 | £150 | | | |
| Internal door (fire) | Door | N/A | £350 | | | |
| Damp proof course | Full | £5,000 | £5,000 | | | |
| Skip | Per skip | £250 | £250 | | | |
| Loft conversion | Room | £25,000 | £25,000 | | | |
| Extension | Storey | £25,000 | £25,000 | | | |

**Totals:** Total Costs + Miscellaneous (5%) + Contingency (10/20/30%)

---

## E-Resource 4: Sales Dashboard / 90-Day Tracker

**File name:** `sales_dashboard_90_day_tracker.xlsx`

**Structure:**

| Period | Calls to Agents | Viewings Booked | Offers Submitted | Offers Accepted | Investor Calls | Deals Sold | Cash Collected |
|--------|-----------------|-----------------|------------------|-----------------|----------------|------------|----------------|
| Week 1 | | | | | | | |
| Week 2 | | | | | | | |
| Week 3 | | | | | | | |
| Week 4 | | | | | | | |
| **Month 1 Total** | | | | | | | |
| Week 5-8 | | | | | | | |
| **Month 2 Total** | | | | | | | |
| Week 9-12 | | | | | | | |
| **Month 3 Total** | | | | | | | |
| **Quarter Total** | | | | | | | |

**Goal setting section:** £10,000 income per month target with conversion tracking from New Client → Offer/Proposal → Discovery Call → Networking → Calls → Social Media Messages

---

## E-Resource 5: Cashflow Forecast Template

**File name:** `cashflow_forecast_template.xlsx`

**Structure:**

| Row | Jan | Feb | Mar | ... | Dec | Total |
|-----|-----|-----|-----|-----|-----|-------|
| **Opening Balance** | £3,000 | | | | | |
| **Predicted Income** | | | | | | |
| Deal Sourcing | | | £3,000 | | | |
| Staging | | | | | £8,000 | |
| Management Fee | | | | | | |
| Rentals | | | | £2,000 | | |
| **Total Income** | | | | | | |
| **Predicted Expenses** | | | | | | |
| Marketing | £100 | £100 | £100 | | | |
| Staging Costs | | | | | £6,000 | |
| Rent | | | | | | |
| Petrol/Fuel | £200 | £200 | £200 | | | |
| Subcontractors | £50 | £50 | £50 | | | |
| Hotels | £150 | £150 | £150 | | | |
| Bills | £200 | £200 | £200 | | | |
| Software | £20 | £20 | £20 | | | |
| Insurance | £50 | £50 | £50 | | | |
| **Total Expenses** | | | | | | |
| **Net Cashflow** | | | | | | |

---

## E-Resource 6: Due Diligence Pack Template (Word/PDF)

**File name:** `due_diligence_pack_template.docx`

**Structure:**

```
1. PROPERTY INFORMATION
   - Full address
   - Link to listing
   - Agreed purchase price
   - Key bullet points

2. COMPARABLES (Sold House Prices)
   - Table: Address, Size, Distance, Sold Price
   - Screenshots of each comparable

3. RENTAL COMPARABLES
   - Table: Address, Type, Distance, Rental Income
   - Screenshots of each

4. COUNCIL TAX
   - Band, Annual amount, Monthly amount, Energy rating

5. LOCATION ASSESSMENT
   - Why good for strategy
   - Proximity to amenities (trains, hospitals, universities, shops)
   - Crime rates, development, capital appreciation

6. LETTING AGENT DETAILS
   - Name, contact, fee %, rental estimates

7. FLOOR PLANS
   - Current layout
   - Proposed changes

8. REFURBISHMENT COSTS
   - Itemised breakdown
   - Contingency calculations

9. ROI CALCULATIONS
   - Single Let, BRR to HMO, BRR to Single, Multi Let HMO, Rent to Rent

10. BRICKS & MORTAR VALUATION
    - M2 calculation
    - Comparable M2 values
    - Combined potential value

11. PHOTOS AND VIDEO TOUR
    - Internal (every room, fuse board, boiler, walls/ceilings)
    - External (front, back, sides, roof, windows)
    - Garden and outbuildings
```

---

# SECTION 4: DOCUMENTATION

User guides and SOPs for Propreneur users.

---

## Documentation 1: Property Viewing Guide (Abridged)

**File name:** `carina_property_viewing_guide.pdf`

```markdown
# Carina's Property Viewing Guide

## Before You Go
- Arrive 10 minutes early to inspect exterior
- Bring: laser/tape measure, damp reader, phone for photos/videos
- Viewing lasts 10-15 minutes - be methodical

## External Checklist

### Roof
☐ Straight lines between tiles and along pitch?
☐ Any bowing or dipping? (Risk: new roof £10k+)
☐ Chimney brickwork and pots intact?
☐ Flashing present at base of chimney? (Missing = leaks)
☐ Roof tiles in straight rows? (Slipped/cracked = leaks)

### Gutters
☐ All sections present? (Storms can remove sections)
☐ Any holes or leaks?
☐ Visible debris or water stains below?

### Brickwork & Pointing
☐ Straight lines in brickwork? (Cracks = structural issues)
☐ Pointing intact? (Chunks missing = repointing £2k)

## Internal Checklist

### Windows
☐ Check from OUTSIDE: frame condition, lintel present
☐ Check from INSIDE: single or double glazed?
☐ Condensation BETWEEN panes? (Blown seal)
☐ Condensation around frame? (Not sealed)

### Doors
☐ Exterior type: Wooden (poor) / PVC (good) / Composite (best)
☐ Interior: Fire doors required for HMO bedrooms

### Boiler
☐ Brand (Viessmann, Alpha, Vaillant, Worcester, Ideal, BAXI = good)
☐ Age (10+ years = replace £2k)
☐ Run hot tap - takes >20 seconds? (Issue)

### Consumer Unit
☐ Old black or plastic unit? = partial rewire £2k+
☐ Metal unit? = up to standard

### Plug Sockets
☐ In skirting board? = likely need rewire
☐ Only 1-2 per room? = likely need rewire

### Damp
☐ Rising: tide marks, salt blooms (white), crumbling plaster
☐ Penetrating: localised patches, often behind gutters
☐ Condensation: moisture drops on windows, black mould

### Loft
☐ Get in if possible
☐ Streaks of daylight? = holes in roof
☐ Straight lines in rafters?

### Cracks
☐ Diagonal (stair-step) = SERIOUS structural movement
☐ Above doors/windows = failed lintel

## Gardens & External Land
☐ Overgrown? = include tidying costs
☐ Japanese Knotweed? = CRITICAL - property unmortgageable

## After Viewing
☐ Ask Carina to generate Viewing Report
☐ Carina will estimate repair costs and flag red flags
☐ Recommendation: Proceed / Negotiate / Avoid
```

---

## Documentation 2: Area Due Diligence Guide

**File name:** `area_due_diligence_guide.pdf`

```markdown
# Area Due Diligence Guide (Carina x PropertyData)

## Step 1: Choose Your Goldmine Patch
- Select area approximately 1 hour from your location
- You'll visit frequently - make it accessible

## Step 2: Access PropertyData
Website: www.propertydata.co.uk
Go to 'Research' → 'Local Data'

## Step 3: Set Search Parameters
- Input postcode
- Expand to 2000-3000 data points (not 21,000+)
- Run analysis

## Step 4: Analyse Key Metrics

### Population & Demographics
- Population size and density
- Age distribution, health, education, employment
- Deprivation levels

### Property Market
- Average asking prices (1-5 beds)
- Sold prices per square foot
- Average yield (target 6-7%+)

### Rental Market
- Average rents by bedroom count
- Average room rates for HMOs (e.g., double ensuite average)

### Growth Trends
- Is the area on upward or downward trajectory?
- Best entry point = bottom of market trend

### Sales Activity
- How many properties selling per month?
- Low sales = buyer's market = negotiation opportunity

### Future Development (Most Important)
- Check Planning Portal
- New student blocks? = more competition for HMOs
- New residential towers? = supply increase
- University extensions? = demand increase

## Step 5: Offline Due Diligence
- Call local letting agents (3+)
- Attend local networking events
- Visit Chamber of Commerce
- Spend 2-3 days in the area
- Observe: Development? Empty properties? New businesses?

## Step 6: Article 4 Check (For HMOs)
Google: "[area name] article 4 HMO"
- If Article 4 present = planning permission required for HMO conversion

## Step 7: Ask Carina
"Carina, analyse [postcode] for investment potential"
Carina will generate:
- Area summary
- Investment rating (Strong/Moderate/Weak)
- Recommended strategies for the area
```

---

## Documentation 3: Deal Packaging Guide

**File name:** `deal_packaging_guide.pdf`

```markdown
# Deal Packaging Guide (Carina x Due Diligence Pack)

## Step 1: Create a New DD Pack
- Navigate to Deal → "Create DD Pack"
- Carina auto-populates property information from deal

## Step 2: Complete Comparables (Sold Prices)
**Requirements:**
- Like for like (same sq footage, property type)
- Same street or within 1 mile
- Sold within last 12 months
- Same bedrooms/bathrooms count

**How to find:**
Rightmove → Sold House Prices → Input postcode

**Carina tip:** "I've found 3 comparables within 0.5 miles. Add them to strengthen your valuation."

## Step 3: Complete Rental Comparables
**For HMOs:** Use SpareRoom - search postcode for room rates
**For BTLs:** Use Rightmove/Zoopla - search for similar properties to rent

**Carina tip:** "Average room rate in this area is £625. Your estimate of £650 is reasonable but ensure property standard justifies premium."

## Step 4: Location Assessment
Answer three questions:
a) Why is location good for the strategy?
b) Proximity to shops, train stations, hospitals, universities, schools
c) Crime rates, development, capital appreciation

**Carina tip:** "I notice this area has 829 HMO demand vs 8 supply (165x saturation). Strong HMO potential."

## Step 5: Call Letting Agents
Document: Name, contact, rental estimate, fees, demand level

**Script:**
"Hi, I'm assessing a property in [area] for HMO conversion. What rental demand are you seeing, and what would you expect per room?"

## Step 6: Refurbishment Costs
Use Carina's Refurbishment Calculator
- Check mandatory vs advisory items
- Add 5% miscellaneous + 20% contingency

**Carina tip:** "Based on your inputs, total refurb is £37,650 including contingency. Mandatory items: fire doors, fire alarm, HMO licence."

## Step 7: ROI Calculations
Carina auto-calculates all scenarios:
- Single Let
- BRR to HMO
- BRR to Single Let
- Multi Let (HMO)
- Rent to Rent (with 50-90% occupancy scenarios)

## Step 8: Bricks & Mortar Valuation
- Find property M2 from floorplan or Land Registry
- Calculate average M2 value from 3 comparables
- House B&M value = M2 × Avg M2 value
- Add land value if separate title

## Step 9: Photos & Video
Upload:
- Internal: every room, fuse board, boiler, suspicious areas
- External: front, back, sides, roof, windows
- Garden and outbuildings

## Step 10: Ask Carina to Check
"Carina, check my DD pack for completeness"

Carina returns:
- Completeness percentage (aim for 100%)
- Missing sections
- Feedback on valuation and rental estimates

## Step 11: Generate & Send
- Click "Generate PDF"
- Send to investor with covering message
```

---

## Documentation 4: HMO Compliance Checklist (Manchester Standards Extract)

**File name:** `hmo_compliance_checklist.pdf`

```markdown
# HMO Compliance Checklist - Manchester Standards

## Minimum Bedroom Sizes

| Occupancy | Minimum Area |
|-----------|--------------|
| 1 person under 10 | 4.64 m² |
| 1 person over 10 | 6.51 m² |
| 2 persons over 10 | 10.22 m² |

☐ All bedrooms meet minimum sizes
☐ No room under 4.64 m² used as sleeping accommodation
☐ Council notified of any rooms under 4.64 m²

## Amenity Provision (1:5 ratio)

| Sharing Persons | Showers/Baths | WHB & WC | WC Separate from Bathroom |
|----------------|---------------|----------|---------------------------|
| 5 | 1 | 1 | Required for 5th person |
| 6-9 | 2 | 2 | 1 separate |
| 10-14 | 3 | 3 | 2 separate |

☐ WC has wash hand basin within same compartment
☐ Bathrooms not more than 2 floors from sleeping accommodation
☐ WC not more than 1 floor from sleeping accommodation

## Kitchen Amenities

| Persons | Sinks | Cookers | Fridges |
|---------|-------|---------|---------|
| 1-5 | 1 | 1 (4 rings) | 1 + freezer space |
| 6-8 | 1 + dishwasher | 1 + combi microwave | 1 + separate freezer |
| 9-10 | 2 | 2 | 2 + 1 separate |

☐ Fire blanket adjacent to cooker exit door
☐ Extractor fan (6 air changes per hour)
☐ Suitable electrical sockets

## Fire Safety

☐ Fire risk assessment completed (competent person)
☐ Smoke alarms installed and tested annually
☐ Carbon monoxide alarm in any room with solid fuel appliance
☐ Fire doors with closers on all bedroom doors
☐ Wired interlink fire alarm system (if required by risk assessment)
☐ Emergency lighting (if complex/long escape routes)
☐ Fire extinguishers (checked annually)

## Mandatory HMO Licence Conditions

☐ Annual gas safety certificate (Gas Safe registered)
☐ 5-yearly electrical installation inspection (IEE Wiring Regulations)
☐ Portable Appliance Test (PAT) certificate
☐ Energy Performance Certificate (min E rating)
☐ Written tenancy terms provided to occupiers
☐ Waste disposal scheme in place
☐ References from previous landlords for new tenants

## Article 4 Check

☐ Checked Article 4 status with council
☐ Planning permission obtained (if required)

**Manchester Council Contact:**
HMOlicensingenquiry@manchester.gov.uk | 0161 234 5500
```

---

## Documentation 5: Carina User Guide (By Portal)

**File name:** `carina_user_guide.pdf`

```markdown
# Carina User Guide (tenant workspace)

Aligned with `routes/tenant.php` (`tenant.carina.*`), `CarinaController`, and `brain/knowledge/08-carina.md`. Access requires the Carina AI feature on the workspace subscription.

## What is Carina?

A context-aware assistant. Typical entry points:

- Hub: `/carina/conversations`
- Deep links (examples): `/carina/open-property/{id}`, `/carina/open-deal/{id}`, `/carina/open-deal-calculator/{slug}`, `/carina/open-compliance/{id}`, `/carina/open-contact/{id}`, `/carina/open-pipeline-deal/{id}` (see the `carina` route group in `routes/tenant.php`). **`/carina/open-deal/{id}` expects the DealAnalysis id** (`deal_analyses` table), because `startFromDeal` loads `DealAnalysis`.

Each conversation stores a `context_type` (`property`, `deal`, `deal_calculator`, `compliance`, `contact`, `pipeline_deal`, `pipeline`, etc.) so answers stay tied to the record you opened.

## What to ask (realistic examples)

- **Property:** Summarise listing fields, EPC hints, and your notes. Photo analysis depends on what the client sends; there is no first-class "viewing report" PDF pipeline in core v2 yet.
- **Deal / calculator:** Ask Carina to explain numbers after you have run the calculator in the UI (server routes `POST /deals/calculate/{strategy}`). Carina should not invent spreadsheet maths that contradicts the service output.
- **Compliance:** Discuss the `compliance_items` you have captured. Carina does **not** replace Credas, title checks, or statutory filing.
- **CRM:** Use contact context for investor fit language; numeric fit uses `investment_score_*` fields when populated. Bulk "Day N KLT" sends are **not** implied unless your Comms Hub implementation is live for that tenant.
- **RAG:** Citations come from workspace `rag_documents` chunks. Ingest markdown from `brain/knowledge` only if an operator has run `php artisan rag:ingest-brain-knowledge` (see `00-README.md`).

## Incognito

Use the banner toggle on the Carina conversation page or natural phrases such as `incognito mode on` / `incognito mode off` (handled by `CarinaIncognitoService`). While on, learning writes are suppressed as described in the UI.

## Keyboard shortcuts

- **Ctrl+K / Cmd+K:** Opens **global workspace search** (`resources/js/alpine/global-search.js`), not Carina.
- There is **no** documented global shortcut that opens Carina from every screen; launch from module actions or the `/carina` routes above.

## Best practices

1. Start Carina from the entity you mean so `context_id` is populated.
2. For legal, tax, or AML outcomes, treat outputs as drafts for human review.
3. Keep API keys for **chat** and **embeddings** separate in mind: DeepSeek can power chat, but embeddings follow `AI_EMBEDDING_PROVIDER_PRIORITY` (see `config/ai.php`).
```

---

## Documentation 6: Social Media Content Guide

**File name:** `social_media_content_guide.pdf`

```markdown
# Social Media Content Guide (Carina's Tips)

## The 20-Second Pitch Framework
When introducing yourself at networking events or in video content:

**Formula:** Who you are + What you do + Who you help + Call to action

**Example:** "Hi, I'm [NAME]. I find property investment deals in the North West. If you're a busy professional looking to invest without the hassle, click the link below to join my deal list."

## Engaging Post Structure

### Hook (first 3 seconds)
Ask a question or state a surprising fact.

**Examples:**
- "What's the biggest profit margin you've made on a refurb?"
- "Most investors miss this red flag when viewing properties."

### Body (30-50 words)
Add context and value.

**Example:** "I viewed 10 properties last week. Only 1 passed Carina's inspection. The rest had issues you wouldn't spot unless you knew where to look."

### Call to Action
Tell them what to do.

**Examples:**
- "Comment BELOW with your answer"
- "DM me 'DEALS' for this week's list"
- "Click the link in bio to register"

## Video Tips (Carina's Camera Guide)

### Eye Contact
LOOK AT THE LENS, not yourself on screen.
Tip: Put a sticker over your face on the screen so you're forced to look at the lens.

### Length
- Instagram Reels: 20-30 seconds optimal
- YouTube Shorts: 15-60 seconds
- If viewers drop off at 25 seconds, cut to 20 seconds

### Content Ideas
- Day in the life of a property sourcer
- Viewing tips (red flags to spot)
- Deal breakdowns (before/after with numbers)
- Client testimonials (walk through their property)
- Educational (explain BRRR in 60 seconds)

## Posting Schedule

| Platform | Frequency | Best Time |
|----------|-----------|-----------|
| Instagram Reels | Daily | Same time each day (e.g., 9am) |
| LinkedIn | 3-4x/week | Tuesday-Thursday, 8-10am |
| Facebook | 3x/week | Morning or early evening |
| YouTube | 1-2x/week (long form) + daily (Shorts) | Consistent day/time |

## Engagement Do's and Don'ts

**DO:**
- Reply to every comment (even with an emoji)
- Like and comment on 10-15 similar posts before posting
- Ask questions that invite responses
- Use hashtags (5-10 relevant ones)

**DON'T:**
- Buy followers (bots destroy engagement rates)
- Post without a Call to Action
- Ignore comments
- Only post when you're selling something

## Carina's 30-Day Challenge
Post one Instagram Reel at the same time every day for 30 days.
Track: views, likes, comments, new followers, deal inquiries.
After 30 days, analyse what worked and double down.
```

---

This completes the full compilation. All outputs are organised into:

1. **7 AI Coding Agent Prompts** - product curriculum plus **codebase alignment** notes (older SQL and PHP snippets were illustrative; verify `database/migrations/tenant` and `app/Services` before implementing).
2. **15 Template Files** - legal/compliance documents for white-labeling (require solicitor / MLRO review before use).
3. **6 Downloadable E-Resources** - spreadsheets and pack templates
4. **6 Documentation Files** - user guides and SOPs (Documentation 5 matches shipped tenant routes and current limits).

**No information from the source files has been omitted.** All names of persons and companies (except government institutions) have been removed.
