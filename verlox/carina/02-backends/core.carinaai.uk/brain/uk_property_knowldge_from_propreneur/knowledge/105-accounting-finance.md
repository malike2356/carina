# Accounting & Finance

**Last updated:** 2026-05-17

## Overview
Full double-entry accounting engine built for property entrepreneurs. Manage your chart of accounts, post journal entries, generate balance sheets and profit & loss statements (per workspace and per property), reconcile bank transactions, import CSV bank statements, track expenses with receipt uploads, create invoices, and connect to external accounting tools like FreeAgent, Xero, QuickBooks, Sage, and Zoho.

## Core Features
- **Chart of Accounts** - 14 default accounts pre-configured for UK property investors (bank, rent debtors, deposits, creditors, VAT, owner funds, rental income, repairs, management fees, insurance, finance, legal, utilities, other income)
- **Double-entry journal posting** - Create draft entries, post them (draft-to-posted is final), with debit/credit validation
- **Balance Sheet** - See assets, liabilities, and equity at any point in time
- **Profit & Loss** - Workspace-wide or per-property P&L for any date range (max 365 days)
- **Trial Balance** - Full account-level listing with cumulative balances
- **Bank Reconciliation** - Import CSV bank statements, auto-match transactions against journal entries (±3 days)
- **Expense Tracking** - Log expenses with category, payment method, and receipt uploads
- **Invoicing** - Create, send, and track invoices with auto-numbering, overdue detection, and payment recording
- **Accounting Integrations** - Connect to FreeAgent, Xero, QuickBooks, Sage, or Zoho for syncing
- **Cash Flow** - Aggregate cash flow view across all properties

## Getting Started
1. Your chart of accounts is pre-populated with 14 standard UK property accounts - no setup needed
2. Start by posting journal entries for your transactions
3. Import bank statements via CSV and reconcile against posted entries
4. Create invoices for rental income or services
5. Connect external accounting tools if you want to sync data

## Key Workflows

### Posting a journal entry
Create a draft with your date, reference, and line items (each with a GL account, either a debit or credit, and optional property allocation). Review and post - once posted, entries cannot be modified or deleted.

### Per-property P&L
Each journal line can be allocated to a specific property. The system uses line-level allocation first, falling back to the journal header property if no line-level allocation exists. This gives you true per-property profitability views.

### Bank reconciliation
Upload your CSV bank statement. The system auto-matches transactions against journal entries by amount, GL account, and date (±3 days tolerance). You can manually match or exclude transactions. Each journal line can only be matched to one bank transaction.

### Invoicing
Create invoices with line items (quantity, unit price, tax rate). Auto-numbering resets yearly. Send to clients, record payments (partial payments supported), and the system automatically flags overdue invoices. Void invoices if needed.

## Business Rules
- Every journal must have equal total debits and credits - unbalanced entries won't save
- Each journal line must be either a debit or a credit, never both
- Journal lines can only reference active GL accounts
- Posted journals are final - no edits or deletions
- P&L date range is capped at 365 days per request
- All amounts stored in pence (minor units) for precision
- Expense receipt files are automatically removed when the expense is deleted

## Best Practices
- Use per-property allocation on journal lines from day one for accurate property-level P&L
- Reconcile bank statements monthly to keep accounts accurate
- Store receipts digitally with every expense for HMRC compliance
- Review the trial balance quarterly to catch any out-of-balance entries early
- Use integration syncing to save double-entry time if you already use FreeAgent or Xero

## Related Features
- **Lead Funnel** - Expense and invoice data can feed back into deal analysis
- **Refurbishment** - Refurb costs can be posted as expenses with journal links
- **Staff & Payroll** - Payroll runs link to journal entries
