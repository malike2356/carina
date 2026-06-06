# Nexio - Per-room deposit protection + Right to Rent (Prompt 219)

## Part A: Multi-deposit (per tenancy)

Columns on `property_tenancies`:

- `deposit_protection_scheme` - tds / dps / mydeposits / none
- `deposit_scheme_reference`
- `deposit_received_at`, `deposit_protected_at`, `prescribed_info_served_at`
- `deposit_protection_status` - unprotected / protected / expired

Service: `App\Services\Properties\DepositProtectionService`

- `checkProtectionDeadline()` - 30-day window for protection + PI
- `getUnprotectedDeposits()`, `getOverduePI()`
- `syncDepositProtectionStatus()` / `applyDepositFields()`

UI: tenant dossier **Deposit protection** section; HMO compliance page **Deposit protection - at risk** list; `ComplianceScore` breakdown area `deposit`.

## Part B: Right to Rent (HMO)

Columns: `r2r_check_type`, `r2r_document_expiry`, `r2r_recheck_due_at`, `r2r_status` (plus existing `right_to_rent_check_date`, `right_to_rent_status`).

Service: `App\Services\Properties\RightToRentService`

- `recordR2rCheck()` - sets re-check from document expiry
- `getReChecksOverdue()`, `getReChecksDueSoon()`
- `checkRecheckReminders()` - mail + database notifications

Notification: `RightToRentRecheckNotification`

Schedule: `hmo:r2r-recheck-reminders` (daily 09:00)

Compliance breakdown area: `right_to_rent`

## Tests

- `tests/Feature/Properties/DepositProtectionTest.php`
- `tests/Feature/Properties/RightToRentTest.php`

## Carina

See `169-deposit-protection-hmo.md` and `167-rra-2025-hmo-guide.md`.
