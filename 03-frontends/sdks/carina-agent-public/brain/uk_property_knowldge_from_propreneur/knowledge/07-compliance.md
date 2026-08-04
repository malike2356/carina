# Compliance Tracking

**Last updated:** 2026-05-15 (prompt **76** - v1 parity: AML, complaints, requirements, regulatory profile)

## Overview

Tracks regulatory certificates, licences, insurance policies, AML checks, complaints, workspace requirements, and regulatory registration. Provides expiry alerts, status tracking, document vault linking, and PDF portfolio export.

**Feature flag:** `compliance` (`BillingModule::Compliance`)  
**Routes:** `tenant.compliance.*`  
**Controllers:**
- `App\Http\Controllers\Tenant\ComplianceController` - certificate/licence CRUD, starter checklist, PDF export
- `App\Http\Controllers\Tenant\Compliance\AmlController` - AML records + staff training logs
- `App\Http\Controllers\Tenant\Compliance\ComplaintCaseController` - complaints CRUD
- `App\Http\Controllers\Tenant\Compliance\ComplianceRequirementController` - requirements + check logging
- `App\Http\Controllers\Tenant\Compliance\RegulatoryProfileController` - singleton workspace regulatory profile

**Services:** `ComplianceRulesEngine`, `ComplianceRagService`, `DocumentVaultService`, `ComplianceStarterChecklistService`, `AmlService`

**Nav (Fund & Close):** Compliance sub-group - Overview, AML, Complaints, Requirements, Regulatory profile (`resources/views/layouts/app.blade.php`).

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

Central catalogue entry remains `compliance-expiry-digest` in `PlatformScheduleCatalog` (default 30-day window for platform-managed schedules).

## Notifications

`ComplianceExpiryNotification` - digest to workspace admins when expiring/expired items exist for the requested window.

## Tests

- `tests/Feature/Compliance/ComplianceStarterChecklistTest.php`
- `tests/Feature/Compliance/ComplianceParityTest.php` - AML, complaints, requirements, regulatory singleton, PDF export (8 cases; uses `TenantCreationService` + tenant host pattern)
- `tests/Feature/Tenant/ComplianceShowDocumentsTest.php`
- `tests/Feature/Documents/DocumentVaultVersioningTest.php`

**Build spec:** `brain/prompts/76-compliance-full-parity.md`

## Related

- Properties: compliance items + property document vault (`#vault-documents`)
- Deals: compliance items on `DealAnalysis`; pipeline AML on deal show
- Communications Hub: `compliance.expiring` trigger enrolls contacts from expiring items
- Platform: schedule catalog + multi-window console schedules
