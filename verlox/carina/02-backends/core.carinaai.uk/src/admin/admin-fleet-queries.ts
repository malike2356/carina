import { pool } from '../memory/db.js';

const SEVERITY_ORDER = `CASE severity WHEN 'critical' THEN 3 WHEN 'warning' THEN 2 ELSE 1 END`;

export interface FleetListParams {
  search?: string;
  status?: string;
  hasRecentSignals?: boolean;
  sort?: string;
  page?: number;
  limit?: number;
}

function fleetSortClause(sort: string): string {
  if (sort === 'last_active_desc') return 'last_active_at DESC NULLS LAST';
  if (sort === 'created_at_desc') return 'w.created_at DESC';
  return 'escalation_rate DESC NULLS LAST, w.created_at DESC';
}

export async function queryFleetList(params: FleetListParams) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(200, Math.max(1, params.limit ?? 100));
  const offset = (page - 1) * limit;
  const status = params.status ?? 'all';
  const search = params.search?.trim() ?? '';

  const conditions = [`w.status != 'dismissed'`];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (status !== 'all') {
    conditions.push(`w.status = $${idx++}`);
    queryParams.push(status);
  }
  if (search) {
    conditions.push(
      `(w.name ILIKE $${idx} OR w.role_description ILIKE $${idx} OR c.owner_email ILIKE $${idx} OR w.workspace_id::text ILIKE $${idx})`,
    );
    queryParams.push(`%${search}%`);
    idx++;
  }
  if (params.hasRecentSignals) {
    conditions.push(`COALESCE(sig.recent_signal_count, 0) > 0`);
  }

  const where = conditions.join(' AND ');
  const sort = fleetSortClause(params.sort ?? 'escalation_rate_desc');

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM ai_workers w
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS recent_signal_count
       FROM scout_signal_cache s
       WHERE s.agent_id = w.id AND s.created_at > NOW() - INTERVAL '24 hours'
     ) sig ON true
     WHERE ${where}`,
    queryParams,
  );

  const listResult = await pool.query(
    `SELECT w.id, w.name, w.role_description, w.status, w.workspace_id, w.created_at,
            c.owner_email, c.owner_name, s.plan_tier,
            COALESCE(act.total_messages, 0)::int AS total_messages,
            COALESCE(act.messages_last_7d, 0)::int AS messages_last_7d,
            COALESCE(act.escalation_count, 0)::int AS escalation_count,
            CASE WHEN COALESCE(act.total_messages, 0) > 0
              THEN COALESCE(act.escalation_count, 0)::float / act.total_messages
              ELSE 0 END AS escalation_rate,
            COALESCE(act.automations_run_count, 0)::int AS automations_run_count,
            COALESCE(att.attestation_total, 0)::int AS attestation_total,
            COALESCE(att.attestation_confirmed, 0)::int AS attestation_confirmed,
            CASE WHEN COALESCE(att.attestation_total, 0) > 0
              THEN COALESCE(att.attestation_confirmed, 0)::float / att.attestation_total
              ELSE 0 END AS attestation_coverage,
            COALESCE(sig.recent_signal_count, 0)::int AS recent_signal_count,
            sig.highest_recent_severity,
            act.last_active_at
     FROM ai_workers w
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     LEFT JOIN aiva_subscriptions s ON s.workspace_id = w.workspace_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total_messages,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS messages_last_7d,
              COUNT(*) FILTER (WHERE action_type = 'escalated')::int AS escalation_count,
              COUNT(*) FILTER (WHERE action_type = 'automation_ran')::int AS automations_run_count,
              MAX(created_at) AS last_active_at
       FROM ai_worker_activity a WHERE a.worker_id = w.id
     ) act ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS attestation_total,
              COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL)::int AS attestation_confirmed
       FROM ai_worker_activity a WHERE a.worker_id = w.id
     ) att ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS recent_signal_count,
              MAX(${SEVERITY_ORDER})::int AS severity_rank,
              CASE MAX(${SEVERITY_ORDER})
                WHEN 3 THEN 'critical' WHEN 2 THEN 'warning' ELSE 'info' END AS highest_recent_severity
       FROM scout_signal_cache s
       WHERE s.agent_id = w.id AND s.created_at > NOW() - INTERVAL '24 hours'
     ) sig ON true
     WHERE ${where}
     ORDER BY ${sort}
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...queryParams, limit, offset],
  );

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    limit,
    aivas: listResult.rows.map((row) => mapFleetRow(row as Record<string, unknown>)),
  };
}

