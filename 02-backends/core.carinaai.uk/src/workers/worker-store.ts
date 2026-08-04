import { createHash } from 'crypto';
import { pool } from '../memory/db.js';
import type {
  ActivityEntry,
  AuditEntry,
  CreateAutomationParams,
  CreateEscalationParams,
  CreateWorkerParams,
  Escalation,
  UpdateWorkerParams,
  Worker,
  WorkerAutomation,
} from '../types/index.js';
import { attestActivity, registerAivaAgent, reportAivaEvent, updateAivaAgentStatus } from './scout-fleet.js';

async function releaseIsolatedWorkerThread(workerId: string): Promise<void> {
  try {
    const { isAivaWorkerIsolationEnabled, getAivaWorkerPool } = await import('../agents/worker-pool.js');
    if (!isAivaWorkerIsolationEnabled()) return;
    await getAivaWorkerPool().terminate(workerId);
  } catch {
    // Pool may not be initialized during tests or one-off CLI runs.
  }
}

function activityDigest(activity: ActivityEntry): string {
  const inputDigest = activity.inputText
    ? createHash('sha256').update(activity.inputText).digest('hex')
    : 'null';
  const outputDigest = activity.outputText
    ? createHash('sha256').update(activity.outputText).digest('hex')
    : 'null';
  return createHash('sha256')
    .update(activity.workerId)
    .update(activity.actionType)
    .update(activity.createdAt.toISOString())
    .update(inputDigest)
    .update(outputDigest)
    .digest('hex');
}

function rowToWorker(row: Record<string, unknown>): Worker {
  const workerConfig = row.worker_config && typeof row.worker_config === 'object'
    ? row.worker_config as import('../types/index.js').WorkerConfig
    : {};
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    roleDescription: String(row.role_description),
    templateId: row.template_id ? String(row.template_id) : null,
    personaPrompt: String(row.persona_prompt),
    skillPacks: (row.skill_packs as string[]) ?? [],
    channels: (row.channels as string[]) ?? [],
    language: String(row.language ?? 'en-GB'),
    status: String(row.status) as Worker['status'],
    escalationThreshold: Number(row.escalation_threshold ?? 60),
    propreneurTenantSlug: row.propreneur_tenant_slug ? String(row.propreneur_tenant_slug) : null,
    propreneurBridgeKeyRef: row.propreneur_bridge_key_ref ? String(row.propreneur_bridge_key_ref) : null,
    workerConfig,
    orgId: row.org_id ? String(row.org_id) : null,
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
  };
}

function rowToActivity(row: Record<string, unknown>): ActivityEntry {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    actionType: String(row.action_type) as ActivityEntry['actionType'],
    summary: String(row.summary),
    inputText: row.input_text ? String(row.input_text) : undefined,
    outputText: row.output_text ? String(row.output_text) : undefined,
    escalated: Boolean(row.escalated),
    attestationTx: row.attestation_tx ? String(row.attestation_tx) : null,
    channel: row.channel ? String(row.channel) : undefined,
    contactId: row.contact_id ? String(row.contact_id) : undefined,
    createdAt: new Date(String(row.created_at)),
  };
}

function rowToEscalation(row: Record<string, unknown>): Escalation {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    channel: String(row.channel),
    channelId: String(row.channel_id),
    originalInput: String(row.original_input),
    workerDraft: row.worker_draft ? String(row.worker_draft) : undefined,
    holdingMessage: String(row.holding_message),
    status: String(row.status) as Escalation['status'],
    assignedTo: row.assigned_to ? String(row.assigned_to) : undefined,
    resolvedAt: row.resolved_at ? new Date(String(row.resolved_at)) : undefined,
    resolutionText: row.resolution_text ? String(row.resolution_text) : undefined,
    createdAt: new Date(String(row.created_at)),
  };
}

