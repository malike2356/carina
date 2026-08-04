# Bank Transactions and Reconciliation

**Last updated:** 2026-05-20

## Overview

The Bank Transactions module is part of the Accounting module. It lets users import bank statement CSV exports into the platform and reconcile each transaction against double-entry journal lines. Unmatched transactions are queued for manual or auto-matching. This closes the loop between the accounting ledger and the actual bank feed, enabling accurate reconciliation without a direct Open Banking connection.

## Key tables

| Table | Key columns |
|---|---|
| `bank_transactions` | `id`, `gl_account_id` (nullable FK to `gl_accounts`), `transaction_date` (date), `description` (max 500), `amount_minor` (bigint, signed pence - positive = credit, negative = debit), `source` (default `csv`), `status` (`unmatched`/`matched`/`excluded`), `matched_journal_line_id` (nullable FK to `journal_lines`), `import_batch` (64 char identifier), `raw_csv_row`; indexed on `(status, transaction_date)` and `gl_account_id` |

## Routes / entry points

Routes are under the tenant accounting section.

| Route | Method | Controller action | Description |
|---|---|---|---|
| `GET /accounting/reconciliation` | GET | `BankReconciliationController::index` | List transactions filtered by status |
| `POST /accounting/reconciliation/import` | POST | `BankReconciliationController::import` | Upload a CSV file and auto-match |
| `POST /accounting/reconciliation/{transaction}/exclude` | POST | `BankReconciliationController::exclude` | Mark a transaction as excluded |

## How it works

### Importing a bank CSV

1. User navigates to Accounting > Bank Reconciliation.
2. User selects a bank CSV file (max 2 MB, `.csv` or `.txt`) and chooses the GL account the bank account maps to (must be an `Asset` type GL account).
3. `BankReconciliationController::import` calls `BankCsvImportService::import()`.
4. The importer parses the CSV, creates `bank_transactions` rows with `status = unmatched`, and tags all rows with a shared `import_batch` UUID.
5. On success, `BankReconciliationService::autoMatch()` runs immediately on the batch.

### Auto-matching

`BankReconciliationService::autoMatch()` chunks through all `unmatched` transactions in the batch (100 at a time) and calls `findMatchingLine()` for each.

Matching criteria:
- Journal entry status must be `posted`
- Journal entry date within 3 days of the bank transaction date
- Journal line's `gl_account_id` matches the bank transaction's `gl_account_id`
- For a credit (positive `amount_minor`): `journal_lines.debit_minor` equals `abs(amount_minor)`
- For a debit (negative `amount_minor`): `journal_lines.credit_minor` equals `abs(amount_minor)`
- The journal line must not already be matched to another bank transaction

On a match, the transaction is updated to `status = matched` with `matched_journal_line_id` set.

### Transaction statuses

| Status | Meaning |
|---|---|
| `unmatched` | Imported but no corresponding journal line found |
| `matched` | Reconciled against a specific `journal_lines` row |
| `excluded` | Manually excluded (e.g. internal transfers, duplicates) |

### Manual operations

- **Exclude**: marks a transaction as `excluded` via `BankReconciliationService::exclude()`. Used for transfers between own accounts or known non-operating items.
- **Confirm match**: `BankReconciliationService::confirmMatch(tx, line)` manually links a transaction to a specific journal line (for cases where auto-match fails but the user can identify the correct line).

### Amounts

`amount_minor` is signed pence. Positive values are credits (money in), negative are debits (money out). `BankTransaction::amountFormatted()` returns a string like `+£1,250.00` or `-£340.00`. `BankTransaction::isCredit()` returns true when `amount_minor > 0`.

### Summary display

The index page shows counts for all three statuses. Users can filter by `status` via query string (`?status=unmatched`, `?status=matched`, `?status=excluded`).

## Carina context

Carina has access to bank transaction data via `AccountingToolHandler`. Relevant questions:

- "How many unmatched bank transactions do I have?"
- "Show me unreconciled transactions for this month"
- "Why is a transaction not matching?"
- "What is my bank reconciliation status?"
- "How do I import a Barclays CSV?"

Carina should know:
- Transactions are imported per bank account (GL account)
- Auto-matching uses 3-day date tolerance and exact amount match
- Excluded transactions are intentionally ignored - not errors
- Matched transactions indicate the journal ledger agrees with the bank statement
- Direct Open Banking connection is not implemented; reconciliation is always CSV-based