function mapFleetRow(row: Record<string, unknown>) {
  const workspaceId = String(row.workspace_id);
  return {
    workerId: String(row.id),
    name: String(row.name),
    role: String(row.role_description ?? ''),
    status: String(row.status),
    workspaceId,
    workspaceName: String(row.owner_name || row.owner_email || workspaceId).slice(0, 48),
    ownerEmail: row.owner_email ? String(row.owner_email) : null,
    planTier: row.plan_tier ? String(row.plan_tier) : 'trial',
    createdAt: new Date(String(row.created_at)).toISOString(),
    lastActiveAt: row.last_active_at ? new Date(String(row.last_active_at)).toISOString() : null,
    totalMessages: Number(row.total_messages ?? 0),
    messagesLast7d: Number(row.messages_last_7d ?? 0),
    escalationCount: Number(row.escalation_count ?? 0),
    escalationRate: Number(row.escalation_rate ?? 0),
    automationsRunCount: Number(row.automations_run_count ?? 0),
    scoutRegistered: true,
    attestationTotal: Number(row.attestation_total ?? 0),
    attestationConfirmed: Number(row.attestation_confirmed ?? 0),
    attestationCoverage: Number(row.attestation_coverage ?? 0),
    recentSignalCount: Number(row.recent_signal_count ?? 0),
    highestRecentSeverity: row.highest_recent_severity ? String(row.highest_recent_severity) : null,
  };
}

export async function queryFleetDetail(workerId: string) {
  const single = await pool.query(
    `SELECT w.id, w.name, w.role_description, w.status, w.workspace_id, w.created_at,
            c.owner_email, c.owner_name, s.plan_tier,
            COALESCE(act.total_messages, 0)::int AS total_messages,
            COALESCE(act.messages_last_7d, 0)::int AS messages_last_7d,
            COALESCE(act.escalation_count, 0)::int AS escalation_count,
            CASE WHEN COALESCE(act.total_messages, 0) > 0
              THEN COALESCE(act.escalation_count, 0)::float / act.total_messages
              ELSE 0 END AS escalation_rate,
            COALESCE(act.automations_run_count, 0)::int AS automations_run_count,
            COALESCE(att.attestation_total, 0)::int AS attestation_total,
            COALESCE(att.attestation_confirmed, 0)::int AS attestation_confirmed,
            CASE WHEN COALESCE(att.attestation_total, 0) > 0
              THEN COALESCE(att.attestation_confirmed, 0)::float / att.attestation_total
              ELSE 0 END AS attestation_coverage,
            COALESCE(sig.recent_signal_count, 0)::int AS recent_signal_count,
            sig.highest_recent_severity,
            act.last_active_at
     FROM ai_workers w
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     LEFT JOIN aiva_subscriptions s ON s.workspace_id = w.workspace_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS total_messages,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS messages_last_7d,
              COUNT(*) FILTER (WHERE action_type = 'escalated')::int AS escalation_count,
              COUNT(*) FILTER (WHERE action_type = 'automation_ran')::int AS automations_run_count,
              MAX(created_at) AS last_active_at
       FROM ai_worker_activity a WHERE a.worker_id = w.id
     ) act ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS attestation_total,
              COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL)::int AS attestation_confirmed
       FROM ai_worker_activity a WHERE a.worker_id = w.id
     ) att ON true
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS recent_signal_count,
              CASE MAX(${SEVERITY_ORDER})
                WHEN 3 THEN 'critical' WHEN 2 THEN 'warning' ELSE 'info' END AS highest_recent_severity
       FROM scout_signal_cache s
       WHERE s.agent_id = w.id AND s.created_at > NOW() - INTERVAL '24 hours'
     ) sig ON true
     WHERE w.id = $1 AND w.status != 'dismissed'`,
    [workerId],
  );
  const row = single.rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const summary = mapFleetRow(row);

  const [activity, signals, channels, automations] = await Promise.all([
    pool.query(
      `SELECT id, action_type, summary, input_text, output_text, attestation_tx, created_at
       FROM ai_worker_activity WHERE worker_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [workerId],
    ),
    pool.query(
      `SELECT id, event_type, severity, summary, metadata, created_at
       FROM scout_signal_cache WHERE agent_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [workerId],
    ),
    pool.query(
      `SELECT channel, identifier, enabled FROM ai_worker_channels WHERE worker_id = $1`,
      [workerId],
    ),
    pool.query(
      `SELECT id, name, schedule_label, enabled, last_run_at, next_run_at
       FROM ai_worker_automations WHERE worker_id = $1 ORDER BY created_at DESC`,
      [workerId],
    ),
  ]);

  return {
    ...summary,
    recentActivity: activity.rows.map((row) => ({
      id: String(row.id),
      actionType: String(row.action_type),
      summary: String(row.summary ?? ''),
      inputSummary: row.input_text ? String(row.input_text).slice(0, 120) : null,
      outputSummary: row.output_text ? String(row.output_text).slice(0, 120) : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
      attestationTx: row.attestation_tx ? String(row.attestation_tx) : null,
    })),
    recentSignals: signals.rows.map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      severity: String(row.severity),
      summary: String(row.summary),
      metadata: row.metadata ?? {},
      createdAt: new Date(String(row.created_at)).toISOString(),
    })),
    channels: channels.rows.map((row) => ({
      channel: String(row.channel),
      identifier: String(row.identifier),
      enabled: Boolean(row.enabled),
    })),
    automations: automations.rows.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      scheduleLabel: String(row.schedule_label ?? ''),
      enabled: Boolean(row.enabled),
      lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)).toISOString() : null,
      nextRunAt: row.next_run_at ? new Date(String(row.next_run_at)).toISOString() : null,
    })),
  };
}

