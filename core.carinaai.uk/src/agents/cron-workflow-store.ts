import { pool } from '../memory/db.js';
import { v4 as uuidv4 } from 'uuid';
import type { ChannelName } from '../gateway/channels/channel-adapter.interface.js';
import type {
  CronWorkflow,
  CronWorkflowDefinition,
  CronWorkflowRun,
  CronWorkflowRunStatus,
  CronWorkflowStatus,
  CronWorkflowStepState,
} from './cron-workflow-types.js';

function rowToWorkflow(row: Record<string, unknown>): CronWorkflow {
  return {
    id: String(row.id),
    name: String(row.name),
    schedule: String(row.schedule),
    definition: row.definition as CronWorkflowDefinition,
    deliver: String(row.deliver ?? 'origin'),
    deliverChannels: (row.deliver_channels as string[]) ?? [],
    status: String(row.status ?? 'active') as CronWorkflowStatus,
    workdir: row.workdir ? String(row.workdir) : null,
    originSessionId: row.origin_session_id ? String(row.origin_session_id) : null,
    originChannel: row.origin_channel ? String(row.origin_channel) as ChannelName : null,
    originConversationId: row.origin_conversation_id ? String(row.origin_conversation_id) : null,
    originThreadId: row.origin_thread_id ? String(row.origin_thread_id) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function rowToRun(row: Record<string, unknown>): CronWorkflowRun {
  return {
    id: String(row.id),
    workflowId: String(row.workflow_id),
    status: String(row.status) as CronWorkflowRunStatus,
    currentStepId: row.current_step_id ? String(row.current_step_id) : null,
    stepStates: (row.step_states as Record<string, CronWorkflowStepState>) ?? {},
    context: (row.context as Record<string, string>) ?? {},
    error: row.error ? String(row.error) : null,
    startedAt: row.started_at ? new Date(String(row.started_at)) : null,
    finishedAt: row.finished_at ? new Date(String(row.finished_at)) : null,
    createdAt: new Date(String(row.created_at)),
  };
}

export async function createWorkflow(input: {
  name: string;
  schedule: string;
  definition: CronWorkflowDefinition;
  deliver?: string;
  deliverChannels?: string[];
  workdir?: string | null;
  originSessionId?: string | null;
  originChannel?: ChannelName | null;
  originConversationId?: string | null;
  originThreadId?: string | null;
  status?: CronWorkflowStatus;
}): Promise<CronWorkflow> {
  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO cron_workflows
       (id, name, schedule, definition, deliver, deliver_channels, status, workdir,
        origin_session_id, origin_channel, origin_conversation_id, origin_thread_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      id,
      input.name,
      input.schedule,
      JSON.stringify(input.definition),
      input.deliver ?? 'origin',
      input.deliverChannels ?? [],
      input.status ?? 'active',
      input.workdir ?? null,
      input.originSessionId ?? null,
      input.originChannel ?? null,
      input.originConversationId ?? null,
      input.originThreadId ?? null,
    ],
  );
  return rowToWorkflow(result.rows[0]);
}

export async function listWorkflows(): Promise<CronWorkflow[]> {
  const result = await pool.query(
    `SELECT * FROM cron_workflows WHERE status != 'removed' ORDER BY created_at DESC`,
  );
  return result.rows.map(rowToWorkflow);
}

export async function getWorkflow(id: string): Promise<CronWorkflow | null> {
  const result = await pool.query(`SELECT * FROM cron_workflows WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToWorkflow(result.rows[0]);
}

export async function updateWorkflow(
  id: string,
  patch: Partial<Pick<CronWorkflow, 'name' | 'schedule' | 'definition' | 'deliver' | 'deliverChannels' | 'status' | 'workdir'>>,
): Promise<CronWorkflow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    name: patch.name,
    schedule: patch.schedule,
    definition: patch.definition ? JSON.stringify(patch.definition) : undefined,
    deliver: patch.deliver,
    deliver_channels: patch.deliverChannels,
    status: patch.status,
    workdir: patch.workdir,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getWorkflow(id);
  values.push(id);
  const result = await pool.query(
    `UPDATE cron_workflows SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (result.rows.length === 0) return null;
  return rowToWorkflow(result.rows[0]);
}

export async function removeWorkflow(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE cron_workflows SET status = 'removed', updated_at = NOW() WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function createWorkflowRun(workflowId: string): Promise<CronWorkflowRun> {
  const result = await pool.query(
    `INSERT INTO cron_workflow_runs (id, workflow_id, status, step_states, context)
     VALUES ($1, $2, 'queued', '{}'::jsonb, '{}'::jsonb)
     RETURNING *`,
    [uuidv4(), workflowId],
  );
  return rowToRun(result.rows[0]);
}

export async function getWorkflowRun(id: string): Promise<CronWorkflowRun | null> {
  const result = await pool.query(`SELECT * FROM cron_workflow_runs WHERE id = $1`, [id]);
  if (result.rows.length === 0) return null;
  return rowToRun(result.rows[0]);
}

export async function listWorkflowRuns(workflowId: string, limit = 20): Promise<CronWorkflowRun[]> {
  const result = await pool.query(
    `SELECT * FROM cron_workflow_runs WHERE workflow_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [workflowId, limit],
  );
  return result.rows.map(rowToRun);
}

export async function patchWorkflowRun(
  id: string,
  patch: Partial<Pick<CronWorkflowRun, 'status' | 'currentStepId' | 'stepStates' | 'context' | 'error' | 'startedAt' | 'finishedAt'>>,
): Promise<CronWorkflowRun | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;
  const map: Record<string, unknown> = {
    status: patch.status,
    current_step_id: patch.currentStepId,
    step_states: patch.stepStates ? JSON.stringify(patch.stepStates) : undefined,
    context: patch.context ? JSON.stringify(patch.context) : undefined,
    error: patch.error,
    started_at: patch.startedAt,
    finished_at: patch.finishedAt,
  };
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = $${idx++}`);
      values.push(val);
    }
  }
  if (fields.length === 0) return getWorkflowRun(id);
  values.push(id);
  const result = await pool.query(
    `UPDATE cron_workflow_runs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  );
  if (result.rows.length === 0) return null;
  return rowToRun(result.rows[0]);
}
