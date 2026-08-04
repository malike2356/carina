# Compliance Tracking

**Last updated:** 2026-06-05 (sidebar navigation, property compliance panel, badge counts)

## Overview

Tracks regulatory certificates, licences, insurance policies, AML checks, complaints, workspace requirements, and regulatory registration. Provides expiry alerts, status tracking, document vault linking, and PDF portfolio export.

**Feature flag:** `compliance` (`BillingModule::Compliance`)  
**Routes:** `tenant.compliance.*`  
**Controllers:**
- `App\Http\Controllers\Tenant\ComplianceController` - certificate/licence CRUD, starter checklist, PDF export
- `App\Http\Controllers\Tenant\Compliance\AmlController` - AML records + staff training logs
- `App\Http\Controllers\Tenant\Compliance\AmlDealLogController` - per-deal AML transaction checks
- `App\Http\Controllers\Tenant\Compliance\ComplaintCaseController` - complaints CRUD
- `App\Http\Controllers\Tenant\Compliance\ComplianceRequirementController` - requirements + check logging
- `App\Http\Controllers\Tenant\Compliance\RegulatoryProfileController` - singleton workspace regulatory profile

**Services:** `ComplianceRulesEngine`, `ComplianceRagService`, `DocumentVaultService`, `ComplianceStarterChecklistService`, `ComplianceDashboardService`, `AmlService`, `AmlDealLogService`

## Navigation

Tenant sidebar: top-level section **Compliance** contains a collapsible **Compliance** group (`resources/views/layouts/app.blade.php`). Sub-section headings: **Business Compliance**, **Property Compliance**, **Tenancy Compliance**.

Red badge counts (only when count > 0) come from `ComplianceDashboardService::getSnapshot()` via `LayoutComposer`, cached in session key `compliance_nav_snapshot` for 5 minutes:

| Sidebar label | Badge sum |
|---------------|-----------|
| Certificates | `certificates.red_count` |
| HMO Licences | `hmo_licences.expired_count` + `renewal_due_count` |
| Enforcement Centre | `enforcement.active_notices_count` + `outstanding_penalties_count` |

### Module routes (sidebar labels)

| Sidebar label | Route name | Path (under tenant host) |
|---------------|------------|--------------------------|
| Compliance Dashboard | `tenant.compliance.index` | `/compliance` |
| Certificates | `tenant.compliance.index` (create/edit/show/export) | `/compliance`, `/compliance/create`, `/compliance/{item}` |
| Policies | `tenant.compliance.policies.index` | `/compliance/policies` |
| AML Hub | `tenant.compliance.aml.index` | `/compliance/aml` |
| Regulatory Profile | `tenant.compliance.regulatory.edit` | `/compliance/regulatory` |
| Complaint Cases | `tenant.compliance.complaints.index` | `/compliance/complaints` |
| Compliance Audits | `tenant.compliance.audit.index` | `/compliance/audit-plans` |
| Staff Training | `tenant.compliance.training.index` | `/compliance/training` |
| HMO Licences | `tenant.hmo-licences.index` | `/hmo-licences` |
| Selective Licences | `tenant.selective-licences.index` | `/selective-licences` |
| HHSRS Assessments | `tenant.hhsrs.index` | `/hhsrs` |
| Fire Risk Assessments | `tenant.fire-risk-assessments.index` | `/fire-risk-assessments` |
| Asbestos and Water Safety | `tenant.compliance.index` (`?status=expired`) | `/compliance?status=expired` |
| Renters Rights Act 2025 | `tenant.compliance.rra2025.index` | `/compliance/rra-2025` |
| Enforcement Centre | `tenant.compliance.enforcement.index` | `/compliance/enforcement` |
| Tenancy Agreements | `tenant.tenancy-agreements.index` | `/tenancy-agreements` |
| Rent Reviews | `tenant.rent-reviews.index` | `/rent-reviews` |
| Property Inspections | `tenant.inspections.index` | `/inspections` |

Property show page: `PropertyComplianceSummaryService::forProperty()` drives the **Compliance status** panel (`resources/views/tenant/properties/partials/compliance-status-panel.blade.php`) when the compliance module is enabled.

## Unified RAG dashboard

`ComplianceDashboardService::getSnapshot()` aggregates workspace compliance status for the hub at `GET /compliance` (`tenant.compliance.index`). The overview includes certificate RAG counts plus module panels for HMO licences, selective licences, HHSRS, fire safety, enforcement, Decent Homes (RRA 2025), tenancy agreements, property inspections, staff training, asbestos/water compliance items, and audit actions.