export async function queryScoutSignals(params: {
  severity?: string;
  eventType?: string;
  agentId?: string;
  workspaceId?: string;
  since?: string;
  until?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? 50);
  const offset = (page - 1) * limit;
  const conditions = ['1=1'];
  const queryParams: unknown[] = [];
  let idx = 1;

  if (params.severity && params.severity !== 'all') {
    conditions.push(`s.severity = $${idx++}`);
    queryParams.push(params.severity);
  }
  if (params.eventType && params.eventType !== 'all') {
    conditions.push(`s.event_type = $${idx++}`);
    queryParams.push(params.eventType);
  }
  if (params.agentId) {
    conditions.push(`s.agent_id = $${idx++}`);
    queryParams.push(params.agentId);
  }
  if (params.workspaceId) {
    conditions.push(`w.workspace_id = $${idx++}`);
    queryParams.push(params.workspaceId);
  }
  if (params.since) {
    conditions.push(`s.created_at >= $${idx++}`);
    queryParams.push(params.since);
  }
  if (params.until) {
    conditions.push(`s.created_at <= $${idx++}`);
    queryParams.push(params.until);
  }

  const where = conditions.join(' AND ');
  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM scout_signal_cache s
     JOIN ai_workers w ON w.id = s.agent_id
     WHERE ${where}`,
    queryParams,
  );

  const result = await pool.query(
    `SELECT s.id, s.agent_id, s.event_type, s.severity, s.summary, s.metadata, s.scout_tx, s.created_at,
            w.name AS agent_name, w.workspace_id, c.owner_email, c.owner_name
     FROM scout_signal_cache s
     JOIN ai_workers w ON w.id = s.agent_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     WHERE ${where}
     ORDER BY s.created_at DESC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...queryParams, limit, offset],
  );

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    page,
    limit,
    signals: result.rows.map((row) => ({
      id: String(row.id),
      agentId: String(row.agent_id),
      agentName: String(row.agent_name),
      workspaceId: String(row.workspace_id),
      workspaceName: String(row.owner_name || row.owner_email || row.workspace_id).slice(0, 48),
      eventType: String(row.event_type),
      severity: String(row.severity),
      summary: String(row.summary),
      metadata: row.metadata ?? {},
      scoutTx: row.scout_tx ? String(row.scout_tx) : null,
      createdAt: new Date(String(row.created_at)).toISOString(),
    })),
  };
}

