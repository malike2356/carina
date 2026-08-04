import express, { type Express, type Request, type Response } from 'express';
import { pool } from '../memory/db.js';
import { getUserProfile } from './hosted-auth.js';
import { BILLING_PLANS, type BillingPlanId } from '../billing/plans.js';
import { SubscriptionManager } from '../billing/subscription-manager.js';
import { UsageMeter } from '../billing/usage-meter.js';

function asPlan(value: unknown, tier: string): BillingPlanId {
  if (value === 'scout_standard' || value === 'enterprise') return value;
  if (value === 'free') return 'free';
  return tier === 'pro' ? 'scout_standard' : 'free';
}

export function mountHostedBillingRoutes(app: Express): void {
  const router = express.Router();
  const usageMeter = new UsageMeter();
  const subscriptions = new SubscriptionManager();

  router.get('/usage', async (req: Request, res: Response) => {
    const accountId = req.session?.hostedAccountId;
    if (!accountId) {
      res.status(401).json({ error: 'Not signed in' });
      return;
    }

    const profile = await getUserProfile(accountId);
    if (!profile) {
      res.status(401).json({ error: 'Account not found' });
      return;
    }

    const sub = await subscriptions.getSubscription(accountId);
    const plan = asPlan(sub?.plan, profile.tier);
    const usage = await usageMeter.status(accountId, plan);
    const planMeta = BILLING_PLANS[plan];

    const daily = await pool.query<{ messages_today: number }>(
      'SELECT messages_today FROM hosted_users WHERE id = $1',
      [accountId],
    );
    const messagesToday = Number(daily.rows[0]?.messages_today ?? 0);

    res.json({
      usage,
      subscription: sub
        ? {
            plan: sub.plan,
            status: sub.status,
            current_period_start: sub.current_period_start,
            current_period_end: sub.current_period_end,
          }
        : { plan, status: 'active', current_period_start: null, current_period_end: null },
      tier: profile.tier,
      planName: planMeta.name,
      tokenLimit: planMeta.tokenLimit,
      monthlyPriceGbp: planMeta.monthlyPriceGbp,
      messagesToday,
      freeDailyLimit: plan === 'free' ? 50 : null,
    });
  });

  app.use('/app/auth/billing', router);
}