**Module quick links (tenant routes):**

| Module | Route name |
|--------|------------|
| Certificates hub | `tenant.compliance.index` |
| HMO licences | `tenant.hmo-licences.index` |
| Selective licences | `tenant.selective-licences.index` |
| HHSRS | `tenant.hhsrs.index` |
| Fire risk assessments | `tenant.fire-risk-assessments.index` |
| Enforcement | `tenant.compliance.enforcement.index` |
| RRA 2025 / Decent Homes | `tenant.compliance.rra2025.index` |
| Tenancy agreements | `tenant.tenancy-agreements.index` |
| Property inspections | `tenant.inspections.index` |
| Staff training | `tenant.compliance.training.team` |
| Compliance audits | `tenant.compliance.audit.index` |
| AML hub | `tenant.compliance.aml.index` |
| AML deal logs | `tenant.compliance.aml.deal-logs.index` |
| Complaints | `tenant.compliance.complaints.index` |
| Requirements | `tenant.compliance.requirements.index` |
| Regulatory profile | `tenant.compliance.regulatory.edit` |

Property-level fire safety logs remain on `tenant.properties.fire-safety.index` per property.

## ComplianceItem (certificates & licences)

`App\Models\Tenant\ComplianceItem` (table `compliance_items`, SoftDeletes)

**Fields:**
- `property_id` (FK) or `deal_analysis_id` (FK)
- `created_by`, `category`, `type`, `title`, `reference_number`
- `issued_at`, `expires_at`, `reminder_days`
- `status` - valid / expiring_soon / expired / not_required
- `document_path` - legacy column; UI uses workspace **Document Vault** (`compliance_item_id`) instead
- `notes`

**Types (UI dropdown):** gas_safety, epc, eicr, hmo_license, pat_testing, fire_alarm, landlord_insurance, rent_guarantee, deposit, **right_to_rent**, other

**Starter checklist:** `ComplianceStarterChecklistService` seeds missing types per property (includes **right_to_rent**).

## AML hub

**Tables:** `aml_records`, `aml_training_logs`  
**Models:** `AmlRecord` (SoftDeletes, Auditable), `AmlTrainingLog`

**Routes:**
- `GET /compliance/aml` - `tenant.compliance.aml.index`
- `POST /compliance/aml/records` - store AML check
- `DELETE /compliance/aml/records/{record}`
- `POST /compliance/aml/training` - store training log
- `DELETE /compliance/aml/training/{log}`

**AmlService:** `overdueReviews()`, `trainingDue()`, `storeRecord()`, `storeTrainingLog()`

**CRM links:** Contact show and deal show list linked AML records; link to AML hub.

## AML deal log (per transaction)

HMRC Money Laundering Regulations 2017 require estate agents and property sourcers to conduct customer due diligence **for each transaction**, not only at contact level. `AmlDealLog` records that a deal-specific AML check was performed and links optional contact-level `AmlRecord` evidence.

**Table:** `aml_deal_logs` (SoftDeletes, Auditable)  
**Model:** `App\Models\Tenant\AmlDealLog`

**Key fields:** `deal_analysis_id`, `contact_id`, `aml_record_id`, `checked_by_user_id`, `check_date`, `outcome` (`clear`, `requires_review`, `rejected`), `risk_rating` (`low`, `standard`, `enhanced`), PEP/sanctions/source-of-funds flags, enhanced due diligence notes, optional `document_id`.

**Relationships:** `DealAnalysis::amlLogs()`, `AmlRecord::dealLogs()`. `isHighRisk()` is true when `risk_rating = enhanced` or `outcome = requires_review`.

**Routes:**
- `GET /compliance/aml/deal-logs` - all deal AML logs (`tenant.compliance.aml.deal-logs.index`)
- `POST /compliance/aml/deal-logs` - record check from deal show or AML hub (`tenant.compliance.aml.deal-logs.store`)
- `GET /compliance/aml/deal-logs/{log}` - log detail (`tenant.compliance.aml.deal-logs.show`)
- `DELETE /compliance/aml/deal-logs/{log}` - soft delete (`tenant.compliance.aml.deal-logs.destroy`)
- `GET /compliance/aml/deals-missing` - deals with no AML deal log (`tenant.compliance.aml.deals-missing`)

**UI:** Deal show includes an **AML check** panel (`resources/views/tenant/deals/partials/aml-deal-check.blade.php`). Compliance hub links to deal logs and the missing-checks risk alert view.

