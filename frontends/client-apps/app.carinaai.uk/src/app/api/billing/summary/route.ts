import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workspaceSettings } from '@/db/schema';
import { buildBrandedPlanOptions } from '@/lib/billing-presentment';
import { normalizeBrandConfig, resolveWorkspaceBrand } from '@/lib/brand';
import { getUsageTotals } from '@/lib/quota';
import { requireSession, requireWorkspace } from '@/lib/session';

export async function GET() {
  try {
    const session = await requireSession();
    const workspace = await requireWorkspace(session.user.id);
    const usage = await getUsageTotals(workspace);
    const [settings] = await db
      .select({ brand: workspaceSettings.brand })
      .from(workspaceSettings)
      .where(eq(workspaceSettings.workspaceId, workspace.id))
      .limit(1);
    const resolvedBrand = resolveWorkspaceBrand({
      workspaceBrand: normalizeBrandConfig(settings?.brand ?? {}),
    });

    return NextResponse.json({
      plan: workspace.plan,
      productName: resolvedBrand.productName,
      dailyUsed: usage.dailyUsed,
      monthlyUsed: usage.monthlyUsed,
      limit: usage.limit,
      period: usage.period,
      brandedPlans: buildBrandedPlanOptions({
        currentPlan: workspace.plan,
        productName: resolvedBrand.productName,
      }),
      workspaceUsage: {
        dailyUsed: usage.dailyUsed,
        monthlyUsed: usage.monthlyUsed,
        limit: usage.limit,
        period: usage.period,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
