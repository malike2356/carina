import { redirect } from 'next/navigation';
import { BillingClient } from '@/components/billing/BillingClient';
import { getBrandForCurrentRequest, getRequestHostname } from '@/lib/server-brand';
import { buildBrandedPlanOptions } from '@/lib/billing-presentment';
import { isAivaProductHost } from '@/lib/product-surface';
import { getUsageTotals } from '@/lib/quota';
import { requireSession, requireWorkspace } from '@/lib/session';

export default async function BillingPage() {
  const hostname = await getRequestHostname();
  if (isAivaProductHost(hostname)) {
    redirect('/billing/aiva');
  }

  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const usage = await getUsageTotals(workspace);
  const brand = await getBrandForCurrentRequest();
  const brandedPlans = buildBrandedPlanOptions({
    currentPlan: workspace.plan,
    productName: brand.productName,
  });

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[90rem] space-y-8 px-6 py-8">
        <div>
          <h1 className="text-2xl font-semibold">{brand.productName} billing</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Workspace plan: {brandedPlans.find((item) => item.active)?.name ?? workspace.plan}
          </p>
        </div>
        <BillingClient
          plan={workspace.plan}
          dailyUsed={usage.dailyUsed}
          monthlyUsed={usage.monthlyUsed}
          limit={usage.limit}
          period={usage.period}
          productName={brand.productName}
          brandedPlans={brandedPlans}
        />
      </div>
    </div>
  );
}
