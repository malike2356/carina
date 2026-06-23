# Module 5 - Accounting (general ledger)

**Last updated:** 2026-05-14 (bank CSV reconciliation: `bank_transactions`, import and auto-match UI; Carina hub surface `reconciliation`)

## Purpose

Give each workspace an in-platform **double-entry** general ledger so property investors can record books next to deals, properties, and pipeline data without exporting to external accounting products for basic journals and trial balance. This phase is the **foundation** (chart of accounts, journals, posting, trial balance, API, Carina context). VAT returns, bank feeds, payroll, and full replacement for Sage / QuickBooks / FreeAgent-style compliance workflows are **later phases**.

## Tenant schema

| Table | Role |
|-------|------|
| `gl_accounts` | Chart of accounts: `code`, `name`, `type` (`asset`, `liability`, `equity`, `income`, `expense`), optional `parent_id`, `is_system`, `is_active`, `sort_order`, `metadata` JSONB |
| `journal_entries` | Header: `entry_date`, `reference`, `description`, `status` (`draft` \| `posted`), optional `property_id`, `deal_analysis_id`, `user_id` (creator), `posted_at`, optional `integration_metadata` JSONB (external system refs, e.g. Xero / QuickBooks) |
| `journal_lines` | Lines: `gl_account_id`, optional `property_id` (tenant `properties`; line-level split for P&L), `memo`, optional `vat_treatment` (`App\Accounting\VatLineTreatment`: standard, reduced, zero_rate, exempt, outside_scope, reverse_charge, marginal), `debit_minor`, `credit_minor`, `sort_order` |
| `bank_transactions` | Imported bank statement rows: `gl_account_id` (bank GL the CSV belongs to), `transaction_date`, `description`, signed `amount_minor` (positive = money in per export convention, negative = out), `source` (`csv` \| `manual` \| `open_banking`), `status` (`unmatched` \| `matched` \| `excluded`), optional `matched_journal_line_id`, `import_batch`, `raw_csv_row` |

Amounts are stored in **minor units** (pence when the workspace currency is GBP) as non-negative integers. Each line must have **either** a debit **or** a credit, not both. Posted journals must balance: sum of debits equals sum of credits.

## Default chart

On first use (empty `gl_accounts`), the service seeds a **UK landlord-oriented** default set (bank, debtors, creditors, VAT control, equity, rental income, repairs, management fees, insurance, finance costs, legal, utilities). System codes can be extended with `POST /api/accounting/accounts` (custom accounts are not `is_system`).

## HTTP API (authenticated tenant JSON)

All under host `{slug}.…` with prefix `/api/accounting/`:

- `GET /api/accounting/accounts` - list active GL accounts  
- `GET /api/accounting/accounts/{id}/activity?from=&to=` - posted lines for that account with opening balance, signed movement per line, and running balance (max 366 days; read; `{id}` is the `gl_accounts.id`)  
- `POST /api/accounting/accounts` - create custom account (`code`, `name`, `type`, optional `parent_id`)  
- `GET /api/accounting/journal-entries` - paginated list (`status`, `per_page`)  
- `POST /api/accounting/journal-entries` - create **draft** (`entry_date`, `reference`, `description`, optional header `property_id`, `deal_analysis_id`, optional `integration_metadata` object, `lines[]` where each line may include optional `property_id`, `vat_treatment`)  
- `PUT /api/accounting/journal-entries/{id}` - replace header and lines for a **draft** only (`manage-accounting`; returns 403 if posted); omit `integration_metadata` in the body to leave the existing value unchanged  
- `GET /api/accounting/journal-entries/{id}` - draft or posted with lines  
- `POST /api/accounting/journal-entries/{id}/post` - post a draft (idempotent guard in service)  
- `GET /api/accounting/trial-balance?as_of=Y-m-d` - posted activity on or before date; `totals.debit_minor` equals `totals.credit_minor` when data is consistent  
- `GET /api/accounting/exports/accounts.csv` - UTF‑8 BOM chart of accounts (read permission)  
- `GET /api/accounting/exports/journal-entries.csv` - optional `from`, `to`, `status` query filters (read); columns include `integration_metadata_json`, `entry_property_id`, `line_property_id`, `vat_treatment`  
- `GET /api/accounting/exports/trial-balance.csv?as_of=Y-m-d` - trial balance as CSV (read)  
- `GET /api/accounting/properties/{id}/profit-and-loss?from=&to=` - posted lines where `journal_lines.property_id` matches, or lines with no line property when the **journal header** `property_id` matches (default allocation); aggregates **income** and **expense** GL types into `income_minor`, `expense_minor`, `net_operating_minor`, plus `by_account` (max range 366 days; `{id}` is `properties.id`)  

