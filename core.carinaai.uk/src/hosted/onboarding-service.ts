import { pool } from '../memory/db.js';
import { normalizePlanId, type BillingPlanId } from '../billing/plans.js';
import { SubscriptionManager } from '../billing/subscription-manager.js';
import { orgHasByokKey } from './vault-service.js';
import { orgHasWorkbenchRun } from './workbench-service.js';
import { queryForOrg } from './scoped-query.js';

export interface OnboardingStep {
  id: string;
  label: string;
  done: boolean;
  href?: string;
}

export interface OnboardingChecklist {
  steps: OnboardingStep[];
  completedCount: number;
  totalCount: number;
  percentComplete: number;
  dismissed: boolean;
}

const STEP_DEFS: Array<{ id: string; label: string; href?: string }> = [
  { id: 'register', label: 'Create account' },
  { id: 'org', label: 'Organization ready' },
  { id: 'billing', label: 'Start trial or subscribe', href: '/ops/billing' },
  { id: 'byok', label: 'Connect provider key', href: '/ops/vault' },
  { id: 'workbench', label: 'Run first prompt', href: '/ops/workbench' },
  { id: 'usage', label: 'Review usage', href: '/ops/usage' },
  { id: 'invite', label: 'Invite teammate', href: '/ops/settings' },
];

function isBillingComplete(
  orgPlan: string,
  subscriptionPlan: BillingPlanId | undefined,
  trialEndsAt: Date | null | undefined,
): boolean {
  const trialActive = trialEndsAt != null && new Date(trialEndsAt) > new Date();
  if (trialActive) return true;
  const stored = normalizePlanId(orgPlan);
  if (stored !== 'free') return true;
  const subPlan = normalizePlanId(subscriptionPlan ?? 'free');
  return subPlan === 'carina_ops_starter' || subPlan === 'carina_ops_team';
}

export async function getOnboardingChecklist(
  orgId: string,
  tenantId: string,
): Promise<OnboardingChecklist> {
  const orgResult = await pool.query<{
    plan: string;
    onboarding_flags: Record<string, unknown>;
    onboarding_dismissed: boolean;
  }>(
    `SELECT plan, onboarding_flags, onboarding_dismissed
     FROM organizations WHERE id = $1`,
    [orgId],
  );
  const orgRow = orgResult.rows[0];
  const flags = (orgRow?.onboarding_flags ?? {}) as Record<string, unknown>;
  const dismissed = Boolean(orgRow?.onboarding_dismissed);

  const subscriptions = new SubscriptionManager();
  const sub = await subscriptions.getSubscriptionForOrg(orgId, tenantId);

  const memberResult = await pool.query<{ count: string }>(
    'SELECT COUNT(*)::TEXT AS count FROM org_memberships WHERE org_id = $1',
    [orgId],
  );
  const memberCount = Number(memberResult.rows[0]?.count ?? 1);

  const inviteResult = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::TEXT AS count FROM org_invites
     WHERE org_id = $1 AND accepted_at IS NULL AND expires_at > NOW()`,
    [orgId],
  );
  const pendingInvites = Number(inviteResult.rows[0]?.count ?? 0);

  const usageViewed = Boolean(flags.usage_viewed)
    || await hasUsageViewedAudit(orgId);

  const billingDone = isBillingComplete(
    String(orgRow?.plan ?? 'free'),
    sub?.plan,
    sub?.trial_ends_at ?? null,
  );
  const byokDone = await orgHasByokKey(orgId);
  const workbenchDone = await orgHasWorkbenchRun(orgId);
  const inviteDone = memberCount > 1 || pendingInvites > 0;

  const doneMap: Record<string, boolean> = {
    register: true,
    org: true,
    billing: billingDone,
    byok: byokDone,
    workbench: workbenchDone,
    usage: usageViewed,
    invite: inviteDone,
  };

  const steps: OnboardingStep[] = STEP_DEFS.map((step) => ({
    id: step.id,
    label: step.label,
    done: doneMap[step.id] ?? false,
    href: step.href,
  }));

  const completedCount = steps.filter((step) => step.done).length;
  const totalCount = steps.length;
  const percentComplete = Math.round((completedCount / totalCount) * 100);

  return {
    steps,
    completedCount,
    totalCount,
    percentComplete,
    dismissed,
  };
}

async function hasUsageViewedAudit(orgId: string): Promise<boolean> {
  const result = await queryForOrg(
    orgId,
    `SELECT 1 FROM product_audit_log
     WHERE org_id = $1 AND action = 'usage.viewed'
     LIMIT 1`,
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markUsageViewed(orgId: string, actorUserId: string): Promise<void> {
  await pool.query(
    `UPDATE organizations
     SET onboarding_flags = onboarding_flags || '{"usage_viewed": true}'::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [orgId],
  );
  const existing = await queryForOrg(
    orgId,
    `SELECT 1 FROM product_audit_log
     WHERE org_id = $1 AND action = 'usage.viewed'
       AND created_at >= CURRENT_DATE
     LIMIT 1`,
  );
  if ((existing.rowCount ?? 0) > 0) return;
  const { writeProductAudit } = await import('./product-audit.js');
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'usage.viewed',
    resourceType: 'usage',
  });
}

export async function dismissOnboardingWizard(orgId: string, actorUserId: string): Promise<void> {
  await pool.query(
    `UPDATE organizations
     SET onboarding_dismissed = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [orgId],
  );
  const { writeProductAudit } = await import('./product-audit.js');
  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'onboarding.dismissed',
    resourceType: 'onboarding',
  });
}

export async function shouldShowOnboardingWizard(orgId: string, tenantId: string): Promise<boolean> {
  const checklist = await getOnboardingChecklist(orgId, tenantId);
  if (checklist.dismissed) return false;
  return checklist.percentComplete < 100;
}
