import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { auditLog } from '@/db/schema';

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

export async function writeAuditLog(input: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  detail?: Record<string, unknown>;
  ip?: string | null;
}): Promise<void> {
  await db.insert(auditLog).values({
    workspaceId: input.workspaceId,
    userId: input.userId ?? null,
    action: input.action,
    detail: input.detail ?? null,
    ipHash: hashIp(input.ip),
  });
}

export async function listAuditLog(workspaceId: string, actionPrefix?: string, limit = 10) {
  const rows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.workspaceId, workspaceId))
    .orderBy(auditLog.createdAt)
    .limit(limit * 3);

  const filtered = actionPrefix
    ? rows.filter((row) => row.action.startsWith(actionPrefix))
    : rows;

  return filtered.slice(-limit).reverse();
}
