import type { Severity } from '../../types.js';

export interface ThreatEventRow {
  severity: Severity;
  event_type: string;
  ip_address: string | null;
  metadata: Record<string, unknown> | string | null;
  created_at: Date | string;
}

export interface ThreatMetricsSummary {
  window: '24h';
  threats: number;
  blocked: number;
  bySeverity: Record<Severity, number>;
  topAttackSources: Array<{ source: string; count: number }>;
  topPatterns: Array<{ pattern: string; count: number }>;
  attacks24h: Array<{ hour: string; count: number }>;
}

const SEVERITIES: Severity[] = ['info', 'warning', 'critical', 'breach'];

export function buildThreatMetrics(rows: ThreatEventRow[], now = new Date()): ThreatMetricsSummary {
  const bySeverity: Record<Severity, number> = {
    info: 0,
    warning: 0,
    critical: 0,
    breach: 0,
  };
  const sourceCounts = new Map<string, number>();
  const patternCounts = new Map<string, number>();
  const hourCounts = new Map<string, number>();

  for (let i = 23; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    hourCounts.set(hourKey(d), 0);
  }

  for (const row of rows) {
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
    if (isAttack(row.event_type)) {
      const source = row.ip_address || 'unknown';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);

      for (const pattern of extractPatterns(row.metadata)) {
        patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
      }

      const key = hourKey(new Date(row.created_at));
      hourCounts.set(key, (hourCounts.get(key) ?? 0) + 1);
    }
  }

  return {
    window: '24h',
    threats: bySeverity.warning + bySeverity.critical + bySeverity.breach,
    blocked: rows.filter((row) => /blocked|kill|quarantine|egress/.test(row.event_type)).length,
    bySeverity,
    topAttackSources: topEntries(sourceCounts, 5, 'source'),
    topPatterns: topEntries(patternCounts, 5, 'pattern'),
    attacks24h: [...hourCounts.entries()].map(([hour, count]) => ({ hour, count })),
  };
}

function isAttack(eventType: string): boolean {
  return /injection|blocked|breach|honeypot|egress|danger|kill|quarantine/.test(eventType);
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

function topEntries<K extends 'source' | 'pattern'>(
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
