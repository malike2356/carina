import crypto from 'crypto';
import type { Request } from 'express';
import { pool } from '../memory/db.js';
import { PLAN_FEATURES, type PlanTier } from './plan-features.js';
import { queryForOrg } from './scoped-query.js';
import { redactSecretsRecord } from './redact.js';

export interface AuditEventInput {
  orgId: string;
  actorUserId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

export interface AuditRow {
  id: string;
  orgId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  details: Record<string, unknown>;
  createdAt: Date;
}

export interface AuditListResult {
  events: AuditRow[];
  nextCursor?: string;
}

function redactDetails(details: Record<string, unknown>): Record<string, unknown> {
  const redacted = redactSecretsRecord(details);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(redacted)) {
    if (typeof value === 'string' && value.length > 500) {
      out[key] = `${value.slice(0, 500)}...`;
    } else {
      out[key] = value;
    }
  }
  return out;
}

function hashIp(req?: Request): string | null {
  const ip = req?.ip ?? req?.socket?.remoteAddress;
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
}

export async function writeProductAudit(event: AuditEventInput): Promise<void> {
  const details = redactDetails(event.details ?? {});
  await pool.query(
    `INSERT INTO product_audit_log
      (org_id, actor_user_id, action, resource_type, resource_id, details, ip_hash)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [
      event.orgId,
      event.actorUserId ?? null,
      event.action,
      event.resourceType ?? null,
      event.resourceId ?? null,
      JSON.stringify(details),
      hashIp(event.req),
    ],
  );
}

export async function listProductAudit(
  orgId: string,
  opts?: { limit?: number; since?: Date; action?: string },
): Promise<AuditRow[]> {
  const limit = opts?.limit ?? 50;
  const params: unknown[] = [orgId];
  let sql = `SELECT id, org_id, actor_user_id, action, resource_type, resource_id, details, created_at
             FROM product_audit_log
             WHERE org_id = $1`;
  if (opts?.since) {
    params.push(opts.since);
    sql += ` AND created_at >= $${params.length}`;
  }
  if (opts?.action) {
    params.push(opts.action);
    sql += ` AND action = $${params.length}`;
  }
  params.push(limit);
  sql += ` ORDER BY created_at DESC LIMIT $${params.length}`;

  const result = await queryForOrg(orgId, sql, params.slice(1));
  return result.rows.map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorEmail: null,
    action: String(row.action),
    resourceType: row.resource_type ? String(row.resource_type) : null,
    resourceId: row.resource_id ? String(row.resource_id) : null,
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: row.created_at as Date,
  }));
}

function retentionSince(plan: PlanTier): Date | null {
  const days = PLAN_FEATURES[plan].auditRetentionDays;
  if (days <= 0) return null;
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  return since;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf-8');
    const pipe = raw.lastIndexOf('|');
    if (pipe <= 0) return null;
    const createdAt = new Date(raw.slice(0, pipe));
    const id = raw.slice(pipe + 1);
    if (Number.isNaN(createdAt.getTime()) || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export async function listProductAuditForPlan(
  orgId: string,
  plan: PlanTier,
  opts?: { limit?: number; cursor?: string },
): Promise<AuditListResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 100);
  const since = retentionSince(plan);
  const params: unknown[] = [orgId];
  let sql = `SELECT a.id, a.org_id, a.actor_user_id, u.email AS actor_email,
                    a.action, a.resource_type, a.resource_id, a.details, a.created_at
             FROM product_audit_log a
             LEFT JOIN hosted_users u ON u.id = a.actor_user_id
             WHERE a.org_id = $1`;

  if (since) {
    params.push(since);
    sql += ` AND a.created_at >= $${params.length}`;
  }

  const decoded = opts?.cursor ? decodeCursor(opts.cursor) : null;
  if (decoded) {
    params.push(decoded.createdAt, decoded.id);
    sql += ` AND (a.created_at, a.id) < ($${params.length - 1}, $${params.length})`;
  }

  params.push(limit + 1);
  sql += ` ORDER BY a.created_at DESC, a.id DESC LIMIT $${params.length}`;

  const result = await queryForOrg(orgId, sql, params.slice(1));
  const rows = result.rows.map((row) => ({
    id: String(row.id),
    orgId: String(row.org_id),
    actorUserId: row.actor_user_id ? String(row.actor_user_id) : null,
    actorEmail: row.actor_email ? String(row.actor_email) : null,
    action: String(row.action),
    resourceType: row.resource_type ? String(row.resource_type) : null,
    resourceId: row.resource_id ? String(row.resource_id) : null,
    details: (row.details as Record<string, unknown>) ?? {},
    createdAt: row.created_at as Date,
  }));

  let nextCursor: string | undefined;
  if (rows.length > limit) {
    const last = rows[limit - 1];
    nextCursor = encodeCursor(last.createdAt, last.id);
    rows.length = limit;
  }

  return { events: rows, nextCursor };
}

const CSV_EXPORT_LIMIT = 10_000;

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export async function exportProductAuditCsv(orgId: string, plan: PlanTier): Promise<string> {
  const since = retentionSince(plan);
  const params: unknown[] = [orgId];
  let sql = `SELECT a.id, a.action, u.email AS actor_email, a.resource_type, a.resource_id,
                    a.created_at, a.details
             FROM product_audit_log a
             LEFT JOIN hosted_users u ON u.id = a.actor_user_id
             WHERE a.org_id = $1`;

  if (since) {
    params.push(since);
    sql += ` AND a.created_at >= $${params.length}`;
  }

  params.push(CSV_EXPORT_LIMIT);
  sql += ` ORDER BY a.created_at DESC, a.id DESC LIMIT $${params.length}`;

  const result = await queryForOrg(orgId, sql, params.slice(1));
  const header = 'id,action,actor_email,resource_type,resource_id,created_at,details_json';
  const lines = result.rows.map((row) => {
    const details = redactDetails((row.details as Record<string, unknown>) ?? {});
    return [
      csvCell(row.id),
      csvCell(row.action),
      csvCell(row.actor_email ?? ''),
      csvCell(row.resource_type ?? ''),
      csvCell(row.resource_id ?? ''),
      csvCell((row.created_at as Date).toISOString()),
      csvCell(JSON.stringify(details)),
    ].join(',');
  });
  return [header, ...lines].join('\n');
}
