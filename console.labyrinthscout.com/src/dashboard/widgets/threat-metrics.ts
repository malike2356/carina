import type { Severity } from '../../types.js';
import { classifyIncident, type IncidentType } from '../../trust/incident-types.js';

export interface ThreatEventRow {
  severity: Severity;
  event_type: string;
  ip_address: string | null;
  instance_id?: string | null;
  metadata: Record<string, unknown> | string | null;
  created_at: Date | string;
}

export type ThreatEventCategory = 'attack' | 'blocked' | 'admin' | 'anomaly' | 'noise';

export interface ThreatMetricsSummary {
  window: '24h';
  /** Security-relevant attack traffic (not generic warnings). */
  attacks: number;
  /** Defensive blocks (injection, egress, quarantine). */
  blocked: number;
  /** Operator or control-plane actions. */
  admin_actions: number;
  /** Anomaly or honeypot signals. */
  anomalies: number;
  /** @deprecated Use `attacks`; kept for older clients. */
  threats: number;
  bySeverity: Record<Severity, number>;
  topAttackSources: Array<{ source: string; count: number }>;
  topBlockedDestinations: Array<{ destination: string; count: number }>;
  topInstanceIds: Array<{ instance_id: string; count: number }>;
  topTools: Array<{ tool: string; count: number }>;
  topPatterns: Array<{ pattern: string; count: number }>;
  attacks24h: Array<{ hour: string; count: number }>;
  attacksByIncidentType: Array<{ incident_type: IncidentType; count: number }>;
}

const SEVERITIES: Severity[] = ['info', 'warning', 'critical', 'breach'];

const ADMIN_EVENT_RE = /kill_switch|killswitch|resume|rate_limit|session_block|operator|admin_action|alert_test|honeypot_deployed|quarantine_lifted/;
const ANOMALY_EVENT_RE = /anomaly|z_score|z-score/;
const ATTACK_EVENT_RE = /injection|honeypot_triggered|egress_blocked|egress_domain_blocked|breach|prompt_injection|danger/;
const BLOCKED_EVENT_RE = /blocked|quarantine|tool_block|egress/;

export function classifyThreatEvent(eventType: string, severity: Severity): ThreatEventCategory {
  const type = eventType.toLowerCase();

  if (ADMIN_EVENT_RE.test(type)) return 'admin';
  if (ANOMALY_EVENT_RE.test(type)) return 'anomaly';

  if (ATTACK_EVENT_RE.test(type)) {
    return BLOCKED_EVENT_RE.test(type) ? 'blocked' : 'attack';
  }

  if (BLOCKED_EVENT_RE.test(type)) return 'blocked';

  if (severity === 'breach') return 'attack';
  if (severity === 'critical' && /injection|egress|honeypot|danger|breach/.test(type)) {
    return 'attack';
  }
  if (severity === 'warning' && /injection|egress|honeypot|danger/.test(type)) {
    return 'attack';
  }

  return 'noise';
}

export function buildThreatMetrics(rows: ThreatEventRow[], now = new Date()): ThreatMetricsSummary {
  const bySeverity: Record<Severity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
    breach: 0,
  };
  const sourceCounts = new Map<string, number>();
  const destinationCounts = new Map<string, number>();
  const instanceCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const incidentTypeCounts = new Map<IncidentType, number>();
  const hourCounts = new Map<string, number>();

  let attacks = 0;
  let blocked = 0;
  let adminActions = 0;
  let anomalies = 0;

  for (let i = 23; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    hourCounts.set(hourKey(d), 0);
  }

  for (const row of rows) {
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
    const category = classifyThreatEvent(row.event_type, row.severity);

    if (category === 'attack') {
      attacks += 1;
      const source = row.ip_address || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

      const instanceId = row.instance_id || 'unknown';
      instanceCounts.set(instanceId, (instanceCounts.get(instanceId) ?? 0) + 1);

      for (const pattern of extractPatterns(row.metadata)) {
        patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
      }

      const incidentType = classifyIncident(row.event_type, row.severity, '');
      incidentTypeCounts.set(incidentType, (incidentTypeCounts.get(incidentType) ?? 0) + 1);

      const key = hourKey(new Date(row.created_at));
      hourCounts.set(key, (hourCounts.get(key) ?? 0) + 1);
    } else if (category === 'blocked') {
      blocked += 1;
      const destination = extractBlockedDestination(row.metadata, row.event_type);
      destinationCounts.set(destination, (destinationCounts.get(destination) ?? 0) + 1);

      const tool = extractTool(row.metadata);
      if (tool) toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
    } else if (category === 'admin') {
      adminActions += 1;
    } else if (category === 'anomaly') {
      anomalies += 1;
    }
  }

  return {
    window: '24h',
    attacks,
    blocked,
    admin_actions: adminActions,
    anomalies,
    threats: attacks,
    bySeverity,
    topAttackSources: topEntries(sourceCounts, 5, 'source'),
    topBlockedDestinations: topEntries(destinationCounts, 5, 'destination'),
    topInstanceIds: topEntries(instanceCounts, 5, 'instance_id'),
    topTools: topEntries(toolCounts, 5, 'tool'),
    topPatterns: topEntries(patternCounts, 5, 'pattern'),
    attacks24h: [...hourCounts.entries()].map(([hour, count]) => ({ hour, count })),
    attacksByIncidentType: [...incidentTypeCounts.entries()]
      .map(([incident_type, count]) => ({ incident_type, count }))
      .sort((a, b) => b.count - a.count),
  };
}

function extractBlockedDestination(
  raw: ThreatEventRow['metadata'],
  eventType: string,
): string {
  const metadata = typeof raw === 'string' ? parseMetadata(raw) : raw;
  const hostname = metadata?.hostname ?? metadata?.domain ?? metadata?.destination;
  if (typeof hostname === 'string' && hostname.trim()) return hostname.trim();
  if (/egress/.test(eventType)) return 'egress';
  return 'unknown';
}

function extractTool(raw: ThreatEventRow['metadata']): string | null {
  const metadata = typeof raw === 'string' ? parseMetadata(raw) : raw;
  const tool = metadata?.tool ?? metadata?.tool_name;
  return typeof tool === 'string' && tool.trim() ? tool.trim() : null;
}

function extractPatterns(raw: ThreatEventRow['metadata']): string[] {
  const metadata = typeof raw === 'string' ? parseMetadata(raw) : raw;
  if (!metadata || typeof metadata !== 'object') return [];

  const candidates = [
    metadata.pattern_id,
    metadata.pattern,
    metadata.shield_ref,
    ...(Array.isArray(metadata.pattern_ids) ? metadata.pattern_ids : []),
    ...(Array.isArray(metadata.patterns) ? metadata.patterns : []),
  ];

  return candidates
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .map((value) => value.trim());
}

function parseMetadata(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function topEntries<K extends string>(
  counts: Map<string, number>,
  limit: number,
  key: K,
): Array<Record<K, string> & { count: number }> {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ [key]: name, count }) as Record<K, string> & { count: number });
}

function hourKey(date: Date): string {
  return date.toISOString().slice(0, 13) + ':00';
}
