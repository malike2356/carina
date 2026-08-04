# Compliance audit framework

## Purpose

The compliance audit framework supports scheduled property and business audits conducted by or on behalf of the workspace. It is separate from the system activity audit trail (`audit_logs`, `audit_log_hashes`, `audit_retention_policies`), which records platform actions.

Use audit plans to schedule work, run audits against those plans, record findings linked to compliance requirements, and track remedial actions through to completion.

## Schema

| Table | Role |
|-------|------|
| `compliance_audit_plans` | Scheduled audit definition: scope, type, entity, auditor, status |
| `compliance_audits` | Conducted audit instance linked to a plan |
| `compliance_audit_findings` | Individual non-compliance or observation per audit |
| `compliance_audit_actions` | Remedial tasks raised from findings |

Key relationships:

- Plan `hasMany` audits
- Audit `belongsTo` plan, `hasMany` findings
- Finding `belongsTo` audit, optional `belongsTo` `compliance_requirements`, `hasMany` actions
- Action `belongsTo` finding, optional `belongsTo` user (`assigned_to_user_id`), optional evidence `documents` row

Entity types on plans and audits: `property`, `business`, `staff`.

Audit types: `internal`, `external`, `regulatory`.

## Plan status workflow

1. **planned** (default): audit scheduled, not yet started
2. **in_progress**: at least one audit has been started against the plan
3. **completed**: all audit work for the plan is finished (set manually when appropriate)
4. **cancelled**: plan withdrawn

Starting an audit via the service sets the plan from `planned` to `in_progress` and creates a draft `compliance_audits` row with `conducted_date` set to today.

RAG on the plan index:

- **Red (overdue)**: `status = planned` and `scheduled_date` before today
- **Amber (due soon)**: `status = planned` and `scheduled_date` within the next 14 days
- **Green (on track)**: otherwise for active planned work

## Audit and finding status

Audit record status: `draft` or `finalised`.

Finding fields:

- **risk_level**: `low`, `medium`, `high`, `critical` (UI colour: green, amber, red for high/critical)
- **compliance_status**: `compliant`, `non_compliant`, `partial`, `not_applicable`

## Action status lifecycle

| Status | Meaning |
|--------|---------|
| `open` | New action, not started |
| `in_progress` | Work underway |
| `overdue` | Past due date while still open or in progress |
| `completed` | Closed with optional completion notes and evidence document |

Completing an action sets `status` to `completed`, stamps `completed_at`, and may attach `evidence_document_id` from the workspace document vault.

## Routes and UI

Tenant routes under `/compliance/audit-plans` (name prefix `tenant.compliance.audit.`):

- List, create, edit, show, delete plans
- Start audit on a plan
- Add findings to an audit, actions to a finding, complete actions

## Carina help context

When users ask about compliance audits, audits, or remedial actions:

- Distinguish **compliance audits** (this module) from **system audit logs** (activity history).
- Plans schedule work; audits are the executed review; findings cite gaps; actions are remediation tasks.
- Link findings to `compliance_requirements` where a workspace rule already exists.
- Evidence for completed actions can reference rows in `documents` (document vault).
- Overdue plans are those still `planned` after `scheduled_date`; open actions for a user are those assigned with status `open`, `in_progress`, or `overdue`.
- UK landlords often run internal HMO or licensing checks, external inventory audits, and regulatory visits; map `audit_type` and `entity_type` accordingly when advising.

Service entry point: `App\Services\Compliance\ComplianceAuditService`.
