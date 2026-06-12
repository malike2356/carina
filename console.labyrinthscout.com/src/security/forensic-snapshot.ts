import { pool } from '../db.js';

export interface ForensicArtifacts {
  prompt_history: Array<Record<string, unknown>>;
  rag_provenance: Array<Record<string, unknown>>;
  tool_sequence: Array<Record<string, unknown>>;
  identity: Record<string, unknown>;
  downstream_agents: Array<Record<string, unknown>>;
  llm_trace: Array<Record<string, unknown>>;
}

export interface ForensicSnapshotResult {
  snapshotId: string;
  instanceId: string;
  reason: string;
  artifacts: ForensicArtifacts;
}

export async function captureForensicSnapshot(
  instanceId: string,
  reason: string,
  windowMinutes = 30,
): Promise<ForensicSnapshotResult> {
  const [instance, events] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      status: string;
      account_id: string | null;
      last_heartbeat: Date | null;
    }>(
      `SELECT id, name, status, account_id, last_heartbeat
       FROM carina_instances WHERE id = $1 LIMIT 1`,
      [instanceId],
    ),
    pool.query<{
      id: string;
      severity: string;
      event_type: string;
      description: string;
      metadata: Record<string, unknown> | string | null;
      session_id: string | null;
      parent_session_id: string | null;
      root_session_id: string | null;
      created_at: Date;
    }>(
      `SELECT id, severity, event_type, description, metadata,
              session_id, parent_session_id, root_session_id, created_at
       FROM security_events
       WHERE instance_id = $1
         AND created_at > NOW() - ($2::text || ' minutes')::interval
       ORDER BY created_at DESC
       LIMIT 200`,
      [instanceId, String(windowMinutes)],
    ),
  ]);

  const instanceRow = instance.rows[0];
  const rows = events.rows.map((row) => ({
    ...row,
    metadata: normalizeMetadata(row.metadata),
  }));

  const artifacts: ForensicArtifacts = {
    prompt_history: rows
      .filter((row) => /injection|prompt|jailbreak/.test(row.event_type))
      .map((row) => eventArtifact(row)),
    rag_provenance: rows
      .filter((row) => /rag|retrieval|context/.test(row.event_type) || hasMetaKey(row.metadata, 'rag'))
      .map((row) => eventArtifact(row)),
    tool_sequence: rows
      .filter((row) => /tool|shell|code|http|file|email/.test(row.event_type))
      .map((row) => eventArtifact(row)),
    identity: {
      instance_id: instanceRow?.id ?? instanceId,
      name: instanceRow?.name ?? null,
      status: instanceRow?.status ?? null,
      account_id: instanceRow?.account_id ?? null,
      last_heartbeat: instanceRow?.last_heartbeat
        ? new Date(instanceRow.last_heartbeat).toISOString()
        : null,
      captured_at: new Date().toISOString(),
      reason,
      session_lineage: [
        ...new Map(
          rows
            .filter((r) => r.session_id)
            .map((r) => [r.session_id, { session_id: r.session_id, parent_session_id: r.parent_session_id, root_session_id: r.root_session_id }]),
        ).values(),
      ],
    },
    downstream_agents: rows
      .filter((row) => hasMetaKey(row.metadata, 'downstream') || /delegate|subagent/.test(row.event_type))
      .map((row) => eventArtifact(row)),
    llm_trace: rows
      .filter((row) => /model|llm|completion|session_metrics/.test(row.event_type))
      .map((row) => eventArtifact(row)),
  };

  const insert = await pool.query<{ id: string }>(
    `INSERT INTO forensic_snapshots (instance_id, reason, artifacts)
     VALUES ($1, $2, $3::jsonb)
     RETURNING id`,
    [instanceId, reason, JSON.stringify(artifacts)],
  );

  return {
    snapshotId: insert.rows[0]?.id ?? 'unknown',
    instanceId,
    reason,
    artifacts,
  };
}

function normalizeMetadata(raw: Record<string, unknown> | string | null): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { raw };
  }
}

function hasMetaKey(metadata: Record<string, unknown>, key: string): boolean {
  return Object.keys(metadata).some((k) => k.toLowerCase().includes(key));
}

function eventArtifact(row: {
  id: string;
  severity: string;
  event_type: string;
  description: string;
  metadata: Record<string, unknown>;
  session_id: string | null;
  parent_session_id: string | null;
  root_session_id: string | null;
  created_at: Date;
}): Record<string, unknown> {
  return {
    event_id: row.id,
    severity: row.severity,
    event_type: row.event_type,
    description: row.description,
    session_id: row.session_id,
    parent_session_id: row.parent_session_id,
    root_session_id: row.root_session_id,
    metadata: row.metadata,
    at: new Date(row.created_at).toISOString(),
  };
}
