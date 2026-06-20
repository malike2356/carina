import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
vi.mock('../../memory/db.js', () => ({ pool: { query } }));

describe('InvoiceGenerator', () => {
  beforeEach(() => query.mockReset());

  it('records Stripe-hosted invoice PDF URLs', async () => {
    const { InvoiceGenerator } = await import('../invoice-generator.js');
    query.mockResolvedValue({ rows: [] });
    await new InvoiceGenerator().recordStripeInvoice({
      id: 'in_1',
      customer: 'cus_1',
      metadata: { tenantId: 'tenant-1' },
      amount_due: 9900,
      status: 'paid',
      invoice_pdf: 'https://stripe.com/invoice.pdf',
      period_start: 1,
      period_end: 2,
    } as never);

    expect(query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO invoices'), expect.arrayContaining(['tenant-1', 'in_1', 9900, 'paid', 'https://stripe.com/invoice.pdf']));
  });
});
