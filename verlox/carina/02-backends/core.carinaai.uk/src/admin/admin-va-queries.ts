import { pool } from '../memory/db.js';

export async function queryVaTeam() {
  const result = await pool.query(
    `SELECT m.*,
            COUNT(e.id) FILTER (
              WHERE e.assigned_to = m.id::text AND e.resolved_at > NOW() - INTERVAL '30 days'
            )::int AS resolved_last_30d,
            AVG(EXTRACT(EPOCH FROM (e.resolved_at - e.created_at)) / 60) FILTER (
              WHERE e.assigned_to = m.id::text AND e.resolved_at IS NOT NULL
            ) AS avg_resolution_minutes
     FROM va_team_members m
     LEFT JOIN ai_worker_escalations e ON e.assigned_to = m.id::text
     GROUP BY m.id
     ORDER BY m.available DESC, m.current_load ASC`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    available: Boolean(row.available),
    currentLoad: Number(row.current_load ?? 0),
    maxLoad: Number(row.max_load ?? 5),
    createdAt: new Date(String(row.created_at)).toISOString(),
    resolvedLast30d: Number(row.resolved_last_30d ?? 0),
    avgResolutionMinutes: row.avg_resolution_minutes
      ? Math.round(Number(row.avg_resolution_minutes))
      : null,
  }));
}

export async function queryVaSla(since?: string) {
  const sinceDate = since ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const totals = await pool.query(
    `SELECT
       COUNT(*)::int AS total_escalations,
       COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved_count,
       COUNT(*) FILTER (WHERE
         (first_response_at IS NULL AND sla_first_response_target < NOW())
         OR (resolved_at IS NULL AND sla_resolution_target < NOW())
       )::int AS breached_count,
       AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) FILTER (WHERE first_response_at IS NOT NULL) AS avg_ttfr,
       AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) FILTER (WHERE resolved_at IS NOT NULL) AS avg_ttr,
       COUNT(*) FILTER (WHERE first_response_at IS NOT NULL AND first_response_at <= sla_first_response_target)::int AS met_fr,
       COUNT(*) FILTER (WHERE first_response_at IS NOT NULL)::int AS responded_count,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= sla_resolution_target)::int AS met_res,
       COUNT(*) FILTER (WHERE resolved_at IS NOT NULL)::int AS resolved_with_sla
     FROM ai_worker_escalations
     WHERE created_at >= $1`,
    [sinceDate],
  );
  const row = totals.rows[0] as Record<string, unknown>;
  const total = Number(row.total_escalations ?? 0);
  const responded = Number(row.responded_count ?? 0);
  const resolvedWithSla = Number(row.resolved_with_sla ?? 0);

  const byPriority = await pool.query(
    `SELECT priority,
            COUNT(*)::int AS count,
            AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) FILTER (WHERE resolved_at IS NOT NULL) AS avg_ttr,
            COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at <= sla_resolution_target)::float
              / NULLIF(COUNT(*) FILTER (WHERE resolved_at IS NOT NULL), 0) AS sla_rate
     FROM ai_worker_escalations
     WHERE created_at >= $1
     GROUP BY priority`,
    [sinceDate],
  );

  const byVa = await pool.query(
    `SELECT m.id, m.name,
            COUNT(e.id)::int AS assigned,
            COUNT(e.id) FILTER (WHERE e.status = 'resolved')::int AS resolved,
            AVG(EXTRACT(EPOCH FROM (e.resolved_at - e.created_at)) / 60) FILTER (WHERE e.resolved_at IS NOT NULL) AS avg_ttr,
            COUNT(*) FILTER (WHERE e.resolved_at IS NOT NULL AND e.resolved_at <= e.sla_resolution_target)::float
              / NULLIF(COUNT(*) FILTER (WHERE e.resolved_at IS NOT NULL), 0) AS sla_rate
     FROM va_team_members m
     LEFT JOIN ai_worker_escalations e ON e.assigned_to = m.id::text AND e.created_at >= $1
     GROUP BY m.id, m.name`,
    [sinceDate],
  );

  const timeline = await pool.query(
    `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS date,
            COUNT(*)::int AS received,
            COUNT(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            COUNT(*) FILTER (WHERE
              (first_response_at IS NULL AND sla_first_response_target < NOW())
              OR (resolved_at IS NULL AND sla_resolution_target < NOW())
            )::int AS breached
     FROM ai_worker_escalations
     WHERE created_at >= $1
     GROUP BY 1
     ORDER BY 1 ASC`,
    [sinceDate],
  );

  return {
    totalEscalations: total,
    resolvedCount: Number(row.resolved_count ?? 0),
    breachedCount: Number(row.breached_count ?? 0),
    breachRate: total > 0 ? Number(row.breached_count ?? 0) / total : 0,
    avgMinutesToFirstResponse: Math.round(Number(row.avg_ttfr ?? 0)),
    avgMinutesToResolution: Math.round(Number(row.avg_ttr ?? 0)),
    p95MinutesToFirstResponse: Math.round(Number(row.avg_ttfr ?? 0) * 1.5),
    p95MinutesToResolution: Math.round(Number(row.avg_ttr ?? 0) * 1.5),
    metFirstResponseTarget: Number(row.met_fr ?? 0),
    metResolutionTarget: Number(row.met_res ?? 0),
    firstResponseSlaRate: responded > 0 ? Number(row.met_fr ?? 0) / responded : 0,
    resolutionSlaRate:
      resolvedWithSla > 0 ? Number(row.met_res ?? 0) / resolvedWithSla : 0,
    byPriority: byPriority.rows.map((p) => ({
      priority: String(p.priority),
      count: Number(p.count ?? 0),
      avgMinutesToResolution: Math.round(Number(p.avg_ttr ?? 0)),
      slaRate: Number(p.sla_rate ?? 0),
    })),
    byVaMember: byVa.rows.map((m) => ({
      id: String(m.id),
      name: String(m.name),
      assigned: Number(m.assigned ?? 0),
      resolved: Number(m.resolved ?? 0),
      avgMinutesToResolution: Math.round(Number(m.avg_ttr ?? 0)),
      slaRate: Number(m.sla_rate ?? 0),
    })),
    timeline: timeline.rows.map((t) => ({
      date: String(t.date),
      received: Number(t.received ?? 0),
      resolved: Number(t.resolved ?? 0),
      breached: Number(t.breached ?? 0),
    })),
  };
}

export async function assignEscalation(escalationId: string, assignedTo: string) {
  const member = await pool.query('SELECT id, name FROM va_team_members WHERE id = $1', [assignedTo]);
  if (member.rows.length === 0) throw new Error('VA team member not found');

  await pool.query(
    `UPDATE ai_worker_escalations SET
       assigned_to = $2, assigned_at = NOW(), status = 'in_progress'
     WHERE id = $1`,
    [escalationId, assignedTo],
  );
  await pool.query(
    `UPDATE va_team_members SET current_load = current_load + 1 WHERE id = $1`,
    [assignedTo],
  );

  return { id: assignedTo, name: String(member.rows[0].name) };
}

export async function markFirstResponse(escalationId: string) {
  const result = await pool.query(
    `UPDATE ai_worker_escalations SET
       first_response_at = NOW(), status = 'in_progress'
     WHERE id = $1 AND first_response_at IS NULL
     RETURNING first_response_at`,
    [escalationId],
  );
  if (result.rows.length === 0) throw new Error('Already responded or not found');
  return new Date(String(result.rows[0].first_response_at)).toISOString();
}
