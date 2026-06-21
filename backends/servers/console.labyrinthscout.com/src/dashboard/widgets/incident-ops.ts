export interface IncidentEventRow {
  id: string;
  severity: string;
  event_type: string;
  acknowledged: boolean;
  acknowledged_at: Date | string | null;
  mitigated: boolean;
  created_at: Date | string;
}

export interface IncidentOpsSummary {
  open_critical: number;
  unresolved_critical: number;
  acknowledged_count: number;
  blocked_actions_24h: number;
  injection_blocks_24h: number;
  unresolved_runtime_incidents: number;
  repeat_incident_count: number;
  avg_time_to_acknowledge_ms: number | null;
  incident_rate_change_pct: number | null;
}

export function buildIncidentOps(
  rows: IncidentEventRow[],
  options: {
    blocked_actions_24h?: number;
    injection_blocks_24h?: number;
    incident_rate_change_pct?: number | null;
  } = {},
): IncidentOpsSummary {
  const criticalRows = rows.filter((row) => row.severity === 'critical' || row.severity === 'breach');
  const openCritical = criticalRows.filter((row) => !row.acknowledged && !row.mitigated);
  const acknowledged = rows.filter((row) => row.acknowledged);
  const runtimeUnresolved = rows.filter(
    (row) =>
      !row.acknowledged
      && !row.mitigated
      && /sandbox|escape|namespace|runtime|injection|breach|critical/.test(
        `${row.event_type} ${row.severity}`.toLowerCase(),
      ),
  );

  const ackDurations = acknowledged
    .map((row) => {
      if (!row.acknowledged_at) return null;
      const created = new Date(row.created_at).getTime();
      const acked = new Date(row.acknowledged_at).getTime();
      if (!Number.isFinite(created) || !Number.isFinite(acked) || acked < created) return null;
      return acked - created;
    })
    .filter((value): value is number => value !== null);

  const typeCounts = new Map<string, number>();
  for (const row of rows) {
    const key = row.event_type;
    typeCounts.set(key, (typeCounts.get(key) ?? 0) + 1);
  }
  const repeatIncidentCount = [...typeCounts.values()].filter((count) => count > 1).length;

  const avgAck = ackDurations.length > 0
    ? Math.round(ackDurations.reduce((sum, value) => sum + value, 0) / ackDurations.length)
    : null;

  return {
    open_critical: openCritical.length,
    unresolved_critical: openCritical.length,
    acknowledged_count: acknowledged.length,
    blocked_actions_24h: options.blocked_actions_24h ?? countBlocked(rows),
    injection_blocks_24h: options.injection_blocks_24h ?? countInjection(rows),
    unresolved_runtime_incidents: runtimeUnresolved.length,
    repeat_incident_count: repeatIncidentCount,
    avg_time_to_acknowledge_ms: avgAck,
    incident_rate_change_pct: options.incident_rate_change_pct ?? null,
  };
}

function countBlocked(rows: IncidentEventRow[]): number {
  return rows.filter((row) => /blocked|quarantine|egress|kill/.test(row.event_type)).length;
}

function countInjection(rows: IncidentEventRow[]): number {
  return rows.filter((row) => /injection/.test(row.event_type)).length;
}
