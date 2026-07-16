import { pool } from '../memory/db.js';

export type PlatformEventType =
  | 'message'
  | 'tool_call'
  | 'skill_invocation'
  | 'memory_read'
  | 'memory_write'
  | 'scout_audit'
  | 'webhook_delivery'
  | 'channel_connect';

export interface PlatformEventInput {
  orgId?: string | null;
  partnerId?: string | null;
  eventType: PlatformEventType;
  model?: string;
  provider?: string;
  tokensIn?: number;
  tokensOut?: number;
  toolCalls?: number;
  skillCalls?: number;
  memoryOps?: number;
  latencyMs?: number;
  scoutVerified?: boolean;
  feePence?: number;
  metadata?: Record<string, unknown>;
}

export async function emitPlatformEvent(input: PlatformEventInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO platform_events
         (org_id, partner_id, event_type, model, provider,
          tokens_in, tokens_out, tool_calls, skill_calls, memory_ops,
          latency_ms, scout_verified, fee_pence, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
      [
        input.orgId ?? null,
        input.partnerId ?? null,
        input.eventType,
        input.model ?? null,
        input.provider ?? null,
        input.tokensIn ?? 0,
        input.tokensOut ?? 0,
        input.toolCalls ?? 0,
        input.skillCalls ?? 0,
        input.memoryOps ?? 0,
        input.latencyMs ?? null,
        input.scoutVerified ?? false,
        input.feePence ?? 0,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  } catch (err) {
    console.error('[platform-event] emit failed:', err instanceof Error ? err.message : String(err));
  }
}

export interface PlatformEventSummary {
  totalEvents: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalToolCalls: number;
  totalSkillCalls: number;
  totalFeePence: number;
  byType: Record<string, number>;
}

export async function getPlatformEventSummary(options: {
  partnerId?: string;
  orgId?: string;
  fromDate: Date;
  toDate: Date;
}): Promise<PlatformEventSummary> {
  const conditions: string[] = ['created_at >= $1', 'created_at < $2'];
  const params: unknown[] = [options.fromDate, options.toDate];

  if (options.partnerId) {
    params.push(options.partnerId);
    conditions.push(`partner_id = $${params.length}`);
  }
  if (options.orgId) {
    params.push(options.orgId);
    conditions.push(`org_id = $${params.length}`);
  }

  const where = conditions.join(' AND ');

  const result = await pool.query(
    `SELECT
       event_type,
       COUNT(*)::int          AS event_count,
       SUM(tokens_in)::int    AS tokens_in,
       SUM(tokens_out)::int   AS tokens_out,
       SUM(tool_calls)::int   AS tool_calls,
       SUM(skill_calls)::int  AS skill_calls,
       SUM(fee_pence)::int    AS fee_pence
     FROM platform_events
     WHERE ${where}
     GROUP BY event_type`,
    params,
  );

  const byType: Record<string, number> = {};
  let totalEvents = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let totalToolCalls = 0;
  let totalSkillCalls = 0;
  let totalFeePence = 0;

  for (const row of result.rows as Record<string, unknown>[]) {
    const count = Number(row.event_count ?? 0);
    byType[String(row.event_type)] = count;
    totalEvents += count;
    totalTokensIn += Number(row.tokens_in ?? 0);
    totalTokensOut += Number(row.tokens_out ?? 0);
    totalToolCalls += Number(row.tool_calls ?? 0);
    totalSkillCalls += Number(row.skill_calls ?? 0);
    totalFeePence += Number(row.fee_pence ?? 0);
  }

  return {
    totalEvents,
    totalTokensIn,
    totalTokensOut,
    totalToolCalls,
    totalSkillCalls,
    totalFeePence,
    byType,
  };
}
