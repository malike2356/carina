# HR Payroll Phase 2 - HMRC PAYE and Pensions

**Last updated:** 2026-05-20

**Feature flag:** `hr_payroll_hmrc` (Phase 1 flag `hr_payroll` must also be enabled)

## Overview

Phase 2 extends the Phase 1 payroll system (see `113-staff-payroll.md`) with UK PAYE tax calculation, Class 1 National Insurance, pension auto-enrolment assessment, and HMRC Full Payment Submission (FPS) file export. No live RTI API submission - Phase 2 generates export files only.

## New tables added by Phase 2

| Table | Purpose | Key columns |
|---|---|---|
| `payroll_employer_settings` | Workspace-level PAYE/HMRC configuration | `paye_reference`, `accounts_office_reference`, `tax_year` (default `2024-25`), `rti_provider` (default `manual_export`) |
| `employee_tax_profiles` | Per-employee tax configuration | `user_id` (unique), `tax_code` (default `1257L`), `ni_category` (default `A`), `student_loan_plan` (default `none`), `week1_month1` (bool), `is_director` (bool) |
| `payroll_tax_year_summaries` | Year-to-date accumulators | `user_id`, `tax_year`, `ytd_gross_minor`, `ytd_tax_minor`, `ytd_ni_minor`; unique on `(user_id, tax_year)` |
| `payroll_fps_submissions` | FPS export records | `payroll_run_id`, `payload` (JSON), `status` (default `manual_export`), `hmrc_correlation_id`, `submitted_at` |
| `payroll_pension_schemes` | Pension scheme definitions | `name`, `provider_reference`, `employee_percent` (default 5.00), `employer_percent` (default 3.00), `earnings_basis` (default `qualifying`), `is_active` |
| `payroll_pension_assessments` | Per-run pension assessment per employee | `payroll_run_id`, `user_id`, `pension_scheme_id`, `status` (`eligible`/`non_eligible`/`entitled`), `employee_contribution_minor`, `employer_contribution_minor`; unique on `(payroll_run_id, user_id)` |

### Columns added to `staff_payroll_lines` in Phase 2

| Column | Description |
|---|---|
| `tax_override_minor` | Manual PAYE tax override (nullable) |
| `ni_override_minor` | Manual NI override (nullable) |
| `calculation_overridden` | Boolean flag - true if auto-calculation was manually overridden |

## PAYE calculation rates (2024/25)

| Rate / Threshold | Value |
|---|---|
| Personal Allowance | £12,570/year (1257L code) |
| Basic rate | 20% |
| Tax code `BR` | 20% flat, no allowance |
| Tax code `D0` | 40% flat |
| Tax code `D1` | 45% flat |
| NI Primary Threshold | £12,570/year |
| NI Upper Earnings Limit | £50,270/year |
| Employee NI (main band) | 8% |
| Employee NI (above UEL) | 2% |
| Employer NI rate | 13.8% above secondary threshold |

All monetary values stored as minor units (pence).

## How it works

### PayrollCalculationService::calculateMonthly()

Input: `EmployeeTaxProfile` + gross pay in pence. Returns:

```php
[
  'tax_minor'         => int,  // PAYE income tax deducted
  'ni_minor'          => int,  // Employee Class 1 NI
  'employer_ni'       => int,  // Employer Class 1 NI
  'net_minor'         => int,  // Take-home (gross - tax - employee NI)
  'taxable_pay_minor' => int,  // Gross minus personal allowance
]
```

### YTD accumulation

`PayrollCalculationService::recordYtd()` increments `ytd_gross_minor`, `ytd_tax_minor`, and `ytd_ni_minor` in `payroll_tax_year_summaries` for each employee and tax year. This is called whenever a payroll run line is finalised.

### Pension auto-enrolment (PensionAssessmentService)

Assesses each employee on each payroll run against auto-enrolment thresholds. Result statuses:

| Status | Meaning |
|---|---|
| `eligible` | Must be auto-enrolled immediately |
| `non_eligible` | Below threshold - can opt in voluntarily |
| `entitled` | Low earner - can join if they request it |

Each assessment is stored as a `payroll_pension_assessments` row linked to the payroll run and employee. Contributions are calculated using the pension scheme's `employee_percent` and `employer_percent` on qualifying earnings.

### FPS file export

`PayrollFpsExportService::buildFpsXml()` generates an HMRC Full Payment Submission XML file for a payroll run. The generated XML follows the RTI FPS schema. It is stored as a `payroll_fps_submissions` row with `status = manual_export`. The file is downloaded by the user and submitted to HMRC manually via HMRC's online portal or payroll bureau.

### Artisan commands

```bash
# Build FPS for a payroll run
php artisan payroll:build-fps {run_id}

# Process all scheduled payroll runs (runs daily at 06:00)
php artisan payroll:process-scheduled
```

## Routes

See `113-staff-payroll.md` for the full route list. Phase 2 adds:

```
GET  /staff/payroll/{run}/fps          Download FPS file (JSON or XML)
GET  /staff/payroll/employer-settings  Employer PAYE settings form
POST /staff/payroll/employer-settings  Save employer settings
POST /staff/payroll/{run}/calculate    Trigger PAYE calculation for all payroll lines
```

## Enabling Phase 2

Platform Admin > Feature Flags > enable `hr_payroll_hmrc` for the workspace. `hr_payroll` must already be enabled.

## Tests

- `tests/Feature/Staff/PayrollScheduledRunTest.php`
- `tests/Feature/Staff/PayrollFpsExportTest.php`
- `tests/Unit/Staff/` - unit tests for PAYE and NI calculations

## Carina context

Users may ask:
- "What is my employee's tax code?"
- "How much PAYE tax was deducted this month?"
- "Is [employee] auto-enrolled in a pension?"
- "Download the FPS file for this payroll run"
- "What is our PAYE reference number?"
- "What is the NI rate for category A employees?"
- "What tax year is the current payroll running?"

Carina should know:
- Phase 2 requires both `hr_payroll` and `hr_payroll_hmrc` feature flags enabled
- FPS is exported for manual submission - no live HMRC API connection exists
- Tax calculations use 2024/25 UK rates; rates are hardcoded in `PayrollCalculationService`
- `tax_override_minor` and `ni_override_minor` allow admins to manually correct individual payslip lines
- Pension auto-enrolment uses the workspace's defined pension scheme(s); employees can have multiple assessments across runs
