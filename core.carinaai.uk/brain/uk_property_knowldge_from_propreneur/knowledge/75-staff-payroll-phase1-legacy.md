# Staff directory and payroll (phase 1)

**Module flag:** `hr_payroll`  
**Routes:** `/staff`, `/staff/payroll`, `/staff/my-payslips`  
**Last updated:** 2026-05-15

## What the product does today

Propreneur v2 supports an internal **pay cycle** for workspace staff:

1. HR profiles store job details and **annual salary** (optional), pay frequency, and payment method.
2. Admins create a **payroll run** for a date range (defaults to current calendar month).
3. Staff lines can be **added automatically** from salary profiles or entered manually (gross, PAYE tax, NI, other deductions).
4. **Finalise** posts wages to the ledger (expense 5100, liability 2200).
5. **Mark wages paid** clears liability to the bank (DR 2200, CR 1000).
6. Staff receive **payslips** online, as PDF, and by email.

This is **not** full HMRC payroll filing software. Tax and NI on each line are entered or suggested by salary; they are not computed from HMRC tax tables unless phase 2 is built.

## Automation (tenant settings)

On `/staff/payroll`, workspace admins can configure:

- **Auto-add staff lines** when creating a run (from HR salary profiles).
- **Auto-email payslips** when marking wages paid (default on).

Staff only see payslips after a run is **finalised** or **paid**.

## Payslip delivery

| Action | Result |
|--------|--------|
| View / Print | Browser payslip page |
| Download PDF | Server-generated PDF |
| Email | PDF attached; `payslip_sent_at` recorded |
| Mark paid (auto-send on) | Emails all staff with an email address who have not already been sent |

Payslips are **not** auto-sent on finalise in phase 1 (only when wages are marked paid, if automation is enabled).

## Feature flags

| Flag | Role |
|------|------|
| `hr_payroll` | Gates `/staff` routes with `subscription.feature:hr_payroll` |
| `payroll_ledger_integration` | When enabled (default), finalise posts DR 5100 / CR 2200 and mark paid posts DR 2200 / CR 1000. When disabled, run status still advances without journal entries |
| `accounting` | Required for ledger accounts 5100, 2200, and 1000 when ledger integration is on |

## Ledger accounts

| Code | Name | Use |
|------|------|-----|
| 5100 | Wages & Salaries | Expense on finalise |
| 2200 | Payroll Payable | Liability on finalise; cleared on mark paid |
| 1000 | Bank / Current Account | Credit on mark paid |

If account 1000 is missing, mark paid fails with a clear error directing the admin to Accounting.

## Future phase (HMRC-grade)

When the business requires RTI/FPS, automatic PAYE/NI from tax codes, pensions, P45/P60, or scheduled payroll, see:

- `brain/prompts/74b-hr-payroll-phase-2-hmrc.md`
- `brain/prompts/74-hr-payroll-implementation-status.md`

Do not tell users that RTI submission is available until phase 2 is implemented.

## Carina guidance

- Direct admins to **Staff → Payroll** for pay runs and **Staff directory → edit profile** for salary setup.
- For "submit to HMRC" or "automatic tax code" questions: explain phase 1 limits and that statutory payroll is planned as phase 2 when required.
- Amounts are stored in **pence**; display as pounds with two decimals.
