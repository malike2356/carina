import { NextResponse } from 'next/server';
import { getUsageTotals } from '@/lib/quota';
import { PLAN_LIMITS } from '@/lib/plans';
import { getSession, requireWorkspace } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * Mobile companion contract: GET /app/auth/billing/usage
 * Shape matches core hosted-billing usage for Carina Mobile.
 */
export async function GET() {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 });
  }

  try {
    const workspace = await requireWorkspace(session.user.id);
    const usage = await getUsageTotals(workspace);
    const planMeta = PLAN_LIMITS[workspace.plan];
    const tokensUsed =
      usage.period === 'day' ? usage.dailyUsed : usage.monthlyUsed;
    const limit = usage.limit;
    const nearLimit =
      limit !== null && limit > 0 && tokensUsed >= limit * 0.8 && tokensUsed < limit;
    const overLimit = limit !== null && limit > 0 && tokensUsed >= limit;

    // Mobile treats tier === 'pro' as paid (hides Upgrade). Map team accordingly.
    const tier = workspace.plan === 'team' ? 'pro' : workspace.plan;

    return NextResponse.json({
      usage: {
        tokensUsed,
        limit,
        warning: nearLimit
          ? 'You are approaching your token limit for this billing period.'
          : undefined,
        blocked: overLimit
          ? 'Token quota exceeded. Upgrade your plan or wait for the next period.'
          : undefined,
      },
      subscription: {
        plan: workspace.plan,
        status: 'active',
        current_period_start: null,
        current_period_end: null,
      },
      tier,
      planName: planMeta.label,
      tokenLimit: limit,
      monthlyPriceGbp: planMeta.priceGbp,
      messagesToday: 0,
      freeDailyLimit: workspace.plan === 'free' ? planMeta.dailyTokens : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load usage';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
