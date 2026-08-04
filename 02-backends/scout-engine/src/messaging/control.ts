import type { SecurityEventRow } from '../event-server/api/types.js';
import {
  CONTROL_CHANNEL,
  EVENT_KILL_ACTIVATED,
  EVENT_KILL_RESUMED,
  STATUS_ACTIVE,
  STATUS_OFFLINE,
  STATUS_SUSPENDED,
} from '../control/constants.js';

type QueryResult<T> = {
  rows: T[];
  rowCount?: number;
};

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

export interface RedisPublisher {
  publish(channel: string, message: string): Promise<unknown> | unknown;
}

export interface ControlMetadata {
  organizationId?: string;
  dashboardUserId?: string;
  channel?: string;
  channelUserRef?: string;
  chatRef?: string;
  command?: string;
  reason?: string;
  confirmed?: boolean;
  plan?: string;
  source?: string;
  actor?: string;
}

export interface ControlDependencies {
  pool: Queryable;
  getRedis: () => RedisPublisher | null;
  broadcastEvent: (event: Record<string, unknown>) => void;
  now: () => Date;
  planWhitelist: Set<string>;
}

export interface ControlEventRecord {
  id: string;
  organization_id: string;
  audit_code: string;
  action: string;
  target_type: string;
  target_id: string | null;
  channel: string | null;
  channel_user_ref: string | null;
  dashboard_user_id: string | null;
  reason: string | null;
  confirmed: boolean;
  metadata: Record<string, unknown>;
  created_at: string | Date;
}

export interface ControlResult {
  ok: true;
  audit_code: string;
  organization_id: string;
  target_id?: string;
  status?: typeof STATUS_ACTIVE | typeof STATUS_OFFLINE | typeof STATUS_SUSPENDED;
}

export interface ControlError {
  ok: false;
  status: number;
  error: string;
  code?: 'plan_limit' | 'not_found' | 'forbidden' | 'already_in_state';
}

export type ControlOutcome = ControlResult | ControlError;

