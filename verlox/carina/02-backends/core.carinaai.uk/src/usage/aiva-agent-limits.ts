/**
 * Per-actor Aiva usage limits (calls + estimated tokens).
 * Separate from the billing wallet ledger: this gate decides allow/deny;
 * the wallet decides money.
 */

import { pool } from '../memory/db.js';
import { writeAdminAudit } from '../admin/admin-audit.js';

export type AivaLimitPeriod = 'day' | 'month';

export type AivaActorKind = 'workspace' | 'assistant' | 'token' | 'channel';

export interface AivaServiceLimit {
  maxCalls?: number;
  maxTokens?: number;
}

export interface AivaLimitPolicy {
  period: AivaLimitPeriod;
  maxCalls?: number;
  maxTokens?: number;
  perService?: Record<string, AivaServiceLimit>;
}

export interface AivaUsageSnapshot {
  calls: number;
  tokens: number;
  perService: Record<string, { calls: number; tokens: number }>;
}

export interface AivaLimitCheckResult {
  allowed: boolean;
  reason?: string;
  metric?: 'calls' | 'tokens';
  scope?: string;
  limit?: number;
  used?: number;
  period?: AivaLimitPeriod;
  actorId?: string;
  remainingCalls?: number | null;
  remainingTokens?: number | null;
  statusCode?: number;
  code?: string;
}

export interface AivaLimitContext {
  workspaceId: string;
  workerId?: string;
  channel?: string;
  apiTokenId?: string;
  service?: string;
  estimatedTokens?: number;
  planTier?: string;
}

const VALID_PERIODS = new Set<AivaLimitPeriod>(['day', 'month']);
const MAX_LIMIT_VALUE = 1e12;
const CHARS_PER_TOKEN = 4;

/** Strict trial defaults: daily window. */
export const TRIAL_DEFAULT_LIMITS: AivaLimitPolicy = {
  period: 'day',
  maxCalls: 40,
  maxTokens: 80_000,
  perService: {
    inference: { maxCalls: 40, maxTokens: 80_000 },
    channel: { maxCalls: 40 },
  },
};

/** Paid plan defaults (calendar month). */
export const PLAN_DEFAULT_LIMITS: Record<string, AivaLimitPolicy> = {
  starter: {
    period: 'month',
    maxCalls: 2_000,
    maxTokens: 4_000_000,
    perService: { inference: { maxCalls: 2_000, maxTokens: 4_000_000 } },
  },
  team: {
    period: 'month',
    maxCalls: 10_000,
    maxTokens: 20_000_000,
    perService: { inference: { maxCalls: 10_000, maxTokens: 20_000_000 } },
  },
  business: {
    period: 'month',
    maxCalls: 100_000,
    maxTokens: 200_000_000,
  },
};

let schemaReady: Promise<void> | null = null;

export async function ensureAivaAgentLimitsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_agent_limit_policies (
          workspace_id TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          limits_json JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (workspace_id, actor_id)
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS aiva_agent_usage_counters (
          workspace_id TEXT NOT NULL,
          actor_id TEXT NOT NULL,
          day DATE NOT NULL,
          service TEXT NOT NULL DEFAULT '',
          calls INTEGER NOT NULL DEFAULT 0,
          tokens_used BIGINT NOT NULL DEFAULT 0,
          PRIMARY KEY (workspace_id, actor_id, day, service)
        )
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS aiva_agent_usage_workspace_day_idx
          ON aiva_agent_usage_counters (workspace_id, day DESC)
      `);
    })().catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
}

export function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function periodStartDay(period: AivaLimitPeriod, now = new Date()): string {
  if (period === 'day') return utcDay(now);
  return `${now.toISOString().slice(0, 8)}01`;
}

export function estimateTokensFromText(payload: unknown): number {
  if (payload === null || payload === undefined) return 0;
  const str = typeof payload === 'string'
    ? payload
    : (() => {
      try {
        return JSON.stringify(payload);
      } catch {
        return '';
      }
    })();
  return Math.ceil((str || '').length / CHARS_PER_TOKEN);
}

function toPositiveIntOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.floor(n), MAX_LIMIT_VALUE);
}

/** Validate and canonicalize a limits object. null = no custom limit. */
export function normalizeLimits(input: unknown): AivaLimitPolicy | null {
  if (input === null || input === undefined) return null;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('limits must be an object');
  }
  const raw = input as Record<string, unknown>;
  const out: AivaLimitPolicy = {
    period: 'month',
  };
  const period = raw.period === undefined || raw.period === null ? 'month' : String(raw.period);
  if (!VALID_PERIODS.has(period as AivaLimitPeriod)) {
    throw new Error("limits.period must be 'day' or 'month'");
  }
  out.period = period as AivaLimitPeriod;

  const maxCalls = toPositiveIntOrNull(raw.maxCalls);
  const maxTokens = toPositiveIntOrNull(raw.maxTokens);
  if (maxCalls) out.maxCalls = maxCalls;
  if (maxTokens) out.maxTokens = maxTokens;

  if (raw.perService !== undefined && raw.perService !== null) {
    if (typeof raw.perService !== 'object' || Array.isArray(raw.perService)) {
      throw new Error('limits.perService must be an object keyed by service name');
    }
    const perService: Record<string, AivaServiceLimit> = {};
    for (const [service, cfg] of Object.entries(raw.perService as Record<string, unknown>)) {
      if (!/^[a-z0-9_-]+$/i.test(service)) {
        throw new Error(`limits.perService: invalid service name '${service}'`);
      }
      if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg)) {
        throw new Error(`limits.perService.${service} must be an object`);
      }
      const svcCfg = cfg as Record<string, unknown>;
      const svc: AivaServiceLimit = {};
      const svcCalls = toPositiveIntOrNull(svcCfg.maxCalls);
      const svcTokens = toPositiveIntOrNull(svcCfg.maxTokens);
      if (svcCalls) svc.maxCalls = svcCalls;
      if (svcTokens) svc.maxTokens = svcTokens;
      if (Object.keys(svc).length > 0) perService[service.toLowerCase()] = svc;
    }
    if (Object.keys(perService).length > 0) out.perService = perService;
  }

  const hasAny = out.maxCalls || out.maxTokens || out.perService;
  return hasAny ? out : null;
}

export function buildActorId(kind: AivaActorKind, id: string): string {
  return `${kind}:${String(id).trim()}`;
}

export function defaultLimitsForPlan(planTier: string): AivaLimitPolicy {
  if (planTier === 'trial' || planTier === 'pending_channel') {
    return { ...TRIAL_DEFAULT_LIMITS, perService: { ...TRIAL_DEFAULT_LIMITS.perService } };
  }
  const paid = PLAN_DEFAULT_LIMITS[planTier];
  if (paid) {
    return {
      ...paid,
      perService: paid.perService ? { ...paid.perService } : undefined,
    };
  }
  return { ...TRIAL_DEFAULT_LIMITS, perService: { ...TRIAL_DEFAULT_LIMITS.perService } };
}

export async function getActorLimits(
  workspaceId: string,
  actorId: string,
): Promise<AivaLimitPolicy | null> {
  try {
    await ensureAivaAgentLimitsSchema();
    const result = await pool.query<{ limits_json: AivaLimitPolicy }>(
      `SELECT limits_json FROM aiva_agent_limit_policies
       WHERE workspace_id = $1 AND actor_id = $2`,
      [workspaceId, actorId],
    );
    const row = result.rows[0];
    if (!row?.limits_json) return null;
    return normalizeLimits(row.limits_json);
  } catch (err) {
    console.error('[aiva-agent-limits] read failed:', err);
    return null;
  }
}

export async function setActorLimits(
  workspaceId: string,
  actorId: string,
  limits: unknown,
  opts?: { adminUserId?: string; ipAddress?: string },
): Promise<AivaLimitPolicy | null> {
  await ensureAivaAgentLimitsSchema();
  const normalized = normalizeLimits(limits);
  if (!normalized) {
    await pool.query(
      `DELETE FROM aiva_agent_limit_policies WHERE workspace_id = $1 AND actor_id = $2`,
      [workspaceId, actorId],
    );
    if (opts?.adminUserId) {
      await writeAdminAudit({
        adminUserId: opts.adminUserId,
        action: 'clear_agent_limits',
        targetType: 'workspace',
        targetId: workspaceId,
        metadata: { actorId },
        ipAddress: opts.ipAddress,
      }).catch(() => {});
    }
    return null;
  }
  await pool.query(
    `INSERT INTO aiva_agent_limit_policies (workspace_id, actor_id, limits_json, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (workspace_id, actor_id)
     DO UPDATE SET limits_json = EXCLUDED.limits_json, updated_at = NOW()`,
    [workspaceId, actorId, JSON.stringify(normalized)],
  );
  if (opts?.adminUserId) {
    await writeAdminAudit({
      adminUserId: opts.adminUserId,
      action: 'set_agent_limits',
      targetType: 'workspace',
      targetId: workspaceId,
      metadata: { actorId, limits: normalized },
      ipAddress: opts.ipAddress,
    }).catch(() => {});
  }
  return normalized;
}

export async function getActorUsage(
  workspaceId: string,
  actorId: string,
  period: AivaLimitPeriod = 'month',
): Promise<AivaUsageSnapshot> {
  const usage: AivaUsageSnapshot = { calls: 0, tokens: 0, perService: {} };
  try {
    await ensureAivaAgentLimitsSchema();
    const start = periodStartDay(period);
    const result = await pool.query<{ service: string; calls: string; tokens: string }>(
      `SELECT service,
              COALESCE(SUM(calls), 0)::TEXT AS calls,
              COALESCE(SUM(tokens_used), 0)::TEXT AS tokens
       FROM aiva_agent_usage_counters
       WHERE workspace_id = $1 AND actor_id = $2 AND day >= $3::date
       GROUP BY service`,
      [workspaceId, actorId, start],
    );
    for (const row of result.rows) {
      const calls = Number(row.calls || 0);
      const tokens = Number(row.tokens || 0);
      usage.calls += calls;
      usage.tokens += tokens;
      if (row.service) {
        usage.perService[row.service] = { calls, tokens };
      }
    }
  } catch (err) {
    console.error('[aiva-agent-limits] usage read failed:', err);
  }
  return usage;
}

function denyResult(
  metric: 'calls' | 'tokens',
  scope: string,
  limit: number,
  used: number,
  period: AivaLimitPeriod,
  actorId: string,
): AivaLimitCheckResult {
  return {
    allowed: false,
    metric,
    scope,
    limit,
    used,
    period,
    actorId,
    statusCode: 429,
    code: 'AGENT_LIMIT_EXCEEDED',
    reason: `Usage ${metric} limit reached for ${scope === 'total' ? 'this actor' : `service '${scope}'`}: ${used}/${limit} per ${period}`,
    remainingCalls: metric === 'calls' ? 0 : null,
    remainingTokens: metric === 'tokens' ? 0 : null,
  };
}

export function evaluateLimits(
  limits: AivaLimitPolicy,
  usage: AivaUsageSnapshot,
  opts: { service?: string | null; tokens?: number; actorId: string },
): AivaLimitCheckResult {
  const period = VALID_PERIODS.has(limits.period) ? limits.period : 'month';
  const tokens = Math.max(0, Math.floor(opts.tokens ?? 0));
  const service = opts.service ? String(opts.service).toLowerCase() : null;

  if (limits.maxCalls && usage.calls + 1 > limits.maxCalls) {
    return denyResult('calls', 'total', limits.maxCalls, usage.calls, period, opts.actorId);
  }
  if (limits.maxTokens && usage.tokens + tokens > limits.maxTokens) {
    return denyResult('tokens', 'total', limits.maxTokens, usage.tokens, period, opts.actorId);
  }
  if (service && limits.perService?.[service]) {
    const svc = limits.perService[service];
    const svcUsage = usage.perService[service] || { calls: 0, tokens: 0 };
    if (svc.maxCalls && svcUsage.calls + 1 > svc.maxCalls) {
      return denyResult('calls', service, svc.maxCalls, svcUsage.calls, period, opts.actorId);
    }
    if (svc.maxTokens && svcUsage.tokens + tokens > svc.maxTokens) {
      return denyResult('tokens', service, svc.maxTokens, svcUsage.tokens, period, opts.actorId);
    }
  }

  const remainingCalls = limits.maxCalls != null
    ? Math.max(0, limits.maxCalls - usage.calls)
    : null;
  const remainingTokens = limits.maxTokens != null
    ? Math.max(0, limits.maxTokens - usage.tokens)
    : null;

  return {
    allowed: true,
    period,
    actorId: opts.actorId,
    remainingCalls,
    remainingTokens,
  };
}

export async function checkActorLimits(
  workspaceId: string,
  actorId: string,
  opts?: {
    service?: string | null;
    tokens?: number;
    fallbackPolicy?: AivaLimitPolicy | null;
  },
): Promise<AivaLimitCheckResult> {
  try {
    const custom = await getActorLimits(workspaceId, actorId);
    const limits = custom ?? opts?.fallbackPolicy ?? null;
    if (!limits) return { allowed: true, actorId };
    const usage = await getActorUsage(workspaceId, actorId, limits.period);
    return evaluateLimits(limits, usage, {
      service: opts?.service,
      tokens: opts?.tokens,
      actorId,
    });
  } catch (err) {
    console.error('[aiva-agent-limits] check failed open:', err);
    return { allowed: true, actorId };
  }
}

export async function recordActorUsage(
  workspaceId: string,
  actorId: string,
  opts?: { service?: string; calls?: number; tokens?: number },
): Promise<void> {
  if (!workspaceId || !actorId) return;
  try {
    await ensureAivaAgentLimitsSchema();
    const service = String(opts?.service || '').toLowerCase();
    const calls = Math.max(0, Math.floor(opts?.calls ?? 1));
    const tokens = Math.max(0, Math.floor(opts?.tokens ?? 0));
    await pool.query(
      `INSERT INTO aiva_agent_usage_counters
         (workspace_id, actor_id, day, service, calls, tokens_used)
       VALUES ($1, $2, $3::date, $4, $5, $6)
       ON CONFLICT (workspace_id, actor_id, day, service)
       DO UPDATE SET
         calls = aiva_agent_usage_counters.calls + EXCLUDED.calls,
         tokens_used = aiva_agent_usage_counters.tokens_used + EXCLUDED.tokens_used`,
      [workspaceId, actorId, utcDay(), service, calls, tokens],
    );
  } catch (err) {
    console.error('[aiva-agent-limits] usage write failed:', err);
  }
}

/**
 * Resolve actors for an Aiva request and enforce the tightest applicable limit.
 * workspaceId must come from verified server context.
 */
export async function checkAivaRequestLimits(
  ctx: AivaLimitContext,
): Promise<AivaLimitCheckResult> {
  const planTier = ctx.planTier ?? 'trial';
  const tokens = ctx.estimatedTokens
    ?? 0;
  const service = (ctx.service || 'inference').toLowerCase();
  const workspaceActor = buildActorId('workspace', ctx.workspaceId);
  const actors: Array<{ actorId: string; fallback: AivaLimitPolicy | null }> = [
    {
      actorId: workspaceActor,
      fallback: defaultLimitsForPlan(planTier),
    },
  ];
  if (ctx.workerId) {
    actors.push({
      actorId: buildActorId('assistant', ctx.workerId),
      fallback: null,
    });
  }
  if (ctx.apiTokenId) {
    actors.push({
      actorId: buildActorId('token', ctx.apiTokenId),
      fallback: null,
    });
  }
  if (ctx.channel) {
    actors.push({
      actorId: buildActorId('channel', `${ctx.workspaceId}:${ctx.channel}`),
      fallback: planTier === 'trial'
        ? { period: 'day', maxCalls: 40, perService: { channel: { maxCalls: 40 } } }
        : null,
    });
  }

  let tightest: AivaLimitCheckResult = { allowed: true };
  for (const actor of actors) {
    const result = await checkActorLimits(ctx.workspaceId, actor.actorId, {
      service,
      tokens,
      fallbackPolicy: actor.fallback,
    });
    if (!result.allowed) {
      await writeAdminAudit({
        adminUserId: 'system',
        action: 'agent_limit_denied',
        targetType: 'workspace',
        targetId: ctx.workspaceId,
        metadata: {
          actorId: result.actorId,
          metric: result.metric,
          scope: result.scope,
          limit: result.limit,
          used: result.used,
          service,
        },
      }).catch(() => {});
      return result;
    }
    if (
      result.remainingCalls != null
      && (tightest.remainingCalls == null || result.remainingCalls < tightest.remainingCalls)
    ) {
      tightest = result;
    } else if (tightest.allowed && result.remainingTokens != null) {
      tightest = { ...tightest, ...result };
    }
  }
  return tightest;
}

export async function recordAivaRequestUsage(
  ctx: AivaLimitContext & { replyText?: string },
): Promise<void> {
  const service = (ctx.service || 'inference').toLowerCase();
  const tokens = Math.max(
    ctx.estimatedTokens ?? 0,
    estimateTokensFromText(ctx.replyText ?? ''),
  );
  const actors = [
    buildActorId('workspace', ctx.workspaceId),
  ];
  if (ctx.workerId) actors.push(buildActorId('assistant', ctx.workerId));
  if (ctx.apiTokenId) actors.push(buildActorId('token', ctx.apiTokenId));
  if (ctx.channel) {
    actors.push(buildActorId('channel', `${ctx.workspaceId}:${ctx.channel}`));
  }
  for (const actorId of actors) {
    await recordActorUsage(ctx.workspaceId, actorId, { service, calls: 1, tokens });
  }
}

export async function getWorkspaceLimitStatus(
  workspaceId: string,
  planTier: string,
): Promise<{
  policy: AivaLimitPolicy;
  usage: AivaUsageSnapshot;
  remainingCalls: number | null;
  remainingTokens: number | null;
  custom: boolean;
}> {
  const actorId = buildActorId('workspace', workspaceId);
  const custom = await getActorLimits(workspaceId, actorId);
  const policy = custom ?? defaultLimitsForPlan(planTier);
  const usage = await getActorUsage(workspaceId, actorId, policy.period);
  return {
    policy,
    usage,
    remainingCalls: policy.maxCalls != null ? Math.max(0, policy.maxCalls - usage.calls) : null,
    remainingTokens: policy.maxTokens != null ? Math.max(0, policy.maxTokens - usage.tokens) : null,
    custom: Boolean(custom),
  };
}

export async function listWorkspaceActorUsage(
  workspaceId: string,
  period: AivaLimitPeriod = 'day',
): Promise<Array<{ actorId: string; calls: number; tokens: number }>> {
  try {
    await ensureAivaAgentLimitsSchema();
    const start = periodStartDay(period);
    const result = await pool.query<{ actor_id: string; calls: string; tokens: string }>(
      `SELECT actor_id,
              COALESCE(SUM(calls), 0)::TEXT AS calls,
              COALESCE(SUM(tokens_used), 0)::TEXT AS tokens
       FROM aiva_agent_usage_counters
       WHERE workspace_id = $1 AND day >= $2::date
       GROUP BY actor_id
       ORDER BY SUM(calls) DESC
       LIMIT 100`,
      [workspaceId, start],
    );
    return result.rows.map((row) => ({
      actorId: String(row.actor_id),
      calls: Number(row.calls),
      tokens: Number(row.tokens),
    }));
  } catch (err) {
    console.error('[aiva-agent-limits] list usage failed:', err);
    return [];
  }
}
