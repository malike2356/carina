import { pool } from '../db.js';
import type { AlertSeverity } from '../alerts/types.js';
import type {
  PendingAction,
  ActionExecution,
  PendingActionStatus,
  ExecutionOutcome,
  ExecutionType,
} from './types.js';

interface PendingRow {
  id: string;
  event_id: string;
  playbook_id: string;
  status: string;
  resolved_by: string | null;
  resolved_at: Date | null;
  resolution: string | null;
  notes: string | null;
  created_at: Date;
  event_type?: string | null;
  severity?: string | null;
  description?: string | null;
  instance_id?: string | null;
  session_id?: string | null;
}

function mapPendingRow(row: PendingRow): PendingAction {
  return {
    id: row.id,
    eventId: row.event_id,
    playbookId: row.playbook_id,
    status: row.status as PendingActionStatus,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    resolution: row.resolution,
    notes: row.notes,
    createdAt: row.created_at,
    eventType: row.event_type ?? undefined,
    eventSeverity: (row.severity as AlertSeverity) ?? undefined,
    eventDescription: row.description ?? undefined,
    instanceId: row.instance_id ?? undefined,
    sessionId: row.session_id ?? undefined,
  };
}

export async function createPendingAction(
  eventId: string,
  playbookId: string,
): Promise<PendingAction> {
  const result = await pool.query<PendingRow>(
    `INSERT INTO pending_actions (event_id, playbook_id)
     VALUES ($1, $2)
     RETURNING id, event_id, playbook_id, status, resolved_by, resolved_at,
               resolution, notes, created_at`,
    [eventId, playbookId],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to create pending action');
  return mapPendingRow(row);
}

export async function getPendingAction(id: string): Promise<PendingAction | null> {
  const result = await pool.query<PendingRow>(
    `SELECT pa.id, pa.event_id, pa.playbook_id, pa.status, pa.resolved_by,
            pa.resolved_at, pa.resolution, pa.notes, pa.created_at,
            se.event_type, se.severity, se.description, se.instance_id, se.session_id
     FROM pending_actions pa
     LEFT JOIN security_events se ON pa.event_id = se.id
     WHERE pa.id = $1`,
    [id],
  );
  const row = result.rows[0];
  return row ? mapPendingRow(row) : null;
}

export async function listPendingActions(): Promise<PendingAction[]> {
  const result = await pool.query<PendingRow>(
    `SELECT pa.id, pa.event_id, pa.playbook_id, pa.status, pa.resolved_by,
            pa.resolved_at, pa.resolution, pa.notes, pa.created_at,
            se.event_type, se.severity, se.description, se.instance_id, se.session_id
     FROM pending_actions pa
     LEFT JOIN security_events se ON pa.event_id = se.id
     WHERE pa.status = 'pending'
     ORDER BY pa.created_at DESC`,
  );
  return result.rows.map(mapPendingRow);
}

export async function countPendingActions(): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM pending_actions WHERE status = 'pending'`,
  );
  return parseInt(result.rows[0]?.count ?? '0', 10);
}

export async function resolvePendingAction(
  id: string,
  resolvedBy: string,
  resolution: string,
  notes?: string,
): Promise<void> {
  await pool.query(
    `UPDATE pending_actions
     SET status = 'resolved', resolved_by = $2, resolved_at = NOW(),
         resolution = $3, notes = COALESCE($4, notes)
     WHERE id = $1 AND status = 'pending'`,
    [id, resolvedBy, resolution, notes ?? null],
  );
}

export async function dismissPendingAction(
  id: string,
  resolvedBy: string,
  notes?: string,
): Promise<void> {
  await pool.query(
    `UPDATE pending_actions
     SET status = 'dismissed', resolved_by = $2, resolved_at = NOW(),
         resolution = 'dismissed', notes = COALESCE($3, notes)
     WHERE id = $1 AND status = 'pending'`,
    [id, resolvedBy, notes ?? null],
  );
}

export async function logActionExecution(opts: {
  pendingId: string | null;
  eventId: string;
  actionId: string;
  actionLabel: string;
  executedBy: string;
  executionType: ExecutionType;
  outcome: ExecutionOutcome;
  output?: string;
  metadata?: Record<string, unknown>;
}): Promise<ActionExecution> {
  const result = await pool.query<{
    id: string;
    pending_id: string | null;
    event_id: string;
    action_id: string;
    action_label: string;
    executed_by: string;
    execution_type: string;
    outcome: string;
    output: string | null;
    metadata: Record<string, unknown>;
    executed_at: Date;
  }>(
    `INSERT INTO action_executions
       (pending_id, event_id, action_id, action_label, executed_by,
        execution_type, outcome, output, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      opts.pendingId,
      opts.eventId,
      opts.actionId,
      opts.actionLabel,
      opts.executedBy,
      opts.executionType,
      opts.outcome,
      opts.output ?? null,
      JSON.stringify(opts.metadata ?? {}),
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error('Failed to log action execution');
  return {
    id: row.id,
    pendingId: row.pending_id,
    eventId: row.event_id,
    actionId: row.action_id,
    actionLabel: row.action_label,
    executedBy: row.executed_by,
    executionType: row.execution_type as ExecutionType,
    outcome: row.outcome as ExecutionOutcome,
    output: row.output,
    metadata: row.metadata ?? {},
    executedAt: row.executed_at,
  };
}

export async function listActionExecutions(limit = 50): Promise<ActionExecution[]> {
  const result = await pool.query<{
    id: string;
    pending_id: string | null;
    event_id: string;
    action_id: string;
    action_label: string;
    executed_by: string;
    execution_type: string;
    outcome: string;
    output: string | null;
    metadata: Record<string, unknown>;
    executed_at: Date;
    event_type: string | null;
    severity: string | null;
  }>(
    `SELECT ae.*,
            se.event_type,
            se.severity
     FROM action_executions ae
     LEFT JOIN security_events se ON ae.event_id = se.id
     ORDER BY ae.executed_at DESC
     LIMIT $1`,
    [limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    pendingId: row.pending_id,
    eventId: row.event_id,
    actionId: row.action_id,
    actionLabel: row.action_label,
    executedBy: row.executed_by,
    executionType: row.execution_type as ExecutionType,
    outcome: row.outcome as ExecutionOutcome,
    output: row.output,
    metadata: {
      ...(row.metadata ?? {}),
      eventType: row.event_type,
      eventSeverity: row.severity,
    },
    executedAt: row.executed_at,
  }));
}
