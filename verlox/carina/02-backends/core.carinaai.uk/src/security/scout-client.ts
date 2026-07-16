import { insertScoutSignalCache } from '../admin/scout-signal-cache.js';
import {
  importScoutPackage,
  type ScoutEvent,
  type ToolCallReport,
} from './load-scout-package.js';
import { emitPlatformEvent } from '../billing/platform-event-emitter.js';
import { config } from '../config/index.js';
import {
  defaultSeverityForCategory,
  type ScoutSignal,
} from './scout-mutual-types.js';
import { isScoutMutualIntegrationActive } from './scout-mode.js';

export type { ScoutEvent, ToolCallReport } from './load-scout-package.js';
export type { ScoutSignal } from './scout-mutual-types.js';

type GovernanceRules = {
  volume_spike_threshold: number;
  escalation_rate_threshold: number;
  escalation_burst_window: number;
  escalation_burst_count: number;
  ignore_signal_types: string[];
};

const governanceCache = new Map<string, { rules: GovernanceRules | null; checkedAt: number }>();

async function resolveWorkspaceId(event: ScoutEvent): Promise<string | null> {
  const meta = event.metadata ?? {};
  if (typeof meta.workspaceId === 'string' && meta.workspaceId) return meta.workspaceId;
  if (!event.instance_id) return null;
  try {
    const { pool } = await import('../memory/db.js');
    const result = await pool.query(
      'SELECT workspace_id FROM ai_workers WHERE id = $1 LIMIT 1',
      [event.instance_id],
    );
    const row = result.rows[0] as { workspace_id?: string } | undefined;
    return row?.workspace_id ? String(row.workspace_id) : null;
  } catch {
    return null;
  }
}

async function loadGovernance(workspaceId: string): Promise<GovernanceRules | null> {
  const cached = governanceCache.get(workspaceId);
  if (cached && Date.now() - cached.checkedAt < 60_000) {
    return cached.rules;
  }
  try {
    const { pool } = await import('../memory/db.js');
    const result = await pool.query(
      'SELECT * FROM aiva_scout_governance WHERE workspace_id = $1',
      [workspaceId],
    );
    const rules = (result.rows[0] as GovernanceRules | undefined) ?? null;
    governanceCache.set(workspaceId, { rules, checkedAt: Date.now() });
    return rules;
  } catch {
    return null;
  }
}

function shouldSuppressEvent(event: ScoutEvent, rules: GovernanceRules): boolean {
  const eventType = event.event_type;
  if (rules.ignore_signal_types.includes(eventType)) return true;

  const meta = event.metadata ?? {};
  if (eventType === 'volume_spike') {
    const messagesPerHour = Number(meta.messagesPerHour ?? meta.messageCount ?? 0);
    if (messagesPerHour < Number(rules.volume_spike_threshold)) return true;
  }
  if (eventType === 'high_escalation_rate') {
    const rate = Number(meta.escalationRate ?? 0);
    if (rate < Number(rules.escalation_rate_threshold)) return true;
  }
  if (eventType === 'escalation_burst') {
    const count = Number(meta.count ?? 0);
    if (count < Number(rules.escalation_burst_count)) return true;
  }
  return false;
}

async function scout(): Promise<Awaited<ReturnType<typeof importScoutPackage>>> {
  return importScoutPackage();
}

export async function reportEvent(event: ScoutEvent): Promise<void> {
  const workspaceId = await resolveWorkspaceId(event);
  if (workspaceId) {
    const rules = await loadGovernance(workspaceId);
    if (rules && shouldSuppressEvent(event, rules)) return;
  }

  const mod = await scout();
  if (!mod) return;
  await insertScoutSignalCache(event);
  void emitPlatformEvent({
    eventType: 'scout_audit',
    scoutVerified: true,
    metadata: { scoutEventType: event.event_type, instanceId: event.instance_id ?? null },
  }).catch(() => {});
  return mod.reportEvent(event);
}

/** Business-plan governance wrapper (alias for reportEvent). */
export const reportEventWithGovernance = reportEvent;

/**
 * Emit a structured agentic signal to Scout (prompt 34).
 * Categories: threat_analysis, investigation, recommendation, nl_query_result, anomaly_detected, proactive_alert.
 */
export async function reportScoutSignal(signal: ScoutSignal): Promise<void> {
  if (!isScoutMutualIntegrationActive()) return;

  const severity = signal.severity ?? defaultSeverityForCategory(signal.category);
  await reportEvent({
    severity,
    source: signal.agent_id || `carina:${config.labyrinth.instanceId}`,
    event_type: signal.category,
    description: `${signal.action} on ${signal.target}`,
    metadata: {
      signal_id: signal.signal_id,
      timestamp: signal.timestamp,
      agent_id: signal.agent_id,
      category: signal.category,
      action: signal.action,
      target: signal.target,
      details: signal.details,
      mitre_tactic: signal.mitre_tactic,
      threat_score: signal.threat_score,
    },
    session_id: signal.session_id,
    instance_id: signal.instance_id ?? config.labyrinth.instanceId,
  });
}

export async function reportToolCall(call: ToolCallReport): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.reportToolCall(call);
}

export async function reportHeartbeat(): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.reportHeartbeat();
}

export async function recordToolCall(
  sessionId: string,
  toolName: string,
  responseLength: number,
): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.recordToolCall(sessionId, toolName, responseLength);
}

export async function flushMetricsToScout(
  instanceId: string,
  sessionId: string,
): Promise<void> {
  const mod = await scout();
  if (!mod) return;
  return mod.flushMetricsToScout(instanceId, sessionId);
}

export function stopMetricsFlush(sessionId: string): void {
  void scout().then((mod) => mod?.stopMetricsFlush(sessionId));
}

export function sanitiseParams(params: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...params };
  for (const [key, value] of Object.entries(redacted)) {
    if (/(api[_-]?key|token|secret|password|authorization|auth)/i.test(key)) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = sanitiseParams(value as Record<string, unknown>);
    }
  }
  return redacted;
}

export function _resetMetricsTimers(): void {
  void scout().then((mod) => mod?._resetMetricsTimers());
}

export function _resetScoutWarnFlag(): void {
  void scout().then((mod) => mod?._resetScoutWarnFlag());
}
