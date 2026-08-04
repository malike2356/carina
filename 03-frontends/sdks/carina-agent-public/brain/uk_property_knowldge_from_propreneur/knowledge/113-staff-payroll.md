# Staff & Payroll (Phase 1 + Phase 2 HMRC)

**Last updated:** 2026-05-20
**Module flags:** `hr_payroll` (Phase 1) · `hr_payroll_hmrc` (Phase 2 PAYE/FPS)
**Routes:** `/staff`, `/staff/payroll`, `/staff/my-payslips`

## Overview

Staff management and payroll processing for property business workspaces. Phase 1 covers staff profiles, pay cycle, leave management, and basic payslips. Phase 2 adds UK PAYE tax calculation, NI computation, pension auto-enrolment assessment, and HMRC FPS (Full Payment Submission) file export.

## Phase 1 - Staff profiles and pay cycle

- Staff records: job title, department, salary, pay frequency, payment method
- Payroll runs: draft → processing → paid lifecycle
- Per-employee payslip lines: gross pay, deductions, net pay, tax codes, NI (employee + employer), pension contributions
- Leave management: annual/sick/maternity/paternity/unpaid with approval workflow
- HMRC reporting: tax year data for HMRC submissions
- Accounting integration: payroll runs link to journal entries

## Phase 2 - UK PAYE calculation (`hr_payroll_hmrc`)

### Tax year

`PayrollCalculationService` implements simplified UK 2024/25 monthly PAYE and Class 1 NI (category A):

| Rate | Value |
|------|-------|
| Personal Allowance | £12,570/year (1257L code) |
| Basic rate | 20% |
| Tax code BR | 20% flat (no allowance) |
| Tax code D0 | 40% flat |
| Tax code D1 | 45% flat |
| NI Primary Threshold | £12,570/year |
| NI Upper Earnings Limit | £50,270/year |
| Employee NI main rate | 8% |
| Employee NI additional rate | 2% |
| Employer NI rate | 13.8% above secondary threshold |

All monetary values stored in pence (minor units).

### `PayrollCalculationService::calculateMonthly()`

Input: `EmployeeTaxProfile` + gross pay in pence. Returns:
```php
[
  'tax_minor'        => int,  // PAYE tax deducted
  'ni_minor'         => int,  // Employee NI
  'employer_ni'      => int,  // Employer NI
  'net_minor'        => int,  // Take-home pay
  'taxable_pay_minor'=> int,  // Gross minus allowance
]
```

### Employee Tax Profile (`employee_tax_profiles`)

Per-employee record attached to staff member: `tax_code` (default `1257L`), `ni_category` (default `A`), `student_loan_plan`, `is_director`, `starter_declaration`.

### Employer Settings (`payroll_employer_settings`)

Workspace-level: `employer_paye_ref`, `employer_accounts_ref`, `hmrc_sender_id`, `smp_recovery_rate`, `pension_provider`, `pension_staging_date`.

### Pension auto-enrolment (`PensionAssessmentService`)

Assesses each employee against auto-enrolment thresholds. Result stored in `payroll_pension_assessments`:
- `eligible` - must be auto-enrolled
- `non_eligible` - can opt in
- `entitled` - can join if they ask

### FPS export (`PayrollFpsExportService`)

Generates HMRC Full Payment Submission:
- JSON structure matching RTI FPS schema
- XML wrapper (`buildFpsXml()`) for file download
- Stored as `payroll_fps_submissions` record with `status` (draft → submitted)
- **Disclaimer:** Export-only. No live HMRC RTI API submission in this phase.

### FPS artisan command

```bash
php83 artisan payroll:build-fps {run_id}
```

### Scheduled processing

```bash
php83 artisan payroll:process-scheduled
```
Runs daily at 06:00. Processes all payroll runs in `scheduled` state for the current pay period.

### YTD accumulation

`PayrollCalculationService::recordYtd()` accumulates `ytd_gross_minor`, `ytd_tax_minor`, `ytd_ni_minor` in `payroll_tax_year_summaries` per employee per tax year.

## Routes

```
GET  /staff                           staff index
GET  /staff/{user}/payroll            payroll detail
GET  /staff/payroll                   payroll run index
POST /staff/payroll                   create run
GET  /staff/payroll/{run}             run detail / payslips
POST /staff/payroll/{run}/calculate   trigger PAYE calculation for all lines
GET  /staff/payroll/{run}/fps         download FPS file (JSON or XML)
GET  /staff/payroll/employer-settings employer settings form
POST /staff/payroll/employer-settings save employer settings
GET  /staff/my-payslips               employee self-service payslips
```

## Tests

- `tests/Feature/Staff/PayrollScheduledRunTest.php` - scheduled run processing
- `tests/Feature/Staff/PayrollFpsExportTest.php` - FPS JSON/XML structure
- `tests/Unit/Staff/` - unit tests for PAYE/NI calculations

## Enable Phase 2

Platform admin → Feature Flags → enable `hr_payroll_hmrc` for the workspace. Phase 1 (`hr_payroll`) must also be enabled.
