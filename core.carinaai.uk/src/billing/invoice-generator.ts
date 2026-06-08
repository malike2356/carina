import type Stripe from 'stripe';
import { pool } from '../memory/db.js';

export interface InvoiceRecord {
  id: string;
  tenant_id: string;
  stripe_invoice_id: string;
  amount: number;
  status: string;
  pdf_url: string | null;
  period_start: Date | null;
  period_end: Date | null;
}

function dateFromUnix(value: number | null | undefined): Date | null {
  return typeof value === 'number' ? new Date(value * 1000) : null;
}

export class InvoiceGenerator {
  async recordStripeInvoice(invoice: Stripe.Invoice): Promise<void> {
    const customerTenantId =
      typeof invoice.customer === 'object' &&
      invoice.customer !== null &&
      !invoice.customer.deleted
        ? invoice.customer.metadata?.tenantId
        : undefined;
    const tenantId = invoice.metadata?.tenantId ?? customerTenantId;
    if (!tenantId) return;
    await pool.query(
      `INSERT INTO invoices
        (tenant_id, stripe_invoice_id, amount, status, pdf_url, period_start, period_end, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (stripe_invoice_id)
       DO UPDATE SET status = EXCLUDED.status, pdf_url = EXCLUDED.pdf_url`,
      [
        tenantId,
        invoice.id,
        invoice.amount_due,
        invoice.status ?? 'unknown',
        invoice.invoice_pdf ?? null,
        dateFromUnix(invoice.period_start),
        dateFromUnix(invoice.period_end),
      ],
    );
  }

  async listInvoices(tenantId: string): Promise<InvoiceRecord[]> {
    const result = await pool.query<InvoiceRecord>(
      `SELECT id, tenant_id, stripe_invoice_id, amount, status, pdf_url, period_start, period_end
       FROM invoices
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [tenantId],
    );
    return result.rows;
  }

  async getInvoice(tenantId: string, invoiceId: string): Promise<InvoiceRecord | null> {
    const result = await pool.query<InvoiceRecord>(
      `SELECT id, tenant_id, stripe_invoice_id, amount, status, pdf_url, period_start, period_end
       FROM invoices
       WHERE tenant_id = $1 AND id = $2`,
      [tenantId, invoiceId],
    );
    return result.rows[0] ?? null;
  }
}