function normalizePlan(plan: string | undefined): string {
  return (plan ?? '').trim().toLowerCase();
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toBoolean(value: unknown): boolean {
  return value === true;
}

function toIsoTimestamp(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.trim()) return new Date(value).toISOString();
  return new Date().toISOString();
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isPlanAllowed(deps: ControlDependencies, plan: string | undefined): boolean {
  const normalized = normalizePlan(plan ?? '');
  return deps.planWhitelist.has(normalized);
}

function shouldEnforcePlan(plan: string | undefined): boolean {
  return Boolean(plan && plan.trim());
}

function buildSecurityEventRow(
  event: ControlEventRecord,
  description: string,
  severity: SecurityEventRow['severity'],
): SecurityEventRow {
  return {
    id: event.id,
    severity,
    source: 'scout-engine',
    event_type: `channel_control_${event.action}`,
    description,
    metadata: {
      organization_id: event.organization_id,
      audit_code: event.audit_code,
      action: event.action,
      target_type: event.target_type,
      target_id: event.target_id,
      channel: event.channel,
      channel_user_ref: event.channel_user_ref,
      dashboard_user_id: event.dashboard_user_id,
      reason: event.reason,
      confirmed: event.confirmed,
      ...event.metadata,
    },
    ip_address: null,
    session_id: null,
    instance_id: event.target_id,
    mitigated: false,
    created_at: toIsoTimestamp(event.created_at),
  };
}

function buildControlEventDescription(action: string, targetType: string, targetId: string | null, reason: string | null): string {
  const target = targetId ? `${targetType} ${targetId}` : targetType;
  return reason
    ? `Control action ${action} on ${target}: ${reason}`
    : `Control action ${action} on ${target}`;
}

async function publishControlMessage(
  deps: ControlDependencies,
  payload: Record<string, unknown>,
): Promise<void> {
  const redis = deps.getRedis();
  if (!redis) return;
  try {
    await redis.publish(CONTROL_CHANNEL, JSON.stringify(payload));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[scout-engine:control] Redis publish failed:', msg);
  }
}

async function insertChannelControlEvent(
  deps: ControlDependencies,
  event: Omit<ControlEventRecord, 'id' | 'created_at'>,
): Promise<ControlEventRecord | null> {
  const result = await deps.pool.query<ControlEventRecord>(
    `INSERT INTO channel_control_events (
       organization_id,
       audit_code,
       action,
       target_type,
       target_id,
       channel,
       channel_user_ref,
       dashboard_user_id,
       reason,
       confirmed,
       metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id, organization_id, audit_code, action, target_type, target_id,
               channel, channel_user_ref, dashboard_user_id, reason, confirmed,
               metadata, created_at`,
    [
      event.organization_id,
      event.audit_code,
      event.action,
      event.target_type,
      event.target_id,
      event.channel,
      event.channel_user_ref,
      event.dashboard_user_id,
      event.reason,
      event.confirmed,
      JSON.stringify(event.metadata),
    ],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...row,
    metadata: normalizeMetadata(row.metadata),
    created_at: toIsoTimestamp(row.created_at),
  };
}

async function insertSecurityEvent(
  deps: ControlDependencies,
  event: ControlEventRecord,
  severity: SecurityEventRow['severity'],
): Promise<void> {
  const description = buildControlEventDescription(event.action, event.target_type, event.target_id, event.reason);
  const result = await deps.pool.query<SecurityEventRow>(
    `INSERT INTO security_events
      (severity, source, event_type, description, metadata, instance_id)
     VALUES ($1, 'scout-engine', $2, $3, $4, $5)
     RETURNING id, severity, source, event_type, description, metadata,
               ip_address, session_id, instance_id, mitigated, created_at`,
    [
      severity,
      `channel_control_${event.action}`,
      description,
      JSON.stringify({
        organization_id: event.organization_id,
        audit_code: event.audit_code,
        action: event.action,
        target_type: event.target_type,
        target_id: event.target_id,
        channel: event.channel,
        channel_user_ref: event.channel_user_ref,
        dashboard_user_id: event.dashboard_user_id,
        reason: event.reason,
        confirmed: event.confirmed,
        ...event.metadata,
      }),
      event.target_id,
    ],
  );

  const row = result.rows[0];
  if (!row) return;
  deps.broadcastEvent({
    ...row,
    metadata: normalizeMetadata(row.metadata),
    created_at: toIsoTimestamp(row.created_at),
  } as Record<string, unknown>);
}

async function allocateAuditCode(
  deps: ControlDependencies,
  organizationId: string,
): Promise<string> {
  const today = deps.now().toISOString().slice(0, 10);
  const result = await deps.pool.query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM channel_control_events
     WHERE organization_id = $1
       AND created_at >= $2::date
       AND created_at < ($2::date + INTERVAL '1 day')`,
    [organizationId, today],
  );
  const count = Number.parseInt(result.rows[0]?.count ?? '0', 10);
  const suffix = String(count + 1).padStart(3, '0');
  return `K-${today}-${suffix}`;
}

async function updateInstanceStatus(
  deps: ControlDependencies,
  instanceId: string,
  nextStatus: typeof STATUS_ACTIVE | typeof STATUS_OFFLINE | typeof STATUS_SUSPENDED,
  reason: string | null,
  organizationId: string,
): Promise<{ ok: true; rowCount: number } | ControlError> {
  const result = await deps.pool.query<{ id: string }>(
    `UPDATE carina_instances
     SET status = $1,
         suspension_reason = $2,
         updated_at = NOW()
     WHERE id = $3
       AND COALESCE(organization_id, id) = $4
     RETURNING id`,
    [nextStatus, reason, instanceId, organizationId],
  );

  if (!result.rows[0]) {
    return { ok: false, status: 404, error: 'Instance not found', code: 'not_found' };
  }

  return { ok: true, rowCount: result.rows.length };
}

async function updateOrgStatus(
  deps: ControlDependencies,
  organizationId: string,
  nextStatus: typeof STATUS_ACTIVE | typeof STATUS_OFFLINE | typeof STATUS_SUSPENDED,
  reason: string | null,
): Promise<number> {
  const result = await deps.pool.query<{ id: string }>(
    `UPDATE carina_instances
     SET status = $1,
         suspension_reason = $2,
         updated_at = NOW()
     WHERE COALESCE(organization_id, id) = $3
     RETURNING id`,
    [nextStatus, reason, organizationId],
  );

  return result.rows.length;
}

export function validateKillReason(body: unknown): { ok: true; reason: string } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'reason is required and must be a non-empty string' };
  }
  const reason = (body as Record<string, unknown>).reason;
  if (typeof reason !== 'string' || !reason.trim() || reason.length > 500) {
    return { ok: false, error: 'reason is required and must be a non-empty string' };
  }
  return { ok: true, reason: reason.trim() };
}

export function createControlService(overrides: Partial<ControlDependencies> = {}) {
  const deps: ControlDependencies = {
    pool: overrides.pool ?? ({
      query: async () => ({ rows: [] }),
    } as Queryable),
    getRedis: overrides.getRedis ?? (() => null),
    broadcastEvent: overrides.broadcastEvent ?? (() => undefined),
    now: overrides.now ?? (() => new Date()),
    planWhitelist: overrides.planWhitelist ?? new Set(['scout_pro', 'scout_standard', 'enterprise']),
  };

  async function recordControlAction(
    input: {
      organizationId: string;
      action: string;
      targetType: string;
      targetId?: string | null;
      reason?: string | null;
      severity?: SecurityEventRow['severity'];
      channel?: string | null;
      channelUserRef?: string | null;
      dashboardUserId?: string | null;
      confirmed?: boolean;
      metadata?: Record<string, unknown>;
    },
  ): Promise<{ audit_code: string; event: ControlEventRecord | null }> {
    const audit_code = await allocateAuditCode(deps, input.organizationId);
    const event = await insertChannelControlEvent(deps, {
      organization_id: input.organizationId,
      audit_code,
      action: input.action,
      target_type: input.targetType,
      target_id: input.targetId ?? null,
      channel: input.channel ?? null,
      channel_user_ref: input.channelUserRef ?? null,
      dashboard_user_id: input.dashboardUserId ?? null,
      reason: input.reason ?? null,
      confirmed: input.confirmed ?? false,
      metadata: input.metadata ?? {},
    });

    if (event) {
      await insertSecurityEvent(deps, event, input.severity ?? 'critical');
    }

    return { audit_code, event };
  }

  function planLimitError(): ControlError {
    return { ok: false, status: 403, error: 'plan_limit', code: 'plan_limit' };
  }

  function enforcePlanGate(plan: string | undefined): ControlError | null {
    if (!shouldEnforcePlan(plan)) return planLimitError();
    return isPlanAllowed(deps, plan) ? null : planLimitError();
  }

  async function suspendInstance(
    instanceId: string,
    reason: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const organizationId = toStringOrNull(meta.organizationId) ?? instanceId;
    const lookup = await deps.pool.query<{ id: string; status: string }>(
      `SELECT id, status
       FROM carina_instances
       WHERE id = $1
         AND COALESCE(organization_id, id) = $2`,
      [instanceId, organizationId],
    );

    const row = lookup.rows[0];
    if (!row) return { ok: false, status: 404, error: 'Instance not found', code: 'not_found' };
    if (row.status === STATUS_SUSPENDED) {
      return { ok: false, status: 400, error: 'Instance already suspended', code: 'already_in_state' };
    }

    await deps.pool.query(
      `UPDATE carina_instances
       SET status = $1,
           suspension_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [STATUS_SUSPENDED, reason, instanceId],
    );

    const audit = await recordControlAction({
      organizationId,
      action: 'suspend_instance',
      targetType: 'instance',
      targetId: instanceId,
      reason,
      severity: 'critical',
      confirmed: true,
      metadata: {
        source: meta.source ?? 'scout-engine-admin-api',
        dashboard_user_id: meta.dashboardUserId ?? null,
        channel: meta.channel ?? null,
        channel_user_ref: meta.channelUserRef ?? null,
        chat_ref: meta.chatRef ?? null,
        actor: meta.actor ?? null,
        command: meta.command ?? 'kill',
      },
    });

    await publishControlMessage(deps, {
      action: 'suspend',
      organization_id: organizationId,
      instance_id: instanceId,
      audit_code: audit.audit_code,
      reason,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: instanceId,
      status: STATUS_SUSPENDED,
      audit_code: audit.audit_code,
    };
  }

  async function resumeInstance(
    instanceId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const organizationId = toStringOrNull(meta.organizationId) ?? instanceId;
    const result = await deps.pool.query<{ id: string }>(
      `UPDATE carina_instances
       SET status = $1,
           suspension_reason = NULL,
           updated_at = NOW()
       WHERE id = $2
         AND status = $3
       RETURNING id`,
      [STATUS_ACTIVE, instanceId, STATUS_SUSPENDED],
    );

    if (!result.rows[0]) {
      return { ok: false, status: 404, error: 'Instance not found or not suspended', code: 'not_found' };
    }

    const audit = await recordControlAction({
      organizationId,
      action: 'resume_instance',
      targetType: 'instance',
      targetId: instanceId,
      reason: meta.command ?? null,
      severity: 'info',
      confirmed: true,
      metadata: {
        source: meta.source ?? 'scout-engine-admin-api',
        dashboard_user_id: meta.dashboardUserId ?? null,
        channel: meta.channel ?? null,
        channel_user_ref: meta.channelUserRef ?? null,
        chat_ref: meta.chatRef ?? null,
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'resume',
      organization_id: organizationId,
      instance_id: instanceId,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: instanceId,
      status: STATUS_ACTIVE,
      audit_code: audit.audit_code,
    };
  }

  async function pauseAgent(
    organizationId: string,
    agentId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const planError = enforcePlanGate(meta.plan);
    if (planError) return planError;

    const result = await updateInstanceStatus(deps, agentId, STATUS_OFFLINE, meta.reason ?? null, organizationId);
    if (!result.ok) return result;

    const audit = await recordControlAction({
      organizationId,
      action: 'pause_agent',
      targetType: 'agent',
      targetId: agentId,
      reason: meta.reason ?? null,
      severity: 'warning',
      channel: meta.channel ?? null,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'pause',
      organization_id: organizationId,
      agent_id: agentId,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: agentId,
      status: STATUS_OFFLINE,
      audit_code: audit.audit_code,
    };
  }

  async function suspendChannel(
    organizationId: string,
    channel: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const planError = enforcePlanGate(meta.plan);
    if (planError) return planError;

    await deps.pool.query(
      `UPDATE channel_operator_links
       SET enabled = FALSE,
           revoked_at = COALESCE(revoked_at, NOW())
       WHERE organization_id = $1
         AND channel = $2
         AND enabled = TRUE`,
      [organizationId, channel],
    );

    const audit = await recordControlAction({
      organizationId,
      action: 'suspend_channel',
      targetType: 'channel',
      targetId: channel,
      reason: meta.reason ?? null,
      severity: 'warning',
      channel,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'suspend_channel',
      organization_id: organizationId,
      channel,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: channel,
      audit_code: audit.audit_code,
    };
  }

  async function quarantineTool(
    organizationId: string,
    agentId: string | 'all',
    toolName: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const planError = enforcePlanGate(meta.plan);
    if (planError) return planError;

    const audit = await recordControlAction({
      organizationId,
      action: 'quarantine_tool',
      targetType: 'tool',
      targetId: agentId,
      reason: meta.reason ?? null,
      severity: 'warning',
      channel: meta.channel ?? null,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
        tool_name: toolName,
      },
    });

    await publishControlMessage(deps, {
      action: 'quarantine_tool',
      organization_id: organizationId,
      agent_id: agentId,
      tool_name: toolName,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: agentId,
      audit_code: audit.audit_code,
    };
  }

  async function restrictOrg(
    organizationId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const planError = enforcePlanGate(meta.plan);
    if (planError) return planError;

    const count = await updateOrgStatus(deps, organizationId, STATUS_OFFLINE, meta.reason ?? null);
    if (count === 0) {
      return { ok: false, status: 404, error: 'Organization not found', code: 'not_found' };
    }

    const audit = await recordControlAction({
      organizationId,
      action: 'restrict_org',
      targetType: 'organization',
      targetId: organizationId,
      reason: meta.reason ?? null,
      severity: 'warning',
      channel: meta.channel ?? null,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'restrict',
      organization_id: organizationId,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: organizationId,
      status: STATUS_OFFLINE,
      audit_code: audit.audit_code,
    };
  }

  async function freezeOrg(
    organizationId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const planError = enforcePlanGate(meta.plan);
    if (planError) return planError;

    const count = await updateOrgStatus(deps, organizationId, STATUS_SUSPENDED, meta.reason ?? null);
    if (count === 0) {
      return { ok: false, status: 404, error: 'Organization not found', code: 'not_found' };
    }

    const audit = await recordControlAction({
      organizationId,
      action: 'freeze_org',
      targetType: 'organization',
      targetId: organizationId,
      reason: meta.reason ?? null,
      severity: 'critical',
      channel: meta.channel ?? null,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'freeze',
      organization_id: organizationId,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: organizationId,
      status: STATUS_SUSPENDED,
      audit_code: audit.audit_code,
    };
  }

  async function killOrg(
    organizationId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    return freezeOrg(organizationId, { ...meta, command: meta.command ?? 'kill' });
  }

  async function resumeOrg(
    organizationId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const count = await updateOrgStatus(deps, organizationId, STATUS_ACTIVE, null);
    if (count === 0) {
      return { ok: false, status: 404, error: 'Organization not found', code: 'not_found' };
    }

    const audit = await recordControlAction({
      organizationId,
      action: 'resume_org',
      targetType: 'organization',
      targetId: organizationId,
      reason: meta.reason ?? null,
      severity: 'info',
      channel: meta.channel ?? null,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'resume',
      organization_id: organizationId,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: organizationId,
      status: STATUS_ACTIVE,
      audit_code: audit.audit_code,
    };
  }

  async function resumeAgent(
    organizationId: string,
    agentId: string,
    meta: ControlMetadata = {},
  ): Promise<ControlOutcome> {
    const result = await updateInstanceStatus(deps, agentId, STATUS_ACTIVE, null, organizationId);
    if (!result.ok) return result;

    const audit = await recordControlAction({
      organizationId,
      action: 'resume_agent',
      targetType: 'agent',
      targetId: agentId,
      reason: meta.reason ?? null,
      severity: 'info',
      channel: meta.channel ?? null,
      channelUserRef: meta.channelUserRef ?? null,
      dashboardUserId: meta.dashboardUserId ?? null,
      confirmed: toBoolean(meta.confirmed),
      metadata: {
        source: meta.source ?? 'channel-control',
        actor: meta.actor ?? null,
      },
    });

    await publishControlMessage(deps, {
      action: 'resume_agent',
      organization_id: organizationId,
      agent_id: agentId,
      audit_code: audit.audit_code,
      timestamp: deps.now().toISOString(),
    });

    return {
      ok: true,
      organization_id: organizationId,
      target_id: agentId,
      status: STATUS_ACTIVE,
      audit_code: audit.audit_code,
    };
  }

  async function getStatus(organizationId: string): Promise<Record<string, unknown>> {
    const counts = await deps.pool.query<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::int AS count
       FROM carina_instances
       WHERE COALESCE(organization_id, id) = $1
       GROUP BY status`,
      [organizationId],
    );

    const links = await deps.pool.query<{ count: string }>(
      `SELECT COUNT(*)::int AS count
       FROM channel_operator_links
       WHERE organization_id = $1
         AND enabled = TRUE`,
      [organizationId],
    );

    const statusCounts = {
      active: 0,
      suspended: 0,
      offline: 0,
    };
    for (const row of counts.rows) {
      const count = Number.parseInt(row.count ?? '0', 10);
      if (row.status === STATUS_ACTIVE) statusCounts.active = count;
      if (row.status === STATUS_SUSPENDED) statusCounts.suspended = count;
      if (row.status === STATUS_OFFLINE) statusCounts.offline = count;
    }

    return {
      organization_id: organizationId,
      agents: statusCounts,
      linked_channels: Number.parseInt(links.rows[0]?.count ?? '0', 10),
      checked_at: deps.now().toISOString(),
    };
  }

  return {
    validateKillReason,
    suspendInstance,
    resumeInstance,
    pauseAgent,
    suspendChannel,
    quarantineTool,
    restrictOrg,
    freezeOrg,
    killOrg,
    resumeOrg,
    resumeAgent,
    getStatus,
    isPlanAllowed: (plan: string | undefined) => isPlanAllowed(deps, plan),
  };
}