**Service:** `AmlDealLogService::createLog()`, `getLogsForDeal()`, `getDealsMissingAmlCheck()`.

## Carina compliance context

When the `compliance` feature flag is enabled, Carina receives a live workspace compliance appendix via `App\Services\Carina\CarinaComplianceContextService`.

**Baseline wiring:** `CarinaBaselineContextService::complianceAppendix()` calls `CarinaComplianceContextService::buildContext()` and appends the block to every Carina turn (alongside persona and strategy finder context).

**Data source:** counts and deadlines come from `ComplianceDashboardService::getSnapshot()` and related compliance services. No tenant names, emails, or phone numbers are included; property-scoped lines use address text only.

**Context block sections (headers):**

| Header | Contents |
|--------|----------|
| `[COMPLIANCE SNAPSHOT]` | Roll-up counts: certificates, HMO/selective licences, HHSRS, fire safety, enforcement, Decent Homes, tenancy, inspections, training, audit, total red alerts |
| `[URGENT ITEMS]` | Top 5 items by expiry (certificates, licence renewals, overdue FRA reviews) |
| `[HHSRS CAT 1]` | Property addresses with Category 1 hazards |
| `[ENFORCEMENT]` | Active notice type and property address |
| `[FINANCIAL PENALTIES]` | Outstanding penalty count and total financial exposure |
| `[HMO LICENCES EXPIRING]` | HMO licences expiring within 30 days (address and expiry date) |

**Stale context detection:** `carina_conversations.compliance_snapshot_hash` stores a SHA-256 of the current dashboard snapshot; `compliance_context_version` tracks the context format (`CarinaComplianceContextService::CONTEXT_VERSION`). Updated after each Carina message via `syncConversationHash()`.

**Slash commands** (handled locally without an AI call when compliance is enabled):

| Command | Behaviour |
|---------|-----------|
| `/compliance-status` | Conversational summary of `ComplianceDashboardService::getSnapshot()` |
| `/compliance-urgent` | All red-status items across modules plus urgent deadline list |
| `/hmo-check [address]` | HMO licence status, fire safety log/FRA status, and HHSRS outcome for the matched property |

Implementation: `CarinaComplianceSlashCommandService`; wired in `CarinaService::chat()` and `CarinaAgentService::agentChat()`.

**Migration:** `database/migrations/tenant/2026_07_01_000016_add_compliance_context_to_carina.php`

**Tests:** `tests/Feature/Carina/CarinaComplianceContextTest.php`

## Complaints

**Table:** `complaint_cases`  
**Model:** `ComplaintCase` (SoftDeletes, Auditable; auto reference `CMP-YY-XXXXXX` on create)

**Routes:** `tenant.compliance.complaints.*` - index, create, store, show, edit, update, destroy

**Public website form (embed):**
- Live form: `GET /embed/complaints` (`tenant.embed.complaints`)
- API: `POST /api/v1/complaints` (`tenant.api.v1.complaints.store`) - JSON; channel `portal`; honeypot field `website`
- Shortcodes: iframe or `public/embed.js` with `data-propreneur-form="complaints"` (copy from **Compliance → Complaints → Website embed**)
- Service: `PublicComplaintSubmissionService`; notifies workspace admins via `NewPublicComplaintNotification`

## Compliance requirements & checks

**Tables:** `compliance_requirements`, `compliance_checks`  
**Models:** `ComplianceRequirement`, `ComplianceCheck`

Workspace-defined obligations (entity_type: workspace / property / deal / staff) with periodic checks logged inline on the requirements index.

**Routes:** `tenant.compliance.requirements.*` plus `POST .../requirements/{requirement}/checks`

## Regulatory profile (singleton)

**Table:** `regulatory_profile` (one row per workspace, `RegulatoryProfile::forWorkspace()` uses `id = 1`)

AML supervision, redress scheme, ICO, CMP, Companies House dates, internal notes.

**Routes:** `GET|PUT /compliance/regulatory` - `tenant.compliance.regulatory.edit|update`

## Rules engine

**`ComplianceRulesEngine`:** Per-property UK rules - EPC, gas safety, EICR, HMO, insurance, fire, PAT, deposit protection, **Right to Rent** (type `right_to_rent`). Returns score and findings for property compliance health.

**`ComplianceRagService`:** Carina RAG context for compliance guidance.

## Document vault

**`DocumentVaultService`:** Workspace `documents` with `compliance_item_id`, version chains. Compliance show lists vault heads; property vault unchanged on `PropertyDocument`.

## PDF export

