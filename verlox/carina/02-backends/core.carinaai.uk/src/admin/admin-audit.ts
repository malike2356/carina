import { pool } from '../memory/db.js';

export async function writeAdminAudit(input: {
  adminUserId: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO admin_audit_log (admin_user_id, action, target_type, target_id, metadata, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      input.adminUserId,
      input.action,
      input.targetType,
      input.targetId,
      JSON.stringify(input.metadata ?? {}),
      input.ipAddress ?? null,
    ],
  );
}
