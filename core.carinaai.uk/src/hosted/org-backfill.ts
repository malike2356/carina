import { pool } from '../memory/db.js';
import { createOrgForUser, getPrimaryOrgForUser } from './org-service.js';

export async function listUsersWithoutOrg(): Promise<Array<{ id: string; email: string }>> {
  const result = await pool.query(
    `SELECT hu.id, hu.email
     FROM hosted_users hu
     LEFT JOIN org_memberships om ON om.user_id = hu.id
     WHERE om.user_id IS NULL
     ORDER BY hu.created_at ASC`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
  }));
}

async function linkOrgScopedRows(userId: string, orgId: string): Promise<void> {
  await pool.query('UPDATE subscriptions SET org_id = $2 WHERE tenant_id = $1', [userId, orgId]);
  await pool.query('UPDATE usage_records SET org_id = $2 WHERE tenant_id = $1', [userId, orgId]);
  await pool.query('UPDATE invoices SET org_id = $2 WHERE tenant_id = $1', [userId, orgId]);
  try {
    await pool.query(
      'UPDATE tenant_provider_keys SET org_id = $2 WHERE tenant_id = $1',
      [userId, orgId],
    );
  } catch {
    // tenant_provider_keys may not exist on all deployments
  }
  try {
    await pool.query('UPDATE ops_audit_log SET org_id = $2 WHERE tenant_id = $1', [userId, orgId]);
  } catch {
    // ops_audit_log is ops-panel only on some deployments
  }
}

export async function backfillOrgForUser(
  userId: string,
  dryRun = false,
): Promise<{ orgId: string; created: boolean }> {
  const existing = await getPrimaryOrgForUser(userId);
  if (existing) {
    if (!dryRun) {
      await linkOrgScopedRows(userId, existing.orgId);
    }
    return { orgId: existing.orgId, created: false };
  }

  const userResult = await pool.query('SELECT email FROM hosted_users WHERE id = $1', [userId]);
  if ((userResult.rowCount ?? 0) === 0) {
    throw new Error(`User not found: ${userId}`);
  }
  const email = String(userResult.rows[0].email);

  if (dryRun) {
    return { orgId: '(dry-run)', created: true };
  }

  const { orgId } = await createOrgForUser(userId, email);
  await linkOrgScopedRows(userId, orgId);
  return { orgId, created: true };
}

export async function backfillAllOrgs(options?: {
  dryRun?: boolean;
  userId?: string;
}): Promise<{ created: number; skipped: number; errors: string[] }> {
  const dryRun = options?.dryRun ?? false;
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  const users = options?.userId
    ? [{ id: options.userId, email: '' }]
    : await listUsersWithoutOrg();

  for (const user of users) {
    try {
      const result = await backfillOrgForUser(user.id, dryRun);
      if (result.created) created += 1;
      else skipped += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${user.id}: ${msg}`);
    }
  }

  return { created, skipped, errors };
}
