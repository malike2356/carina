# Tenant invoicing and receipts (v2)

## Purpose

Workspace users with the **Accounting** module can raise **sales invoices**, email PDFs to clients, record **payments** (generating **receipts**), optionally create a **draft journal** for bank vs sales GL lines, and run **overdue** maintenance from the scheduler.

## Where it lives

| Area | Location |
|------|----------|
| Routes | `routes/tenant_invoicing.php` (included from `routes/tenant.php` after the accounting route groups) |
| Models | `App\Models\Tenant\{Invoice, InvoiceLine, Receipt, InvoiceSequence}` |
| Services | `App\Services\Accounting\{InvoiceService, ReceiptService, InvoiceSequenceService}` |
| Web UI | `/accounting/invoices/*`, `/accounting/receipts/*` (Blade under `resources/views/tenant/accounting/invoices/` and `receipts/`) |
| PDF | DomPDF views: `tenant/accounting/invoices/pdf.blade.php`, `tenant/accounting/receipts/pdf.blade.php` (inline CSS only) |
| Mail | `App\Mail\Accounting\{InvoiceMail, ReceiptMail, OverdueInvoiceReminderMail}` + Markdown templates under `resources/views/mail/accounting/` |
| Commands | `invoices:mark-overdue` (daily 06:00), `invoices:send-overdue-reminders` (daily 08:00) in `routes/console.php` |

## Access control

Same pattern as other accounting Blade routes:

1. `subscription.feature:accounting`
2. `feature:accounting`
3. `tenant.accounting.permission:view` for list/show/PDF
4. `tenant.accounting.permission:manage` for create/edit/send/mark paid/void/delete and receipt create/send

## Invoice lifecycle

1. **Draft** - no `invoice_number`; lines editable; soft-delete allowed.
2. **Send** - allocates `INV-{YEAR}-{NNNNNN}` from `invoice_sequences` (row locked per type/year), sets `sent_at`, status **sent**, queues `InvoiceMail` with PDF if `client_email` is set.
3. **Payments** - `markPaid` allocates `RCP-{YEAR}-{NNNNNN}`, creates `receipts` row, increments `amount_paid_minor`, sets **paid** or **partially_paid**, optional `JournalPostingService::createDraft` (debit GL 1000, credit GL 4000) when `post_to_journal` is true.
4. **Overdue** - `invoices:mark-overdue` sets status **overdue** when `due_date` is before today and status was **sent** or **partially_paid**.
5. **Reminders** - `invoices:send-overdue-reminders` queues `OverdueInvoiceReminderMail` once per invoice (`overdue_reminder_sent_at` set when email is queued).
6. **Void** - allowed only when no payments recorded (`amount_paid_minor` is zero and status is not **paid**).

## Amounts

All monetary fields are **integer minor units** (pence) on `invoices`, `invoice_lines`, and `receipts`. Line net is `round(quantity * unit_price_minor)`; line VAT is `round(net * tax_rate_pct / 100)` when a rate is present.

## Shortcuts

- Pipeline deal acquisition documents page: **Create invoice** (prefills contact, property, pipeline deal query params).
- Contact profile header: **Invoice this contact** (`contact_id` query param on create).

## Carina

When helping users, prefer routes `tenant.accounting.invoices.*` and `tenant.accounting.receipts.*`. Mentorship billing uses separate `mentorship_invoices` tables and flows; do not confuse with this module.
