import { pool } from '../memory/db.js';

export interface AuditLogParams {
  page?: number;
  limit?: number;
  action?: string;
  targetType?: string;
  adminUserId?: string;
  since?: string;
  until?: string;
}

export interface AuditLogEntry {
  id: string;
  adminEmail: string;
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}

function buildAuditConditions(params: AuditLogParams) {
  const conditions = ['1=1'];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (params.action && params.action !== 'all') {
    conditions.push(`l.action = $${idx++}`);
    queryParams.push(params.action);
  }
  if (params.targetType && params.targetType !== 'all') {
    conditions.push(`l.target_type = $${idx++}`);
    queryParams.push(params.targetType);
  }
  if (params.adminUserId && params.adminUserId !== 'all') {
    conditions.push(`l.admin_user_id = $${idx++}`);
    queryParams.push(params.adminUserId);
  }
  if (params.since) {
    conditions.push(`l.created_at >= $${idx++}`);
    queryParams.push(params.since);
  }
  if (params.until) {
    conditions.push(`l.created_at <= $${idx++}`);
    queryParams.push(params.until);
  }

  return { where: conditions.join(' AND '), queryParams, nextIdx: idx };
}

export async function queryAuditLog(params: AuditLogParams): Promise<{
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, Math.max(1, params.limit ?? 100));
  const offset = (page - 1) * limit;
  const { where, queryParams, nextIdx } = buildAuditConditions(params);

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM admin_audit_log l
     WHERE ${where}`,
    queryParams,
  );

  const result = await pool.query(
    `SELECT l.id, l.admin_user_id, l.action, l.target_type, l.target_id, l.metadata,
            l.ip_address, l.created_at, o.email AS admin_email
     FROM admin_audit_log l
     JOIN admin_operators o ON o.id = l.admin_user_id
     WHERE ${where}
     ORDER BY l.created_at DESC
     LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
    [...queryParams, limit, offset],
  );

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    limit,
    entries: result.rows.map((row) => ({
      id: String(row.id),
      adminUserId: String(row.admin_user_id),
      adminEmail: String(row.admin_email),
      action: String(row.action),
      targetType: String(row.target_type),
      targetId: String(row.target_id),
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
    })),
  };
}

export async function queryAuditLogAdmins(): Promise<Array<{ id: string; email: string }>> {
  const result = await pool.query(
    `SELECT DISTINCT o.id, o.email
     FROM admin_operators o
     JOIN admin_audit_log l ON l.admin_user_id = o.id
     ORDER BY o.email ASC`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    email: String(row.email),
  }));
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function auditLogToCsv(entries: AuditLogEntry[]): string {
  const header = 'time,admin,action,target_type,target_id,ip_address,metadata';
  const lines = entries.map((entry) =>
    [
      entry.createdAt,
      csvEscape(entry.adminEmail),
      csvEscape(entry.action),
      csvEscape(entry.targetType),
      csvEscape(entry.targetId),
      csvEscape(entry.ipAddress ?? ''),
      csvEscape(JSON.stringify(entry.metadata)),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
