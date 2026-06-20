import { UsageMeter } from './usage-meter.js';
import { BILLING_PLANS, type BillingPlanId } from './plans.js';
import { getMonthlyBalance } from './credit-ledger.js';

export type WorkspaceBillingMember = {
  tenantId: string;
  plan: BillingPlanId;
  tokensUsed: number;
  limit: number | null;
  warning?: string;
  blocked?: string;
};

export type WorkspaceBillingSummary = {
  orgId: string;
  plan: BillingPlanId;
  members: WorkspaceBillingMember[];
  totals: {
    tokensUsed: number;
    creditsUsed: number;
    creditsLimit: number | null;
    memberCount: number;
  };
  usageBased: boolean;
};

const meter = new UsageMeter();

export async function buildWorkspaceBillingSummary(input: {
  orgId: string;
  plan: BillingPlanId;
  tenantIds: string[];
}): Promise<WorkspaceBillingSummary> {
  const planMeta = BILLING_PLANS[input.plan];
  const members: WorkspaceBillingMember[] = [];

  for (const tenantId of input.tenantIds) {
    const status = await meter.statusForOrg(input.orgId, tenantId, input.plan);
    members.push({
      tenantId,
      plan: input.plan,
      tokensUsed: status.tokensUsed,
      limit: status.limit,
      warning: status.warning,
      blocked: status.blocked,
    });
  }

  const tokensUsed = members.reduce((sum, m) => sum + m.tokensUsed, 0);
  let creditsUsed = 0;
  let creditsLimit: number | null = planMeta.includedCredits;
  if (planMeta.includedCredits !== null) {
    const balance = await getMonthlyBalance(input.orgId, input.plan);
    creditsUsed = balance.used;
    creditsLimit = planMeta.includedCredits + balance.topups;
  }

  return {
    orgId: input.orgId,
    plan: input.plan,
    members,
    totals: {
      tokensUsed,
      creditsUsed,
      creditsLimit,
      memberCount: members.length,
    },
    usageBased: planMeta.includedCredits !== null || planMeta.tokenLimit !== null,
  };
}
