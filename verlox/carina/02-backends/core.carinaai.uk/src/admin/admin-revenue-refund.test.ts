import { beforeEach, describe, expect, it, vi } from 'vitest';

const poolQueryMock = vi.fn();
const invoicesRetrieveMock = vi.fn();
const refundsCreateMock = vi.fn();
const stripeClientMock = vi.hoisted(() => vi.fn());

vi.mock('../memory/db.js', () => ({
  pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
}));

vi.mock('../billing/billing-stripe-client.js', () => ({
  getStripeBillingClientOrNull: stripeClientMock,
}));

const stripeMock = {
  invoices: {
    retrieve: (...args: unknown[]) => invoicesRetrieveMock(...args),
  },
  refunds: {
    create: (...args: unknown[]) => refundsCreateMock(...args),
  },
};

vi.mock('stripe', () => ({
  default: class StripeMock {
    invoices = {
      retrieve: (...args: unknown[]) => invoicesRetrieveMock(...args),
    };

    refunds = {
      create: (...args: unknown[]) => refundsCreateMock(...args),
    };

    constructor(_secret: string) {}
  },
}));

describe('issueRevenueRefund', () => {
  beforeEach(() => {
    poolQueryMock.mockReset();
    invoicesRetrieveMock.mockReset();
    refundsCreateMock.mockReset();
    stripeClientMock.mockReturnValue(stripeMock);
  });

  it('refunds a paid invoice and updates local status', async () => {
    poolQueryMock
      .mockResolvedValueOnce({
        rows: [
          {
            id: 'inv-local-1',
            stripe_invoice_id: 'in_stripe_1',
            status: 'paid',
            amount_paid: 1900,
          },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });

    invoicesRetrieveMock.mockResolvedValue({
      payment_intent: 'pi_test_1',
    });

    refundsCreateMock.mockResolvedValue({ id: 're_test_1' });

    const { issueRevenueRefund } = await import('./admin-revenue-queries.js');
    const result = await issueRevenueRefund({
      invoiceId: 'inv-local-1',
      reason: 'requested_by_customer',
      note: 'Launch readiness refund smoke test',
    });

    expect(result).toEqual({ stripeRefundId: 're_test_1', amount: 1900 });
    expect(invoicesRetrieveMock).toHaveBeenCalledWith('in_stripe_1');
    expect(refundsCreateMock).toHaveBeenCalledWith({
      payment_intent: 'pi_test_1',
      reason: 'requested_by_customer',
      metadata: { note: 'Launch readiness refund smoke test' },
    });
    expect(poolQueryMock).toHaveBeenLastCalledWith(
      `UPDATE aiva_invoices SET status = 'refunded' WHERE id = $1`,
      ['inv-local-1'],
    );
  });

  it('rejects non-paid invoices', async () => {
    poolQueryMock.mockResolvedValueOnce({
      rows: [{ id: 'inv-2', stripe_invoice_id: 'in_2', status: 'open', amount_paid: 1900 }],
    });

    const { issueRevenueRefund } = await import('./admin-revenue-queries.js');
    await expect(
      issueRevenueRefund({
        invoiceId: 'inv-2',
        reason: 'requested_by_customer',
        note: 'Launch readiness refund smoke test',
      }),
    ).rejects.toThrow('Only paid invoices can be refunded');
  });

  it('rejects when Stripe is not configured', async () => {
    vi.resetModules();
    stripeClientMock.mockReturnValue(null);
    vi.doMock('../memory/db.js', () => ({
      pool: { query: (...args: unknown[]) => poolQueryMock(...args) },
    }));
    vi.doMock('stripe', () => ({
      default: class StripeMock {
        constructor(_secret: string) {}
      },
    }));

    const { issueRevenueRefund } = await import('./admin-revenue-queries.js');
    await expect(
      issueRevenueRefund({
        invoiceId: 'inv-3',
        reason: 'requested_by_customer',
        note: 'Launch readiness refund smoke test',
      }),
    ).rejects.toThrow('Stripe is not configured');
  });
});
