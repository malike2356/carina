import { beforeEach, describe, expect, it, vi } from 'vitest';

const query = vi.fn();
const getPlatformEventSummary = vi.fn();
const reportMeterEvent = vi.fn();
const retrieveSubscription = vi.fn();
const createSubscriptionItem = vi.fn();

vi.mock('../memory/db.js', () => ({ pool: { query } }));
vi.mock('./platform-event-emitter.js', () => ({ getPlatformEventSummary }));
vi.mock('./stripe-service.js', () => ({
  StripeService: function StripeService() {
    return { reportMeterEvent, retrieveSubscription, createSubscriptionItem };
  },
}));

describe('metered-billing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.STRIPE_PRICE_PLATFORM_EVENTS_METERED = 'price_test_metered';
    process.env.STRIPE_METER_EVENT_NAME = 'platform_events';
  });

  describe('reportMonthlyUsage', () => {
    it('does nothing when partner not found', async () => {
      query.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      const { reportMonthlyUsage } = await import('./metered-billing.js');
      await reportMonthlyUsage('missing-partner');
      expect(reportMeterEvent).not.toHaveBeenCalled();
    });

    it('does nothing when stripe_customer_id is null', async () => {
      query.mockResolvedValueOnce({ rows: [{ stripe_customer_id: null, stripe_metered_item_id: null }], rowCount: 1 });
      const { reportMonthlyUsage } = await import('./metered-billing.js');
      await reportMonthlyUsage('partner-no-stripe');
      expect(reportMeterEvent).not.toHaveBeenCalled();
    });

    it('calls reportMeterEvent with month-to-date total and stable identifier', async () => {
      query.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_test_123', stripe_metered_item_id: 'si_test' }], rowCount: 1 });
      getPlatformEventSummary.mockResolvedValueOnce({
        totalEvents: 1234, totalTokensIn: 0, totalTokensOut: 0,
        totalToolCalls: 0, totalSkillCalls: 0, totalFeePence: 0, byType: {},
      });
      reportMeterEvent.mockResolvedValueOnce({});

      const { reportMonthlyUsage } = await import('./metered-billing.js');
      await reportMonthlyUsage('partner-1');

      expect(reportMeterEvent).toHaveBeenCalledOnce();
      const args = reportMeterEvent.mock.calls[0][0] as Record<string, unknown>;
      expect(args.eventName).toBe('platform_events');
      expect(args.stripeCustomerId).toBe('cus_test_123');
      expect(args.quantity).toBe(1234);
      expect(typeof args.identifier).toBe('string');
      expect(String(args.identifier)).toContain('partner-1');
    });
  });

  describe('reportAllPartnerUsage', () => {
    it('iterates all active partners with a customer ID', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 'p1' }, { id: 'p2' }],
        rowCount: 2,
      });
      // Two subsequent calls for individual partners
      query.mockResolvedValue({ rows: [{ stripe_customer_id: null }], rowCount: 1 });

      const { reportAllPartnerUsage } = await import('./metered-billing.js');
      await reportAllPartnerUsage();

      // Main query should filter active AND stripe_customer_id IS NOT NULL
      const [sql] = query.mock.calls[0] as [string];
      expect(sql).toContain('stripe_customer_id IS NOT NULL');
      expect(sql).toContain("status = 'active'");
    });

    it('continues past individual partner errors', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 'p-fail' }], rowCount: 1 });
      query.mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_x' }], rowCount: 1 });
      getPlatformEventSummary.mockRejectedValueOnce(new Error('db timeout'));

      const { reportAllPartnerUsage } = await import('./metered-billing.js');
      await expect(reportAllPartnerUsage()).resolves.toBeUndefined();
    });
  });

  describe('attachMeteredBilling', () => {
    it('stores existing metered item if already on subscription', async () => {
      retrieveSubscription.mockResolvedValueOnce({
        customer: 'cus_existing',
        items: { data: [{ id: 'si_existing', price: { id: 'price_test_metered' } }] },
      });
      query.mockResolvedValueOnce({ rowCount: 1 });

      const { attachMeteredBilling } = await import('./metered-billing.js');
      await attachMeteredBilling('partner-1', 'sub_test');

      expect(createSubscriptionItem).not.toHaveBeenCalled();
      const [sql, params] = query.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('stripe_metered_item_id');
      expect(params).toContain('si_existing');
      expect(params).toContain('cus_existing');
    });

    it('creates a new subscription item when not found', async () => {
      retrieveSubscription.mockResolvedValueOnce({
        customer: 'cus_new',
        items: { data: [] },
      });
      createSubscriptionItem.mockResolvedValueOnce({ id: 'si_new' });
      query.mockResolvedValueOnce({ rowCount: 1 });

      const { attachMeteredBilling } = await import('./metered-billing.js');
      await attachMeteredBilling('partner-2', 'sub_new');

      expect(createSubscriptionItem).toHaveBeenCalledWith('sub_new', 'price_test_metered');
      const [, params] = query.mock.calls[0] as [string, unknown[]];
      expect(params).toContain('si_new');
    });
  });
});
