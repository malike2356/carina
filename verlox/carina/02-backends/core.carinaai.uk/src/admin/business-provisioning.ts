import {
  createHostedAccountForProvisioning,
  createPasswordResetLoginUrl,
} from '../api/hosted-auth.js';
import { upsertPaddleSubscription } from '../billing/paddle/paddle-subscription-store.js';
import { slotLimitDbValue } from '../billing/aiva-tier.js';
import {
  buildCnameTarget,
  createCustomDomainForOrg,
  type CustomDomainRow,
} from '../hosted/custom-domain-service.js';
import { sendBusinessProvisionWelcomeEmail } from '../email/email-triggers.js';
import { upsertWorkspaceContact } from '../email/workspace-contact.js';
import { pool } from '../memory/db.js';

export interface BusinessProvisionInput {
  email: string;
  workspaceName: string;
  customDomain?: string;
  sendWelcomeEmail: boolean;
}

export interface BusinessProvisionResult {
  workspaceId: string;
  loginUrl: string;
  customDomainRow?: {
    id: string;
    hostname: string;
    cnameTarget: string;
    cfOwnershipVerificationName: string | null;
    cfOwnershipVerificationValue: string | null;
  } | null;
}

function mapCustomDomainResult(row: CustomDomainRow): NonNullable<BusinessProvisionResult['customDomainRow']> {
  const cnameTarget = row.cnameTarget ?? (row.cfHostnameId ? buildCnameTarget(row.cfHostnameId) : '');
  return {
    id: row.id,
    hostname: row.hostname,
    cnameTarget,
    cfOwnershipVerificationName: row.cfOwnershipVerificationName,
    cfOwnershipVerificationValue: row.cfOwnershipVerificationValue,
  };
}

async function applyBusinessTrialPlan(workspaceId: string): Promise<void> {
  await upsertPaddleSubscription({
    workspaceId,
    planTier: 'business',
    status: 'trial',
  });
  const slotLimit = slotLimitDbValue('business');
  await pool.query(
    `INSERT INTO aiva_subscriptions
       (workspace_id, plan_tier, status, aiva_slot_limit, trial_ends_at, updated_at)
     VALUES ($1, 'business', 'trialing', $2, NOW() + INTERVAL '30 days', NOW())
     ON CONFLICT (workspace_id) DO UPDATE SET
       plan_tier = 'business',
       status = 'trialing',
       aiva_slot_limit = EXCLUDED.aiva_slot_limit,
       trial_ends_at = EXCLUDED.trial_ends_at,
       updated_at = NOW()`,
    [workspaceId, slotLimit],
  );
  await pool.query(`UPDATE organizations SET plan = 'business' WHERE id = $1`, [workspaceId]);
}

async function registerOptionalCustomDomain(
  orgId: string,
  hostname: string,
): Promise<BusinessProvisionResult['customDomainRow']> {
  try {
    const row = await createCustomDomainForOrg(orgId, hostname);
    return mapCustomDomainResult(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[business-provisioning] custom domain registration failed:', message);
    return null;
  }
}

export async function provisionBusinessWorkspace(
  input: BusinessProvisionInput,
): Promise<BusinessProvisionResult> {
  const email = input.email.trim().toLowerCase();
  const workspaceName = input.workspaceName.trim();
  const { userId, workspaceId } = await createHostedAccountForProvisioning(email, workspaceName);
  await applyBusinessTrialPlan(workspaceId);
  const customDomainRow = input.customDomain?.trim()
    ? await registerOptionalCustomDomain(workspaceId, input.customDomain.trim())
    : null;
  const loginUrl = await createPasswordResetLoginUrl(userId);
  await upsertWorkspaceContact(workspaceId, email, workspaceName);
  if (input.sendWelcomeEmail) {
    await sendBusinessProvisionWelcomeEmail({
      workspaceId,
      email,
      workspaceName,
      loginUrl,
      customDomainRow,
    });
  }
  return { workspaceId, loginUrl, customDomainRow };
}
