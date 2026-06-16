import { BillingClient } from '@/components/billing/BillingClient';
import { getUsageTotals } from '@/lib/quota';
import { requireSession, requireWorkspace } from '@/lib/session';

export default async function BillingPage() {
  const session = await requireSession();
  const workspace = await requireWorkspace(session.user.id);
  const usage = await getUsageTotals(workspace);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="text-sm text-text-secondary">Current plan: {workspace.plan}</p>
      </div>
      <BillingClient
        plan={workspace.plan}
        dailyUsed={usage.dailyUsed}
        monthlyUsed={usage.monthlyUsed}
        limit={usage.limit}
        period={usage.period}
      />
    </div>
  );
}
