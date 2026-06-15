import { pool } from '../memory/db.js';
import { seedDefaultModelsForOrg } from './ai-platform-migrate.js';
import { provisionCloudOrg } from './cloud-provisioner.js';
import { writeProductAudit } from './product-audit.js';
import type { OrgMembershipRow } from './org-types.js';

const TRIAL_DAYS = 14;

export function slugifyOrgName(email: string, displayName?: string): string {
  const base = (displayName ?? email.split('@')[0] ?? 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return base || 'org';
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (attempt < 100) {
    const existing = await pool.query('SELECT 1 FROM organizations WHERE slug = $1', [slug]);
    if ((existing.rowCount ?? 0) === 0) return slug;
    attempt += 1;
    slug = `${base}-${attempt + 1}`;
  }
  return `${base}-${Date.now()}`;
}

export async function createOrgForUser(
  userId: string,
  email: string,
  orgName?: string,
): Promise<{ orgId: string; slug: string; role: 'owner' }> {
  const name = orgName?.trim() || `${email.split('@')[0]}'s workspace`;
  const baseSlug = slugifyOrgName(email, orgName ?? name);
  const slug = await uniqueSlug(baseSlug);

  const orgResult = await pool.query(
    `INSERT INTO organizations (name, slug, owner_user_id, plan)
     VALUES ($1, $2, $3, 'free')
     RETURNING id`,
    [name, slug, userId],
  );
  const orgId = String(orgResult.rows[0].id);
  const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000);

  await pool.query(
    `INSERT INTO org_memberships (org_id, user_id, role)
     VALUES ($1, $2, 'owner')`,
    [orgId, userId],
  );

  await pool.query(
    `INSERT INTO subscriptions (tenant_id, org_id, plan, status, trial_ends_at)
     VALUES ($1, $2, 'free', 'active', $3)
     ON CONFLICT (tenant_id) DO UPDATE SET org_id = EXCLUDED.org_id`,
    [userId, orgId, trialEndsAt],
  );

  await seedDefaultModelsForOrg(orgId);
  await provisionCloudOrg(orgId, userId);

  await writeProductAudit({
    orgId,
    actorUserId: userId,
    action: 'billing.trial_started',
    details: { trialEndsAt: trialEndsAt.toISOString(), trialDays: TRIAL_DAYS },
  });

  return { orgId, slug, role: 'owner' };
}

export async function getPrimaryOrgForUser(userId: string): Promise<OrgMembershipRow | null> {
  const result = await pool.query(
    `SELECT om.org_id, om.user_id, om.role, o.plan
     FROM org_memberships om
     JOIN organizations o ON o.id = om.org_id
     WHERE om.user_id = $1
     ORDER BY CASE om.role WHEN 'owner' THEN 0 ELSE 1 END, om.joined_at ASC
     LIMIT 1`,
    [userId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  const row = result.rows[0];
  return {
    orgId: String(row.org_id),
    userId: String(row.user_id),
    role: row.role as OrgMembershipRow['role'],
  };
}

export async function getOrgProfile(orgId: string): Promise<{
  id: string;
  name: string;
  plan: string;
} | null> {
  const result = await pool.query(
    'SELECT id, name, plan FROM organizations WHERE id = $1',
    [orgId],
  );
  if ((result.rowCount ?? 0) === 0) return null;
  const row = result.rows[0];
  return {
    id: String(row.id),
    name: String(row.name),
    plan: String(row.plan),
  };
}
