import { pool } from '../memory/db.js';

export async function resolveJobId(ref: string): Promise<string | null> {
  const jobRef = ref.split(':')[0]!.trim();
  if (!jobRef) return null;

  const { getJob, listJobs } = await import('./cron-scheduler.js');
  const byId = await getJob(jobRef);
  if (byId) return byId.id;

  const jobs = await listJobs();
  const byName = jobs.find((j) => j.name === jobRef || j.id.startsWith(jobRef));
  return byName?.id ?? null;
}

export async function getCronJobOutput(jobId: string, runIndex = 0): Promise<string | null> {
  const offset = Math.max(0, runIndex);
  const result = await pool.query(
    `SELECT output FROM scheduled_task_runs
     WHERE job_id = $1
     ORDER BY completed_at DESC
     LIMIT 1 OFFSET $2`,
    [jobId, offset],
  );
  const output = result.rows[0]?.output;
  return output != null ? String(output) : null;
}

export async function incrementFailureCount(jobId: string): Promise<number> {
  const result = await pool.query(
    `UPDATE scheduled_tasks
     SET failure_count = COALESCE(failure_count, 0) + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING failure_count`,
    [jobId],
  );
  return Number(result.rows[0]?.failure_count ?? 0);
}

export async function resetFailureCount(jobId: string): Promise<void> {
  await pool.query(
    `UPDATE scheduled_tasks SET failure_count = 0, updated_at = NOW() WHERE id = $1`,
    [jobId],
  );
}