export async function queryAttestationReport() {
  const totals = await pool.query(
    `SELECT
       COUNT(*)::int AS total_records,
       COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL)::int AS confirmed,
       COUNT(*) FILTER (WHERE attestation_tx IS NULL AND created_at > NOW() - INTERVAL '1 hour')::int AS pending,
       COUNT(*) FILTER (WHERE attestation_tx IS NULL AND created_at <= NOW() - INTERVAL '1 hour')::int AS failed,
       COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS last24h_total,
       COUNT(*) FILTER (WHERE attestation_tx IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours')::int AS last24h_confirmed
     FROM ai_worker_activity`,
  );
  const row = totals.rows[0] as Record<string, unknown>;
  const totalRecords = Number(row.total_records ?? 0);
  const confirmed = Number(row.confirmed ?? 0);
  const last24hTotal = Number(row.last24h_total ?? 0);
  const last24hConfirmed = Number(row.last24h_confirmed ?? 0);

  const byWorker = await pool.query(
    `SELECT w.id AS worker_id, w.name AS worker_name, w.workspace_id,
            c.owner_name, c.owner_email,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE a.attestation_tx IS NOT NULL)::int AS confirmed
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     GROUP BY w.id, w.name, w.workspace_id, c.owner_name, c.owner_email
     HAVING COUNT(*) > 0
     ORDER BY (COUNT(*) FILTER (WHERE a.attestation_tx IS NOT NULL)::float / COUNT(*)) ASC
     LIMIT 20`,
  );

  return {
    totalRecords,
    confirmed,
    pending: Number(row.pending ?? 0),
    failed: Number(row.failed ?? 0),
    coveragePercent: totalRecords > 0 ? (confirmed / totalRecords) * 100 : 0,
    last24hTotal,
    last24hConfirmed,
    last24hCoverage: last24hTotal > 0 ? (last24hConfirmed / last24hTotal) * 100 : 0,
    byWorker: byWorker.rows.map((w) => {
      const total = Number(w.total ?? 0);
      const workerConfirmed = Number(w.confirmed ?? 0);
      return {
        workerId: String(w.worker_id),
        workerName: String(w.worker_name),
        workspaceId: String(w.workspace_id),
        workspaceName: String(w.owner_name || w.owner_email || w.workspace_id).slice(0, 48),
        total,
        confirmed: workerConfirmed,
        coverage: total > 0 ? workerConfirmed / total : 0,
      };
    }),
  };
}

export async function queryUnattestedRecords(params: { page?: number; limit?: number; workerId?: string }) {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, params.limit ?? 50);
  const offset = (page - 1) * limit;
  const conditions = [`a.attestation_tx IS NULL`, `a.created_at < NOW() - INTERVAL '10 minutes'`];
  const queryParams: unknown[] = [];
  let idx = 1;
  if (params.workerId) {
    conditions.push(`a.worker_id = $${idx++}`);
    queryParams.push(params.workerId);
  }
  const where = conditions.join(' AND ');

  const result = await pool.query(
    `SELECT a.id, a.worker_id, a.action_type, a.created_at,
            w.name AS worker_name, w.workspace_id, c.owner_email, c.owner_name
     FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     LEFT JOIN aiva_workspace_contacts c ON c.workspace_id = w.workspace_id
     WHERE ${where}
     ORDER BY a.created_at ASC
     LIMIT $${idx} OFFSET $${idx + 1}`,
    [...queryParams, limit, offset],
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    workerId: String(row.worker_id),
    workerName: String(row.worker_name),
    workspaceId: String(row.workspace_id),
    workspaceName: String(row.owner_name || row.owner_email || row.workspace_id).slice(0, 48),
    actionType: String(row.action_type),
    createdAt: new Date(String(row.created_at)).toISOString(),
  }));
}