**Gating:** `subscription.feature:accounting` and `feature:accounting`. `BillingModule::Accounting` is included in all `config/billing.php` module sets (`starter`, `operator`, `mentor`, `trial_expanded`).

**Permissions (Spatie, guard `web`):** `view-accounting` (lists, JSON reads, CSV exports, property P&L); `manage-accounting` (create custom accounts, create/post journals). Middleware alias `tenant.accounting.permission:view` or `:manage`. Seeded roles: **`tenant_admin`** (view+manage), **`team_member`**, **`viewer`**, **`mentor`**, **`mentee`** (view), **`finance_clerk`** (view+manage), **`external_accountant`** (view only). Migration: `2026_05_02_640000_add_accounting_permissions_and_roles`.

## Blade UI (shipped with module; extend UI whenever a new accounting phase lands)

- `GET /accounting` - journal list, CSV quick links, nav to other screens  
- `GET /accounting/chart` - read-only chart table; **Add custom account** form when user has `manage-accounting`  
- `GET /accounting/trial-balance` - as-of filter, on-screen totals, CSV download link  
- `GET /accounting/profit-and-loss` - property picker + date range + headline totals and `by_account` table  
- `GET /accounting/journals/create` - multi-line draft journal (up to 8 lines, pence) with optional **Property** and **VAT** per line, optional integration JSON textarea, when user has `manage-accounting`  
- `POST /accounting/journals` - store draft (redirects to journal detail)  
- `GET /accounting/journal/{id}` - lines (with property column: explicit line property, journal default label, or dash), optional **Edit draft** and **Post journal** (draft + manage), **Ask Carina** when Carina module is on (`{id}` = `journal_entries.id`)  
- `GET /accounting/journal/{id}/edit` - edit draft (same line layout as create; manage only)  
- `PUT /accounting/journal/{id}` - save draft changes  
- `POST /accounting/journal/{id}/post` - post draft  
- `POST /accounting/chart` - create custom GL account  
- Property portfolio **`/properties/{id}`** includes **Ledger accounting** card linking to the P&L report for that property when the accounting module is visible in nav  
- `GET /accounting/reconciliation` - bank statement CSV import, auto-match to posted journals, exclude rows (`manage-accounting` only); nav link **Reconciliation** is shown only to users who can manage accounting  

## Carina integration

- **Journal route:** `GET /carina/open-journal-entry/{id}` (`tenant.carina.fromJournalEntry`), additionally gated by accounting subscription + feature.  
- **Accounting hub route:** `GET /carina/open-accounting/{surface}` (`tenant.carina.fromAccountingHub`) where `surface` is one of `journals`, `expenses`, `integrations`, `reconciliation`, `chart`, `ledger`, `trial-balance`, `balance-sheet`, `income-statement`, `portfolio-cashflow`, `pnl`; requires Carina AI + accounting + `view-accounting`. Creates a thread with `metadata.accounting_hub` and a live GL snapshot in the system prompt.  
- **Conversation context (journal):** `context_type = journal_entry`, `context_id` = journal id.  
- **System prompt (journal):** status, entry date, `posted_at` when posted, reference, description, debit/credit totals and balanced flag, optional `integration_metadata`, line summary (codes, names, DR/CR, optional `vat_treatment`, property hint), linked property or deal analysis.  
- **RAG query bias:** UK bookkeeping, VAT, landlord income and expenses; extended bias when `accounting_hub` metadata is set.  
- **Programmatic threads:** `POST /carina/conversations` accepts `context_type` `journal_entry` with `context_id`.  

`CarinaConversation::resolveContextModel()` returns the `JournalEntry` for tooling that resolves context (hub threads have `context_type` null).

## Services

