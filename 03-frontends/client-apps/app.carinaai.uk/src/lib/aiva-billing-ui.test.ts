import { describe, expect, it } from 'vitest';
import {
  AIVA_PLANS,
  mapAivaBillingStatus,
  mapInvoiceRows,
  mergePlanPricing,
  trialDaysRemaining,
} from './aiva-billing-ui';

describe('aiva-billing-ui', () => {
  it('maps trial subscription to trial state', () => {
    const view = mapAivaBillingStatus(
      {
        subscription: {
          planTier: 'trial',
          status: 'trialing',
          trialEndsAt: '2026-07-01T00:00:00.000Z',
        },
        usage: { messageCount: 12, messageLimit: 200, usagePercent: 6 },
      },
      [],
    );
    expect(view.state).toBe('trial');
    expect(view.plan).toBeNull();
  });

  it('maps paid invoices for the table', () => {
    const invoices = mapInvoiceRows([
      {
        stripeInvoiceId: 'in_1234567890',
        amountPaid: 4900,
        currency: 'gbp',
        status: 'paid',
        createdAt: '2026-06-01T00:00:00.000Z',
        invoicePdfUrl: 'https://stripe.test/pdf',
      },
    ]);
    expect(invoices[0]?.status).toBe('paid');
    expect(invoices[0]?.pdfUrl).toContain('stripe.test');
  });

  it('merges API pricing into plan cards', () => {
    const merged = mergePlanPricing(AIVA_PLANS, [
      { tier: 'team', monthlyAmountPence: 9900, annualAmountPence: 99000 },
    ]);
    expect(merged.find((p) => p.key === 'team')?.monthlyPence).toBe(9900);
    expect(merged.find((p) => p.key === 'team')?.annualMonthlyPence).toBe(8250);
  });

  it('calculates trial days remaining', () => {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
    expect(trialDaysRemaining(tomorrow)).toBe(1);
  });
});
