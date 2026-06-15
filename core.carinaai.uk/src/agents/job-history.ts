import { pool } from '../memory/db.js';

export type JobRunHistoryRow = {
  id: string;
  jobId: string;
  jobName: string | null;
  profileName: string;
  output: string;
  success: boolean;
  completedAt: string;
};

export async function searchJobRunHistory(
  query: string,
  options?: { profileName?: string; limit?: number },
): Promise<JobRunHistoryRow[]> {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 25));
  const pattern = `%${query.trim()}%`;
  const profile = options?.profileName;

  const sql = profile
    ? `SELECT r.id, r.job_id, t.name, COALESCE(t.profile_name, 'default') AS profile_name,
              r.output, r.success, r.completed_at
       FROM scheduled_task_runs r
       JOIN scheduled_tasks t ON t.id = r.job_id
       WHERE COALESCE(t.profile_name, 'default') = $3
         AND (r.output ILIKE $1 OR COALESCE(t.name, '') ILIKE $1)
       ORDER BY r.completed_at DESC
       LIMIT $2`
    : `SELECT r.id, r.job_id, t.name, COALESCE(t.profile_name, 'default') AS profile_name,
              r.output, r.success, r.completed_at
       FROM scheduled_task_runs r
       JOIN scheduled_tasks t ON t.id = r.job_id
       WHERE r.output ILIKE $1 OR COALESCE(t.name, '') ILIKE $1
       ORDER BY r.completed_at DESC
       LIMIT $2`;

  const params = profile ? [pattern, limit, profile] : [pattern, limit];
  const result = await pool.query(sql, params);
  return result.rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    jobId: String(row.job_id),
    jobName: row.name ? String(row.name) : null,
    profileName: String(row.profile_name ?? 'default'),
    output: String(row.output ?? ''),
    success: Boolean(row.success),
    completedAt: new Date(String(row.completed_at)).toISOString(),
  }));
}
