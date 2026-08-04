import { pool } from '../memory/db.js';
import { config } from '../config/index.js';
import { writeProductAudit } from './product-audit.js';

export interface CloudProvisionResult {
  orgId: string;
  provisioned: boolean;
  alreadyProvisioned: boolean;
}

export interface CloudWelcomeChecklist {
  addApiKey: boolean;
  choosePack: boolean;
  firstMessage: boolean;
}

const WELCOME_CHECKLIST_DEFAULTS: CloudWelcomeChecklist = {
  addApiKey: false,
  choosePack: false,
  firstMessage: false,
};

export function buildCloudOnboardingFlags(now = new Date()): Record<string, unknown> {
  return {
    cloud_provisioned: true,
    cloud_provisioned_at: now.toISOString(),
    active_skill_packs: [],
    welcome_checklist: WELCOME_CHECKLIST_DEFAULTS,
  };
}

export async function provisionCloudOrg(
  orgId: string,
  actorUserId: string,
): Promise<CloudProvisionResult> {
  if (!config.hosted.enabled || !config.hosted.cloudEnabled) {
    return { orgId, provisioned: false, alreadyProvisioned: false };
  }

  const existing = await pool.query<{ onboarding_flags: Record<string, unknown> }>(
    `SELECT onboarding_flags FROM organizations WHERE id = $1`,
    [orgId],
  );
  if ((existing.rowCount ?? 0) === 0) {
    throw new Error(`Organization not found: ${orgId}`);
  }

  const flags = (existing.rows[0]?.onboarding_flags ?? {}) as Record<string, unknown>;
  if (flags.cloud_provisioned === true) {
    return { orgId, provisioned: false, alreadyProvisioned: true };
  }

  const mergedFlags = {
    ...flags,
    ...buildCloudOnboardingFlags(),
  };

  await pool.query(
    `UPDATE organizations
     SET onboarding_flags = $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [orgId, JSON.stringify(mergedFlags)],
  );

  await writeProductAudit({
    orgId,
    actorUserId,
    action: 'cloud.provisioned',
    resourceType: 'cloud',
    details: {
      activeSkillPacks: [],
      welcomeChecklist: WELCOME_CHECKLIST_DEFAULTS,
    },
  });

  return { orgId, provisioned: true, alreadyProvisioned: false };
}
