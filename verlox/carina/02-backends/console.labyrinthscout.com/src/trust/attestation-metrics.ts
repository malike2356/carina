import { pool } from '../db.js';
import type { TrustMetricsInput } from './compute-trust-metrics.js';
import { computeRiskScore } from './compute-trust-metrics.js';
import {
  buildAttestationComment,
  securityScoreFromRisk,
  type LabyrinthScoutAttestationFields,
} from './attestation-namespace.js';

interface AttestationMetricsRow {
  threats_30d: string;
  injection_blocks_30d: string;
  sandbox_violations_30d: string;
  runtime_incidents_30d: string;
  last_incident_at: Date | null;
  oldest_heartbeat: Date | null;
}

export interface AttestationEligibility {
  eligible: boolean;
  reason?: string;
}

export async function fetchAttestationMetricsFromDb(): Promise<{
  metrics: TrustMetricsInput;
  fields: LabyrinthScoutAttestationFields;
  eligibility: AttestationEligibility;
}> {
  const [instances, events, attestationAgg, heartbeatAgg] = await Promise.all([
    pool.query<{ agents_total: string; agents_active: string; agents_suspended: string; last_heartbeat: Date | null }>(
      `SELECT
         COUNT(*)::text AS agents_total,
         COUNT(*) FILTER (
           WHERE last_heartbeat > NOW() - INTERVAL '90 seconds'
             AND status <> 'suspended'
         )::text AS agents_active,
         COUNT(*) FILTER (WHERE status = 'suspended')::text AS agents_suspended,
         MAX(last_heartbeat) AS last_heartbeat
       FROM carina_instances`,
    ),
    pool.query<{
      events_today: string;
      injection_blocks_24h: string;
      runtime_incidents_30d: string;
      warning_24h: string;
      breach_30d: string;
      blocked_24h: string;
      threats_24h: string;
      last_event_at: Date | null;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::text AS events_today,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND event_type ~ 'injection'
         )::text AS injection_blocks_24h,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND severity IN ('critical', 'breach')
         )::text AS runtime_incidents_30d,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND severity = 'warning'
         )::text AS warning_24h,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND severity = 'breach'
         )::text AS breach_30d,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND event_type ~ 'blocked|kill|quarantine|egress'
         )::text AS blocked_24h,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND severity IN ('warning', 'critical', 'breach')
         )::text AS threats_24h,
         MAX(created_at) AS last_event_at
       FROM security_events`,
    ),
    pool.query<Pick<AttestationMetricsRow, 'threats_30d' | 'injection_blocks_30d' | 'sandbox_violations_30d' | 'runtime_incidents_30d' | 'last_incident_at'>>(
      `SELECT
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND severity IN ('warning', 'critical', 'breach')
         )::text AS threats_30d,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND event_type ~ 'injection'
         )::text AS injection_blocks_30d,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND event_type ~ 'sandbox|escape|namespace'
         )::text AS sandbox_violations_30d,
         COUNT(*) FILTER (
           WHERE created_at > NOW() - INTERVAL '30 days'
             AND severity IN ('critical', 'breach')
         )::text AS runtime_incidents_30d,
         MAX(created_at) FILTER (
           WHERE severity IN ('critical', 'breach')
         ) AS last_incident_at
       FROM security_events`,
    ),
    pool.query<{ oldest_heartbeat: Date | null }>(
      `SELECT MIN(last_heartbeat) AS oldest_heartbeat
       FROM carina_instances
       WHERE last_heartbeat > NOW() - INTERVAL '30 days'`,
    ),
  ]);

  const instanceRow = instances.rows[0];
  const eventRow = events.rows[0];
  const extra = {
    ...attestationAgg.rows[0],
    oldest_heartbeat: heartbeatAgg.rows[0]?.oldest_heartbeat ?? null,
  };

  const metrics: TrustMetricsInput = {
    agentsTotal: parseInt(instanceRow?.agents_total ?? '0', 10),
    agentsActive: parseInt(instanceRow?.agents_active ?? '0', 10),
    agentsSuspended: parseInt(instanceRow?.agents_suspended ?? '0', 10),
    runtimeIncidents30d: parseInt(eventRow?.runtime_incidents_30d ?? '0', 10),
    warning24h: parseInt(eventRow?.warning_24h ?? '0', 10),
    breach30d: parseInt(eventRow?.breach_30d ?? '0', 10),
    eventsToday: parseInt(eventRow?.events_today ?? '0', 10),
    injectionBlocks24h: parseInt(eventRow?.injection_blocks_24h ?? '0', 10),
    blocked24h: parseInt(eventRow?.blocked_24h ?? '0', 10),
    threats24h: parseInt(eventRow?.threats_24h ?? '0', 10),
    lastEventAt: eventRow?.last_event_at ? new Date(eventRow.last_event_at).toISOString() : null,
    lastHeartbeatAt: instanceRow?.last_heartbeat
      ? new Date(instanceRow.last_heartbeat).toISOString()
      : null,
  };

  const riskScore = computeRiskScore(metrics);
  const runtimeHours = computeRuntimeHours(extra?.last_incident_at ?? null, extra?.oldest_heartbeat ?? null);

  const fields: LabyrinthScoutAttestationFields = {
    securityScore: securityScoreFromRisk(riskScore),
    runtimeHours,
    threatsDetected: parseInt(extra?.threats_30d ?? '0', 10),
    injectionBlocks: parseInt(extra?.injection_blocks_30d ?? '0', 10),
    sandboxViolations: parseInt(extra?.sandbox_violations_30d ?? '0', 10),
  };

  const eligibility = evaluateEligibility(metrics);

  return { metrics, fields, eligibility };
}

export function computeRuntimeHours(
  lastIncidentAt: Date | null,
  oldestHeartbeat: Date | null,
  now = new Date(),
): number {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const windowStart = now.getTime() - thirtyDaysMs;

  if (lastIncidentAt) {
    const sinceIncident = now.getTime() - new Date(lastIncidentAt).getTime();
    return Math.max(0, Math.floor(sinceIncident / (60 * 60 * 1000)));
  }

  if (oldestHeartbeat) {
    const sinceHeartbeat = now.getTime() - Math.max(windowStart, new Date(oldestHeartbeat).getTime());
    return Math.max(0, Math.floor(sinceHeartbeat / (60 * 60 * 1000)));
  }

  return 720;
}

export function evaluateEligibility(metrics: TrustMetricsInput): AttestationEligibility {
  if (metrics.agentsActive === 0) {
    return { eligible: false, reason: 'No active agents to attest' };
  }

  if (metrics.runtimeIncidents30d > 0) {
    return {
      eligible: false,
      reason: `${metrics.runtimeIncidents30d} critical/breach incident(s) in 30 days`,
    };
  }

  return { eligible: true };
}

export function attestationSummary(fields: LabyrinthScoutAttestationFields): string {
  return buildAttestationComment(fields);
}
