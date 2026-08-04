---
source: `brain/reference/carina-knowledgebase-final-packed.md`
extracted: 2026-05-15
note: Auto-split for Carina RAG / masterbrain. Verify against live code if implementing.
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