**Route:** `GET /compliance/export/pdf` - `tenant.compliance.export.pdf`  
**View:** `tenant.compliance.pdf.report` (DomPDF, inline CSS)  
Summary counts + full item table with computed status badges.

## Scheduled tasks

`compliance:expiry-digest` accepts **`--days=N`** (`0` = expired-only digest).

**`routes/console.php` schedules:**
- `--days=60` - weekly Monday 08:00
- `--days=30`, `14`, `7`, `0` - daily 08:00
- `compliance:daily-digest` - daily 08:30 (unified RAG digest email to workspace admins when any red alerts exist; mailable `ComplianceDigestMail`, plain text view `emails.compliance-digest`)
- `compliance:hmo-renewal-reminders` - daily 08:45 (in-app notification + email to licence creator when `HmoLicence::isRenewalDue()`, throttled to once per 7 days per licence)

Central catalogue entry remains `compliance-expiry-digest` in `PlatformScheduleCatalog` (default 30-day window for platform-managed schedules).

## Notifications

`ComplianceExpiryNotification` - certificate-focused digest to workspace admins when expiring/expired items exist for the requested window.

`ComplianceDigestMail` - unified module snapshot digest (plain text) when `ComplianceDashboardService::countRedAlerts()` is greater than zero.

HMO licence renewal reminders use `InAppNotification` type `hmo_licence_renewal` plus `HmoLicenceRenewalReminderMail` to the creating user.

## Tests

- `tests/Feature/Compliance/ComplianceStarterChecklistTest.php`
- `tests/Feature/Compliance/ComplianceParityTest.php` - AML, complaints, requirements, regulatory singleton, PDF export (8 cases; uses `TenantCreationService` + tenant host pattern)
- `tests/Feature/Compliance/AmlDealLogTest.php` - per-deal AML log create, missing-deal query, `isHighRisk()`
- `tests/Feature/Compliance/ComplianceDashboardTest.php` - snapshot structure, certificate red count, enforcement exposure sum, hub UI
- `tests/Feature/Navigation/ComplianceNavTest.php` - dashboard, HMO licences, enforcement access; session badge integers; property compliance panel
- `tests/Feature/Tenant/ComplianceShowDocumentsTest.php`
- `tests/Feature/Documents/DocumentVaultVersioningTest.php`

**Build spec:** `brain/prompts/76-compliance-full-parity.md`

## Compliance module knowledge (Carina RAG)

Deep-dive docs for Prompts 1-16 modules (ingest with `php artisan rag:ingest-brain-knowledge --sync`):

| File | Topic |
|---|---|
| `94-compliance-audit-framework.md` | Audit plans, findings, actions (not system `audit_logs`) |
| `95-staff-compliance-training.md` | Mandatory staff training, MLR 2017 reg 24, certificate expiry |
| `96-tenancy-agreement-compliance.md` | TenancyAgreement vs PropertyTenancy, deposits, Section 8/21, RTR |
| `97-regulation-registry.md` | Twelve seeded UK regulations + requirement links |
| `98-hmo-licensing-workflow.md` | HMO licence lifecycle, Article 4, overcrowding |
| `98-rra-2025-compliance-centre.md` | PRS database, ombudsman, Decent Homes, pre-tenancy payments |
| `98-property-inspection-evidence.md` | Inspections, defects, tenant notice log |
| `99-hhsrs-hazard-assessment.md` | 29 HHSRS hazards, scoring, Cat 1/2 |
| `100-fire-risk-assessment-full.md` | Full FRA types, responsible person, defects |
| `102-enforcement-action-defence.md` | Enforcement notices, penalties, RRO, tribunal |
| `104-rent-review-section-13.md` | Section 13 rent reviews, Form 4, tribunal |
| `105-selective-licensing.md` | Selective licensing schemes and zones |
| `189-asbestos-water-safety.md` | Asbestos registers, legionella, water hygiene logs |
| `165-hmo-licensing-uk.md` | Short Carina HMO licensing primer |
| `166-hmo-fire-safety-carina.md` | Routine fire safety logs |
| `167-rra-2025-hmo-guide.md` | RRA operator guide (Section 8, Awaab's Law) |
| `117-compliance-deep.md` | Legacy compliance feature overview |

## Related

- Properties: compliance items + property document vault (`#vault-documents`)
- Deals: compliance items on `DealAnalysis`; pipeline AML on deal show
- Communications Hub: `compliance.expiring` trigger enrolls contacts from expiring items
- Platform: schedule catalog + multi-window console schedules