function rowToAutomation(row: Record<string, unknown>): WorkerAutomation {
  return {
    id: String(row.id),
    workerId: String(row.worker_id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    description: String(row.description),
    cronExpression: String(row.cron_expression ?? ''),
    scheduleLabel: String(row.schedule_label),
    triggerType: (row.trigger_type as WorkerAutomation['triggerType']) ?? 'cron',
    triggerEvent: row.trigger_event ? String(row.trigger_event) : undefined,
    enabled: Boolean(row.enabled),
    lastRunAt: row.last_run_at ? new Date(String(row.last_run_at)) : undefined,
    nextRunAt: row.next_run_at ? new Date(String(row.next_run_at)) : undefined,
    createdAt: new Date(String(row.created_at)),
    timezone: row.timezone ? String(row.timezone) : 'UTC',
    actionType: row.action_type ? String(row.action_type) : 'aiva_prompt',
    approvalMode: row.approval_mode ? String(row.approval_mode) : 'require_write',
    schedule: (row.schedule_json && typeof row.schedule_json === 'object')
      ? row.schedule_json as Record<string, unknown>
      : null,
    action: (row.action_json && typeof row.action_json === 'object')
      ? row.action_json as Record<string, unknown>
      : null,
    conditions: Array.isArray(row.conditions_json) ? row.conditions_json as unknown[] : [],
    lastRunStatus: row.last_run_status != null ? String(row.last_run_status) : null,
    lastRunError: row.last_run_error != null ? String(row.last_run_error) : null,
    consecutiveFailures: Number(row.consecutive_failures ?? 0),
  };
}

export async function createWorker(workspaceId: string, params: CreateWorkerParams): Promise<Worker> {
  await pool.query(`ALTER TABLE ai_workers ADD COLUMN IF NOT EXISTS org_id UUID`);
  const result = await pool.query(
    `INSERT INTO ai_workers
       (workspace_id, org_id, name, role_description, template_id, persona_prompt, skill_packs, channels, language, escalation_threshold)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      workspaceId,
      params.orgId ?? null,
      params.name,
      params.roleDescription,
      params.templateId ?? null,
      params.personaPrompt,
      params.skillPacks,
      params.channels,
      params.language ?? 'en-GB',
      params.escalationThreshold ?? 60,
    ],
  );
  const worker = rowToWorker(result.rows[0]);
  void registerAivaAgent(worker).catch(() => {});
  try {
    const { ensureHostedEmailAddressForWorker } = await import(
      '../ingestion/email/hosted-email-address.js'
    );
    await ensureHostedEmailAddressForWorker({
      workspaceId,
      workerId: worker.id,
      workerName: worker.name,
    });
  } catch (err) {
    console.warn(
      '[worker-store] hosted email provision failed:',
      err instanceof Error ? err.message : String(err),
    );
  }
  return worker;
}

export async function getWorker(workspaceId: string, workerId: string): Promise<Worker | null> {
  const result = await pool.query(
    'SELECT * FROM ai_workers WHERE id = $1 AND workspace_id = $2',
    [workerId, workspaceId],
  );
  if (result.rows.length === 0) return null;
  return rowToWorker(result.rows[0]);
}

export async function getWorkerById(workerId: string): Promise<Worker | null> {
  const result = await pool.query('SELECT * FROM ai_workers WHERE id = $1', [workerId]);
  if (result.rows.length === 0) return null;
  return rowToWorker(result.rows[0]);
}

export async function listWorkers(workspaceId: string, orgId?: string | null): Promise<Worker[]> {
  // Unscoped workers (org_id NULL) stay visible in every org so older hires
  // and workspace-level Aivas still appear under Grant / Tools.
  const result = await pool.query(
    `SELECT * FROM ai_workers
     WHERE workspace_id = $1
       AND status != 'dismissed'
       AND ($2::uuid IS NULL OR org_id IS NULL OR org_id = $2::uuid)
     ORDER BY created_at DESC`,
    [workspaceId, orgId ?? null],
  );
  return result.rows.map(rowToWorker);
}

export async function updateWorker(
  workspaceId: string,
  workerId: string,
  patch: Partial<UpdateWorkerParams>,
): Promise<Worker> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (patch.name !== undefined) {
    fields.push(`name = $${idx++}`);
    values.push(patch.name);
  }
  if (patch.roleDescription !== undefined) {
    fields.push(`role_description = $${idx++}`);
    values.push(patch.roleDescription);
  }
  if (patch.personaPrompt !== undefined) {
    fields.push(`persona_prompt = $${idx++}`);
    values.push(patch.personaPrompt);
  }
  if (patch.language !== undefined) {
    fields.push(`language = $${idx++}`);
    values.push(patch.language);
  }
  if (patch.skillPacks !== undefined) {
    fields.push(`skill_packs = $${idx++}`);
    values.push(patch.skillPacks);
  }
  if (patch.channels !== undefined) {
    fields.push(`channels = $${idx++}`);
    values.push(patch.channels);
  }
  if (patch.workerConfig !== undefined) {
    fields.push(`worker_config = $${idx++}`);
    values.push(JSON.stringify(patch.workerConfig));
  }

  if (fields.length === 0) {
    const existing = await getWorker(workspaceId, workerId);
    if (!existing) throw new Error('Worker not found');
    return existing;
  }

  fields.push('updated_at = NOW()');
  values.push(workerId, workspaceId);

  const result = await pool.query(
    `UPDATE ai_workers SET ${fields.join(', ')} WHERE id = $${idx++} AND workspace_id = $${idx} RETURNING *`,
    values,
  );
  if (result.rows.length === 0) throw new Error('Worker not found');
  return rowToWorker(result.rows[0]);
}

export async function pauseWorker(workspaceId: string, workerId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE ai_workers SET status = 'paused', updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status != 'dismissed'
     RETURNING id`,
    [workerId, workspaceId],
  );
  if (result.rows.length === 0) {
    throw new Error('Dismissed Aivas cannot be paused or resumed');
  }
  void updateAivaAgentStatus(workerId, 'paused').catch(() => {});
  void releaseIsolatedWorkerThread(workerId);
}

export async function resumeWorker(workspaceId: string, workerId: string): Promise<void> {
  const result = await pool.query(
    `UPDATE ai_workers SET status = 'active', updated_at = NOW()
     WHERE id = $1 AND workspace_id = $2 AND status IN ('paused', 'suspended_by_scout')
     RETURNING id`,
    [workerId, workspaceId],
  );
  if (result.rows.length === 0) {
    throw new Error('Dismissed Aivas cannot be paused or resumed');
  }
  void updateAivaAgentStatus(workerId, 'active').catch(() => {});
}

export async function closeOpenEscalationsForWorker(
  workspaceId: string,
  workerId: string,
  resolutionText = 'Closed because this Aiva was dismissed',
): Promise<number> {
  const result = await pool.query(
    `UPDATE ai_worker_escalations
     SET status = 'resolved',
         resolution_text = $3,
         resolved_at = NOW(),
         first_response_at = COALESCE(first_response_at, NOW())
     WHERE workspace_id = $1
       AND worker_id = $2
       AND status = 'open'
     RETURNING id, assigned_to`,
    [workspaceId, workerId, resolutionText],
  );
  for (const row of result.rows) {
    const assignedTo = row.assigned_to ? String(row.assigned_to) : null;
    if (!assignedTo) continue;
    await pool.query(
      `UPDATE va_team_members SET current_load = GREATEST(0, current_load - 1) WHERE id = $1`,
      [assignedTo],
    );
  }
  return result.rows.length;
}

export async function dismissWorker(workspaceId: string, workerId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_workers SET status = 'dismissed', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`,
    [workerId, workspaceId],
  );
  await closeOpenEscalationsForWorker(workspaceId, workerId).catch((err) => {
    console.error('[worker-store] close escalations on dismiss failed:', err);
  });
  void updateAivaAgentStatus(workerId, 'dismissed').catch(() => {});
  void releaseIsolatedWorkerThread(workerId);
}

export async function addWorkerChannel(
  workerId: string,
  channel: string,
  identifier: string,
  workspaceId?: string,
): Promise<void> {
  let wsId = workspaceId;
  if (!wsId) {
    const worker = await pool.query('SELECT workspace_id FROM ai_workers WHERE id = $1', [workerId]);
    wsId = worker.rows[0]?.workspace_id ? String(worker.rows[0].workspace_id) : undefined;
  }
  await pool.query(
    `INSERT INTO ai_worker_channels (worker_id, workspace_id, channel, identifier, enabled)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (channel, identifier) DO UPDATE
       SET worker_id = EXCLUDED.worker_id,
           workspace_id = COALESCE(EXCLUDED.workspace_id, ai_worker_channels.workspace_id),
           enabled = true,
           updated_at = NOW()`,
    [workerId, wsId ?? '', channel, identifier],
  );
}

export async function getWorkerByChannel(channel: string, identifier: string): Promise<Worker | null> {
  const result = await pool.query(
    `SELECT w.* FROM ai_workers w
     JOIN ai_worker_channels c ON c.worker_id = w.id
     WHERE c.channel = $1 AND c.identifier = $2 AND w.status = 'active'
     LIMIT 1`,
    [channel, identifier],
  );
  if (result.rows.length === 0) return null;
  return rowToWorker(result.rows[0]);
}

export async function listWorkerChannels(
  workerId: string,
): Promise<Array<{ id: string; channel: string; identifier: string }>> {
  const result = await pool.query(
    'SELECT id, channel, identifier FROM ai_worker_channels WHERE worker_id = $1 ORDER BY connected_at ASC',
    [workerId],
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    channel: String(row.channel),
    identifier: String(row.identifier),
  }));
}

export async function removeWorkerChannel(workerId: string, channelRowId: string): Promise<boolean> {
  const result = await pool.query(
    'DELETE FROM ai_worker_channels WHERE worker_id = $1 AND id = $2 RETURNING id',
    [workerId, channelRowId],
  );
  return result.rows.length > 0;
}

export async function logActivity(
  workerId: string,
  entry: Omit<ActivityEntry, 'id' | 'workerId' | 'createdAt'> & { createdAt?: Date },
): Promise<ActivityEntry> {
  const createdAt = entry.createdAt ?? new Date();
  const result = await pool.query(
    `INSERT INTO ai_worker_activity
       (worker_id, action_type, summary, input_text, output_text, escalated, channel, contact_id, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [
      workerId,
      entry.actionType,
      entry.summary,
      entry.inputText ?? null,
      entry.outputText ?? null,
      entry.escalated ?? false,
      entry.channel ?? null,
      entry.contactId ?? null,
      createdAt,
    ],
  );
  const activity = rowToActivity(result.rows[0]);

  void reportAivaEvent({
    agentId: workerId,
    eventType: entry.actionType,
    severity: entry.escalated ? 'warning' : 'info',
    summary: entry.summary,
    metadata: {
      inputLength: entry.inputText?.length ?? 0,
      outputLength: entry.outputText?.length ?? 0,
    },
  }).catch(() => {});

  void attestActivity(activity, activityDigest(activity)).catch(() => {});

  return activity;
}

export async function listActivity(
  workspaceId: string,
  workerId: string,
  limit = 50,
): Promise<ActivityEntry[]> {
  const result = await pool.query(
    `SELECT a.* FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE a.worker_id = $1 AND w.workspace_id = $2
     ORDER BY a.created_at DESC LIMIT $3`,
    [workerId, workspaceId, limit],
  );
  return result.rows.map(rowToActivity);
}

export async function listOutboundCommunications(
  workspaceId: string,
  workerId: string,
  limit = 20,
): Promise<ActivityEntry[]> {
  const result = await pool.query(
    `SELECT a.* FROM ai_worker_activity a
     JOIN ai_workers w ON w.id = a.worker_id
     WHERE a.worker_id = $1 AND w.workspace_id = $2
       AND a.action_type IN ('message_sent', 'summary_sent', 'va_reply')
     ORDER BY a.created_at DESC
     LIMIT $3`,
    [workerId, workspaceId, limit],
  );
  return result.rows.map(rowToActivity);
}

export async function listAudit(
  workspaceId: string,
  workerId: string,
  limit = 100,
): Promise<AuditEntry[]> {
  const rows = await listActivity(workspaceId, workerId, limit);
  return rows.map((row) => ({
    ...row,
    attestationTx: row.attestationTx ?? null,
  }));
}

export async function createEscalation(params: CreateEscalationParams): Promise<Escalation> {
  const priority = deriveEscalationPriority(params.originalInput);
  const result = await pool.query(
    `INSERT INTO ai_worker_escalations
       (worker_id, workspace_id, channel, channel_id, original_input, worker_draft, holding_message,
        priority, sla_first_response_target, sla_resolution_target, conversation_context, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() + INTERVAL '15 minutes', NOW() + INTERVAL '4 hours', $9, 'open')
     RETURNING *`,
    [
      params.workerId,
      params.workspaceId,
      params.channel,
      params.channelId,
      params.originalInput,
      params.workerDraft ?? null,
      params.holdingMessage,
      priority,
      JSON.stringify([{ role: 'user', content: params.originalInput, timestamp: new Date().toISOString() }]),
    ],
  );

  const { setVaOverrideForEscalation } = await import('../admin/va-reply.js');
  void setVaOverrideForEscalation(params.workerId, params.channelId, params.channel).catch(() => {});

  return rowToEscalation(result.rows[0]);
}

function deriveEscalationPriority(reason: string): string {
  const r = reason.toLowerCase();
  if (/urgent|emergency|legal|complaint/.test(r)) return 'urgent';
  if (/payment|refund|billing/.test(r)) return 'high';
  return 'normal';
}

export async function listOpenEscalations(workspaceId: string): Promise<Escalation[]> {
  const result = await pool.query(
    `SELECT e.*
     FROM ai_worker_escalations e
     JOIN ai_workers w ON w.id = e.worker_id AND w.workspace_id = e.workspace_id
     WHERE e.workspace_id = $1
       AND e.status = 'open'
       AND w.status != 'dismissed'
     ORDER BY e.created_at DESC`,
    [workspaceId],
  );
  return result.rows.map(rowToEscalation);
}

export async function resolveEscalation(escalationId: string, resolutionText: string): Promise<void> {
  const existing = await pool.query(
    'SELECT * FROM ai_worker_escalations WHERE id = $1',
    [escalationId],
  );
  if (existing.rows.length === 0) return;

  const row = existing.rows[0] as Record<string, unknown>;
  const assignedTo = row.assigned_to ? String(row.assigned_to) : null;

  await pool.query(
    `UPDATE ai_worker_escalations
     SET status = 'resolved',
         resolution_text = $2,
         resolved_at = NOW(),
         first_response_at = COALESCE(first_response_at, NOW())
     WHERE id = $1`,
    [escalationId, resolutionText],
  );

  if (assignedTo) {
    await pool.query(
      `UPDATE va_team_members SET current_load = GREATEST(0, current_load - 1) WHERE id = $1`,
      [assignedTo],
    );
  }

  const workerId = String(row.worker_id);
  const workspaceId = String(row.workspace_id);
  const worker = await getWorkerById(workerId);
  if (!worker) return;

  const { sendEscalationResolvedEmail } = await import('../email/email-triggers.js');
  void sendEscalationResolvedEmail({
    workspaceId,
    workerName: worker.name,
    workerId,
    escalationReason: String(row.original_input ?? 'Escalated conversation'),
    resolutionNote: resolutionText,
  }).catch((err) => console.error('[worker-store] escalation resolved email failed:', err));
}

/** Owner dismiss: resolve without email noise. Returns false if missing or wrong workspace. */
export async function dismissOpenEscalation(
  workspaceId: string,
  escalationId: string,
  resolutionText = 'Dismissed by workspace owner',
): Promise<boolean> {
  const existing = await pool.query(
    `SELECT id, assigned_to
     FROM ai_worker_escalations
     WHERE id = $1 AND workspace_id = $2 AND status = 'open'`,
    [escalationId, workspaceId],
  );
  if (existing.rows.length === 0) return false;

  const assignedTo = existing.rows[0]?.assigned_to
    ? String(existing.rows[0].assigned_to)
    : null;

  await pool.query(
    `UPDATE ai_worker_escalations
     SET status = 'resolved',
         resolution_text = $3,
         resolved_at = NOW(),
         first_response_at = COALESCE(first_response_at, NOW())
     WHERE id = $1 AND workspace_id = $2 AND status = 'open'`,
    [escalationId, workspaceId, resolutionText],
  );

  if (assignedTo) {
    await pool.query(
      `UPDATE va_team_members SET current_load = GREATEST(0, current_load - 1) WHERE id = $1`,
      [assignedTo],
    );
  }

  return true;
}

export async function countEscalationsInWindow(workerId: string, minutes: number): Promise<number> {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ai_worker_escalations
     WHERE worker_id = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [workerId, String(minutes)],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function countActivityInWindow(
  workerId: string,
  minutes: number,
  actionTypes?: string[],
): Promise<number> {
  if (actionTypes && actionTypes.length > 0) {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 AND action_type = ANY($3)
         AND created_at > NOW() - ($2 || ' minutes')::interval`,
      [workerId, String(minutes), actionTypes],
    );
    return Number(result.rows[0]?.count ?? 0);
  }
  const result = await pool.query(
    `SELECT COUNT(*)::int AS count FROM ai_worker_activity
     WHERE worker_id = $1 AND created_at > NOW() - ($2 || ' minutes')::interval`,
    [workerId, String(minutes)],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function getWorkerAnalytics(workerId: string, workspaceId: string): Promise<Record<string, unknown>> {
  const worker = await getWorker(workspaceId, workerId);
  if (!worker) throw new Error('Worker not found');

  const [
    totals,
    last7d,
    last30d,
    escalationCount,
    automationRuns,
    lastActive,
    topActions,
    attestationCoverage,
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS total FROM ai_worker_activity
       WHERE worker_id = $1 AND action_type IN ('message_received', 'message_sent')`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 AND action_type IN ('message_received', 'message_sent')
         AND created_at > NOW() - INTERVAL '7 days'`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 AND action_type IN ('message_received', 'message_sent')
         AND created_at > NOW() - INTERVAL '30 days'`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_escalations WHERE worker_id = $1`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 AND action_type = 'automation_run'`,
      [workerId],
    ),
    pool.query(
      `SELECT MAX(created_at) AS last_active FROM ai_worker_activity WHERE worker_id = $1`,
      [workerId],
    ),
    pool.query(
      `SELECT action_type AS type, COUNT(*)::int AS count FROM ai_worker_activity
       WHERE worker_id = $1 GROUP BY action_type ORDER BY count DESC LIMIT 5`,
      [workerId],
    ),
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(attestation_tx)::int AS attested
       FROM ai_worker_activity WHERE worker_id = $1`,
      [workerId],
    ),
  ]);

  const totalMessages = Number(totals.rows[0]?.total ?? 0);
  const messagesLast7d = Number(last7d.rows[0]?.count ?? 0);
  const messagesLast30d = Number(last30d.rows[0]?.count ?? 0);
  const escalations = Number(escalationCount.rows[0]?.count ?? 0);
  const attTotal = Number(attestationCoverage.rows[0]?.total ?? 0);
  const attested = Number(attestationCoverage.rows[0]?.attested ?? 0);

  return {
    workerId,
    workspaceId,
    name: worker.name,
    role: worker.roleDescription,
    status: worker.status,
    totalMessages,
    messagesLast7d,
    messagesLast30d,
    escalationCount: escalations,
    escalationRate: totalMessages > 0 ? escalations / totalMessages : 0,
    automationsRunCount: Number(automationRuns.rows[0]?.count ?? 0),
    lastActiveAt: lastActive.rows[0]?.last_active
      ? new Date(String(lastActive.rows[0].last_active))
      : null,
    topActionTypes: topActions.rows.map((row) => ({
      type: String(row.type),
      count: Number(row.count),
    })),
    scoutRegistered: process.env.AIVA_SCOUT_FLEET_ENABLED !== 'false',
    attestationCoverage: attTotal > 0 ? attested / attTotal : 0,
  };
}

export interface WorkerOverviewMetrics {
  conversationsToday: number;
  openThreads: number;
  avgResponseTimeMs: number | null;
  pendingApprovals: number;
  openEscalations: number;
  lastActiveAt: Date | null;
}

/** Operational metrics for the Aiva worker overview dashboard. */
export async function getWorkerOverviewMetrics(workerId: string): Promise<WorkerOverviewMetrics> {
  const [
    conversationsToday,
    openThreads,
    avgResponse,
    emailPending,
    socialPending,
    openEscalations,
    lastActive,
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS count FROM channel_threads
       WHERE worker_id = $1 AND last_message_at >= CURRENT_DATE`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count
       FROM channel_threads t
       WHERE t.worker_id = $1
         AND t.last_message_at > NOW() - INTERVAL '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM ai_worker_escalations e
           WHERE e.worker_id = t.worker_id
             AND e.channel_id = t.contact_id
             AND e.status IN ('open', 'assigned', 'in_progress')
         )`,
      [workerId],
    ),
    pool.query(
      `WITH received AS (
         SELECT id, created_at, channel, contact_id
         FROM ai_worker_activity
         WHERE worker_id = $1
           AND action_type = 'message_received'
           AND created_at > NOW() - INTERVAL '30 days'
       ),
       pairs AS (
         SELECT
           r.created_at AS received_at,
           (
             SELECT MIN(s.created_at)
             FROM ai_worker_activity s
             WHERE s.worker_id = $1
               AND s.action_type = 'message_sent'
               AND s.channel IS NOT DISTINCT FROM r.channel
               AND s.contact_id IS NOT DISTINCT FROM r.contact_id
               AND s.created_at > r.created_at
               AND s.created_at < r.created_at + INTERVAL '24 hours'
           ) AS sent_at
         FROM received r
       )
       SELECT AVG(EXTRACT(EPOCH FROM (sent_at - received_at)) * 1000)::float AS avg_ms
       FROM pairs
       WHERE sent_at IS NOT NULL`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM worker_email_approvals
       WHERE worker_id = $1 AND status = 'pending'`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM worker_social_approvals
       WHERE worker_id = $1 AND status = 'pending'`,
      [workerId],
    ),
    pool.query(
      `SELECT COUNT(*)::int AS count FROM ai_worker_escalations
       WHERE worker_id = $1 AND status IN ('open', 'assigned', 'in_progress')`,
      [workerId],
    ),
    pool.query(
      `SELECT MAX(created_at) AS last_active FROM ai_worker_activity WHERE worker_id = $1`,
      [workerId],
    ),
  ]);

  const avgMsRaw = avgResponse.rows[0]?.avg_ms;
  const avgResponseTimeMs =
    avgMsRaw != null && Number.isFinite(Number(avgMsRaw)) ? Math.round(Number(avgMsRaw)) : null;

  const pendingApprovals =
    Number(emailPending.rows[0]?.count ?? 0) +
    Number(socialPending.rows[0]?.count ?? 0) +
    Number(openEscalations.rows[0]?.count ?? 0);

  return {
    conversationsToday: Number(conversationsToday.rows[0]?.count ?? 0),
    openThreads: Number(openThreads.rows[0]?.count ?? 0),
    avgResponseTimeMs,
    pendingApprovals,
    openEscalations: Number(openEscalations.rows[0]?.count ?? 0),
    lastActiveAt: lastActive.rows[0]?.last_active
      ? new Date(String(lastActive.rows[0].last_active))
      : null,
  };
}

export async function createAutomation(
  workerId: string,
  workspaceId: string,
  params: CreateAutomationParams,
): Promise<WorkerAutomation> {
  const { ensureAutomationTriggerSchema } = await import('./automation-run-queue.js');
  await ensureAutomationTriggerSchema();
  const result = await pool.query(
    `INSERT INTO ai_worker_automations
       (worker_id, workspace_id, name, description, cron_expression, schedule_label,
        trigger_type, trigger_event, timezone, schedule_json, action_type, action_json,
        conditions_json, approval_mode, next_run_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::jsonb,$13::jsonb,$14,$15)
     RETURNING *`,
    [
      workerId,
      workspaceId,
      params.name,
      params.description,
      params.cronExpression || '0 * * * *',
      params.scheduleLabel,
      params.triggerType ?? 'cron',
      params.triggerEvent ?? null,
      params.timezone ?? 'UTC',
      JSON.stringify(params.scheduleJson ?? null),
      params.actionType ?? 'aiva_prompt',
      JSON.stringify(params.actionJson ?? { type: 'aiva_prompt', prompt: params.description }),
      JSON.stringify(params.conditionsJson ?? []),
      params.approvalMode ?? 'require_write',
      params.nextRunAt?.toISOString() ?? null,
    ],
  );
  return rowToAutomation(result.rows[0]);
}

export async function listAutomations(workerId: string): Promise<WorkerAutomation[]> {
  const result = await pool.query(
    'SELECT * FROM ai_worker_automations WHERE worker_id = $1 ORDER BY created_at DESC',
    [workerId],
  );
  return result.rows.map(rowToAutomation);
}

export async function listAutomationsForWorkspace(workspaceId: string): Promise<WorkerAutomation[]> {
  const result = await pool.query(
    'SELECT * FROM ai_worker_automations WHERE workspace_id = $1 ORDER BY created_at DESC',
    [workspaceId],
  );
  return result.rows.map(rowToAutomation);
}

export async function getAutomation(automationId: string): Promise<WorkerAutomation | null> {
  const result = await pool.query('SELECT * FROM ai_worker_automations WHERE id = $1', [automationId]);
  if (result.rows.length === 0) return null;
  return rowToAutomation(result.rows[0]);
}

export async function toggleAutomation(automationId: string, enabled: boolean): Promise<void> {
  await pool.query(
    'UPDATE ai_worker_automations SET enabled = $2 WHERE id = $1',
    [automationId, enabled],
  );
}

export async function deleteAutomation(automationId: string): Promise<void> {
  await pool.query('DELETE FROM ai_worker_automations WHERE id = $1', [automationId]);
}

export async function updateAutomationRunTimes(automationId: string, nextRunAt?: Date): Promise<void> {
  await pool.query(
    `UPDATE ai_worker_automations
     SET last_run_at = NOW(),
         next_run_at = $2,
         last_run_status = 'success',
         last_run_error = NULL,
         last_error = NULL,
         consecutive_failures = 0
     WHERE id = $1`,
    [automationId, nextRunAt ?? null],
  );
}

export async function listEnabledAutomations(): Promise<WorkerAutomation[]> {
  const result = await pool.query(
    `SELECT * FROM ai_worker_automations WHERE enabled = TRUE ORDER BY created_at ASC`,
  );
  return result.rows.map(rowToAutomation);
}

export async function incrementAutomationFailure(
  automationId: string,
  errorMessage: string,
): Promise<number> {
  const trimmed = errorMessage.slice(0, 2000);
  const result = await pool.query(
    `UPDATE ai_worker_automations
     SET consecutive_failures = consecutive_failures + 1,
         last_run_at = NOW(),
         last_run_status = 'failed',
         last_run_error = $2,
         last_error = $2
     WHERE id = $1
     RETURNING consecutive_failures`,
    [automationId, trimmed],
  );
  return Number(result.rows[0]?.consecutive_failures ?? 0);
}

export async function resetAutomationFailures(automationId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_worker_automations
     SET consecutive_failures = 0,
         last_error = NULL,
         last_run_error = NULL,
         last_run_status = 'success'
     WHERE id = $1`,
    [automationId],
  );
}

export async function resetAutomationFailureCounter(automationId: string): Promise<void> {
  await pool.query(
    `UPDATE ai_worker_automations SET consecutive_failures = 0 WHERE id = $1`,
    [automationId],
  );
}
