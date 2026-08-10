import { describe, expect, it, vi, beforeEach } from 'vitest';
import type Stripe from 'stripe';

const reactivateSubscriptionMock = vi.fn(async () => undefined);
const suspendSubscriptionMock = vi.fn(async () => undefined);
const sendPaymentSuccessEmailMock = vi.fn(async () => undefined);
const subscriptionsRetrieveMock = vi.fn();
const handleFailedInvoiceMock = vi.fn(async () => null);
const processSuccessfulRetryMock = vi.fn(async () => null);

vi.mock('../../memory/db.js', () => ({
  pool: { query: vi.fn() },
}));

vi.mock('../billing-stripe-client.js', () => ({
  getStripeBillingClientOrNull: () => ({
    subscriptions: {
      retrieve: (...args: unknown[]) => subscriptionsRetrieveMock(...args),
    },
  }),
}));

vi.mock('../aiva-billing.js', () => ({
  reactivateSubscription: (...args: unknown[]) => reactivateSubscriptionMock(...args),
  markSubscriptionPastDue: vi.fn(async () => undefined),
  suspendSubscription: (...args: unknown[]) => suspendSubscriptionMock(...args),
  suspendIfGraceExpired: vi.fn(async () => false),
  gracePeriodEndsAt: () => new Date('2026-07-08T00:00:00.000Z'),
}));

vi.mock('../dunning-engine.js', () => ({
  handleFailedInvoice: (...args: unknown[]) => handleFailedInvoiceMock(...args),
  processSuccessfulRetry: (...args: unknown[]) => processSuccessfulRetryMock(...args),
}));

vi.mock('../../email/email-triggers.js', () => ({
  sendPaymentSuccessEmail: (...args: unknown[]) => sendPaymentSuccessEmailMock(...args),
  sendPaymentFailedEmail: vi.fn(async () => undefined),
}));

vi.mock('../../email/workspace-contact.js', () => ({
  aivaAppUrl: (path: string) => `https://admin.hireaiva.co.uk${path}`,
}));

vi.mock('stripe', () => ({
  default: class StripeMock {
    subscriptions = {
      retrieve: (...args: unknown[]) => subscriptionsRetrieveMock(...args),
    };

    constructor(_secret: string) {}
  },
}));

describe('aiva-webhook-handler', () => {
  beforeEach(() => {
    reactivateSubscriptionMock.mockClear();
    suspendSubscriptionMock.mockClear();
    sendPaymentSuccessEmailMock.mockClear();
    subscriptionsRetrieveMock.mockReset();
    handleFailedInvoiceMock.mockClear();
    processSuccessfulRetryMock.mockClear();
  });

  it('reads workspaceId from invoice metadata', async () => {
    const { handleAivaInvoicePaid } = await import('./aiva-webhook-handler.js');
    await handleAivaInvoicePaid({
      metadata: { workspaceId: 'ws-direct', planName: 'Aiva Starter' },
      amount_paid: 1900,
      currency: 'gbp',
      lines: { data: [{ period: { end: 1_700_000_000 } }] },
    } as Stripe.Invoice);

    expect(processSuccessfulRetryMock).toHaveBeenCalledWith('ws-direct');
    expect(reactivateSubscriptionMock).toHaveBeenCalledWith('ws-direct');
    expect(subscriptionsRetrieveMock).not.toHaveBeenCalled();
  });

  it('falls back to subscription metadata when invoice metadata is empty', async () => {
    subscriptionsRetrieveMock.mockResolvedValue({
      metadata: { workspaceId: 'ws-from-sub', plan: 'starter' },
    });

    const { handleAivaInvoicePaid } = await import('./aiva-webhook-handler.js');
    await handleAivaInvoicePaid({
      metadata: {},
      subscription: 'sub_123',
      amount_paid: 1900,
      currency: 'gbp',
      lines: { data: [{ period: { end: 1_700_000_000 } }] },
    } as Stripe.Invoice);

    expect(subscriptionsRetrieveMock).toHaveBeenCalledWith('sub_123');
    expect(processSuccessfulRetryMock).toHaveBeenCalledWith('ws-from-sub');
  });

  it('routes payment failures into dunning instead of suspending on second failure', async () => {
    const { handleAivaInvoicePaymentFailed } = await import('./aiva-webhook-handler.js');
    await handleAivaInvoicePaymentFailed({
      metadata: { workspaceId: 'ws-past-due' },
      amount_due: 4900,
      currency: 'gbp',
    } as Stripe.Invoice);

    expect(handleFailedInvoiceMock).toHaveBeenCalled();
    expect(suspendSubscriptionMock).not.toHaveBeenCalled();
  });

  it('starts dunning on first invoice payment failure', async () => {
    const { handleAivaInvoicePaymentFailed } = await import('./aiva-webhook-handler.js');
    await handleAivaInvoicePaymentFailed({
      metadata: { workspaceId: 'ws-first-fail' },
      amount_due: 4900,
      currency: 'gbp',
    } as Stripe.Invoice);

    expect(handleFailedInvoiceMock).toHaveBeenCalled();
    expect(suspendSubscriptionMock).not.toHaveBeenCalled();
  });
});
