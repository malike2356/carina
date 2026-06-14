import { query } from './db.js';

export type AuditAction =
  | 'tenant_created'
  | 'tenant.view'
  | 'tenant.plan_override'
  | 'tenant.byok.view'
  | 'tenant.suspend'
  | 'tenant.impersonate_start'
  | 'tenant.impersonate_end'
  | 'plan_changed'
  | 'subscription_updated'
  | 'access_changed'
  | 'skill_pack_changed'
  | 'quota_reset'
  | 'tier_changed'
  | 'notes_updated'
  | 'byok_key_added'
  | 'byok_key_removed';

export interface AuditEntry {
  id: string;
  tenantId: string | null;
  action: AuditAction;
  actor: string;
  details: Record<string, unknown>;
  createdAt: Date;
}

const ACTOR = 'ops-admin';

export async function writeOpsAudit(entry: {
  tenantId?: string;
  orgId?: string;
  action: AuditAction | string;
  actor?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await query(
    `INSERT INTO ops_audit_log (tenant_id, org_id, action, actor, details)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      entry.tenantId ?? null,
      entry.orgId ?? null,
      entry.action,
      entry.actor ?? ACTOR,
      JSON.stringify(entry.details ?? {}),
    ],
  );
}

export async function logAudit(
  action: AuditAction,
  details: Record<string, unknown>,
  tenantId?: string | null,
): Promise<void> {
  await writeOpsAudit({ tenantId: tenantId ?? undefined, action, details });
}

export async function fetchAuditLog(tenantId: string, limit = 50): Promise<AuditEntry[]> {
  const result = await query<{
    id: string;
    tenant_id: string | null;
    action: string;
    actor: string;
    details: Record<string, unknown>;
    created_at: Date;
  }>(
    `SELECT id, tenant_id, action, actor, details, created_at
     FROM ops_audit_log
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [tenantId, limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    tenantId: row.tenant_id,
    action: row.action as AuditAction,
    actor: row.actor,
    details: row.details ?? {},
    createdAt: row.created_at,
  }));
}

export function formatAuditAction(action: AuditAction | string): string {
  const labels: Record<string, string> = {
    tenant_created: 'Tenant created',
    'tenant.view': 'Tenant viewed',
    'tenant.plan_override': 'Plan overridden',
    'tenant.byok.view': 'BYOK viewed',
    'tenant.suspend': 'Tenant suspended',
    'tenant.impersonate_start': 'Impersonation started',
    'tenant.impersonate_end': 'Impersonation ended',
    plan_changed: 'Plan changed',
    subscription_updated: 'Subscription updated',
    access_changed: 'Access status changed',
    skill_pack_changed: 'Skill packs updated',
    quota_reset: 'Daily quota reset',
    tier_changed: 'Tier changed',
    notes_updated: 'Notes updated',
    byok_key_added: 'BYOK key added',
    byok_key_removed: 'BYOK key removed',
  };
  return labels[action] ?? action;
}
