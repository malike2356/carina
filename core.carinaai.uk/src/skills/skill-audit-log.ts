import { pool } from '../memory/db.js';

type AuditAction = 'created' | 'promoted' | 'archived' | 'consolidated' | 'merged' | 'refined' | 'demoted';

export async function logSkillAction(
  action: AuditAction,
  skillId: string | null,
  details?: Record<string, unknown>,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO skill_audit_log (skill_id, action, details) VALUES ($1, $2, $3)`,
      [skillId, action, details ? JSON.stringify(details) : null],
    );
  } catch {
    // audit log failure must never break the caller
  }
}