- `App\Services\Accounting\ChartOfAccountsService` - `ensureDefaultAccounts()`  
- `App\Services\Accounting\JournalPostingService` - `createDraft(...)`, `updateDraft(JournalEntry, ...)`, `post(JournalEntry)`  
- `App\Services\Accounting\TrialBalanceService` - `asOf(date)`  
- `App\Services\Accounting\AccountingCsvExportService` - streamed CSV downloads (BOM for Excel)  
- `App\Services\Accounting\PropertyProfitAndLossService` - `forProperty(Property, from, to)`  
- `App\Services\Accounting\GlAccountActivityService` - `forAccount(GlAccount, from, to)` (posted-only ledger; signed running balance by account type)  
- `App\Services\Accounting\BankCsvImportService` - parses Barclays, Lloyds, HSBC, or Monzo UK CSV headers into `bank_transactions` for a chosen asset (bank) `gl_account_id`  
- `App\Services\Accounting\BankReconciliationService` - `autoMatch(import_batch)` links unmatched rows to **posted** `journal_lines` on the **same** `gl_account_id` where entry date is within three days of the bank row and the amount matches the ledger side: **money in** on the CSV (positive `amount_minor`) matches the bank line **debit** (same pattern as quick income: debit bank, credit income); **money out** matches the bank line **credit**. Already-used journal lines (another matched `bank_transactions` row) are skipped via `NOT EXISTS`. `exclude()` sets status `excluded`. `confirmMatch()` exists for future manual pairing UI.  

`BookkeepingService` (Carina) remains available for rule-based categorisation of **external** transaction arrays; imported rows live in `bank_transactions` and can align to `journal_lines` via the reconciliation service.

## Phase 6 (2026-05-06): integration metadata, VAT on lines, Carina hub

- Tenant migration adds `journal_entries.integration_metadata` (JSONB) and `journal_lines.vat_treatment` (nullable string, enum-validated).  
- Journal export CSV and API JSON expose these fields.  
- Accounting nav **Ask Carina** opens the hub thread for the current screen.  

## Phase 5 (2026-05-03): GL account activity (ledger drill-down)

- `GlAccountActivityService` computes opening balance from posted lines before `from`, then period lines ordered by entry date with running balance (asset/expense: debit minus credit; liability/equity/income: credit minus debit).  
- JSON `GET .../accounts/{id}/activity`; Blade **`/accounting/ledger`** and chart **Ledger** shortcuts.  
- Supports cash-style review of the bank GL (code `1000`). **Bank reconciliation** adds CSV imports into `bank_transactions` and auto-match to posted `journal_lines` on that bank GL (see section below).

## Phase 4 (2026-05-03): edit draft journals

- `JournalPostingService::updateDraft` replaces header fields and all lines inside a tenant transaction (existing lines deleted then re-inserted).  
- `UpdateJournalEntryRequest` extends store rules and requires the route `journal_entry` to be a draft (`authorize`).  
- Tenant routes `tenant.accounting.journal.edit` / `tenant.accounting.journal.update`; API `tenant.api.accounting.journal-entries.update`.

## Phase 3 (2026-05-03): line-level property

- Tenant migration `2026_05_03_210000_add_property_id_to_journal_lines` adds nullable `property_id` on `journal_lines`.  
- `PropertyProfitAndLossService` includes a line when `journal_lines.property_id` matches the report property, or when the line has no `property_id` and the journal header `property_id` matches (backward compatible with phase 1-2 data).  
- API journal JSON lines include `property_id`; journal export CSV uses `entry_property_id` and `line_property_id`.  
- Carina journal context line summaries append `@ address` when a line has a linked property.

## Bank CSV reconciliation (2026-05-14)

- Tenant migration `2026_05_20_200000_create_bank_transactions_table.php`.  
- Routes (middleware `tenant.accounting.permission:manage`): `tenant.accounting.reconciliation.index`, `.import`, `.transactions.exclude`.  
- No Open Banking or live feeds in this phase; no draft journal creation from unmatched rows in the first UI pass (follow-up).  
- Pest: `tests/Feature/Accounting/BankReconciliationTest.php` (Blade 200, CSV import counts, auto-match against a posted bank line).  

## Tests

`tests/Feature/Accounting/AccountingApiTest.php` - happy path includes GL activity, opening-balance carry-forward, trial balance CSV, P&L validation (`from` after `to` → 422), activity query validation, PUT draft with line `property_id`, posted PUT 403, `external_accountant` reads (accounts, activity, journal list, trial balance, CSV) plus denied POST/PUT journals and POST accounts, subscription gate. `tests/Feature/Accounting/AccountingWebUiTest.php` - all main accounting Blade routes, draft show/edit, posted edit 403, read-only ledger/chart/index access. `tests/Feature/Accounting/BankReconciliationTest.php` - reconciliation hub and CSV import / auto-match.

## Roadmap (not built yet)

Live Open Banking feeds (vs CSV upload only), manual match UI calling `confirmMatch`, draft journals from unmatched imports, recurring journals, multi-currency, fixed assets, CIS, corporation tax packs, and full cash-flow (balance sheet movement) reports beyond single-account activity.
