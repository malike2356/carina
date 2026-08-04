import { buildAgentStatus, type AgentStatusRow } from './agent-status.js';
import { buildThreatMetrics, classifyThreatEvent, type ThreatEventRow } from './threat-metrics.js';

export type OverviewThreatLevel = 'NORMAL' | 'ELEVATED' | 'CRITICAL';
export type OverviewKillState = 'standby' | 'halted';

export interface OverviewEventRow extends ThreatEventRow {
  id?: string;
  description?: string | null;
  acknowledged?: boolean;
  mitigated?: boolean;
}

export interface OverviewFeedItem {
  id: string | null;
  severity: string;
  event_type: string;
  description: string;
  instance_id: string | null;
  created_at: string;
}

export interface OverviewMetricsInput {
  events: OverviewEventRow[];
  agents: AgentStatusRow[];
  killTriggered: boolean;
  killReason: string | null;
  findingsScore: number | null;
  honeypotHits24h?: number;
  tripwireHits24h?: number;
  now?: Date;
}

export interface OverviewMetrics {
  window: '24h';
  generatedAt: string;
  volume24h: number;
  volumeHourly: number[];
  blocked24h: number;
  blockedHourly: number[];
  threatsBlocked24h: number;
  attacks24h: number;
  anomalies24h: number;
  auditEvents24h: number;
  openIncidents24h: number;
  highSeverity24h: number;
  bySeverity: Record<string, number>;
  threatLevel: OverviewThreatLevel;
  threatLevelDescription: string;
  threatLoad: number;
  agents: {
    registered: number;
    online: number;
    suspended: number;
    offline: number;
    coveragePercent: number;
  };
  killSwitch: {
    state: OverviewKillState;
    halted: boolean;
    reason: string | null;
  };
  systemStatus: 'OK' | 'ALERT';
  systemStatusDetail: string;
  scoutScore: number | null;
  scoutScoreLabel: string;
  controlState: 'LIVE' | 'HALTED' | 'DEGRADED';
  controlStateDetail: string;
  honeypotHits24h: number;
  tripwireHits24h: number;
  feed: OverviewFeedItem[];
}

export function deriveThreatLevel(openIncidents24h: number, threatsBlocked24h: number): OverviewThreatLevel {
  if (openIncidents24h >= 3) return 'CRITICAL';
  if (openIncidents24h > 0 || threatsBlocked24h > 2) return 'ELEVATED';
  return 'NORMAL';
}

export function buildOverviewMetrics(input: OverviewMetricsInput): OverviewMetrics {
  const now = input.now ?? new Date();
  const threat = buildThreatMetrics(input.events, now);
  const agents = buildAgentStatus(input.agents, now.getTime());
  const coveragePercent = agents.total > 0
    ? Math.round((agents.active / agents.total) * 100)
    : 0;

  const volumeHourly = new Array(24).fill(0) as number[];
  const blockedHourly = new Array(24).fill(0) as number[];
  let volume24h = 0;
  let highSeverity24h = 0;
  let openIncidents24h = 0;
  const bySeverity: Record<string, number> = {
    info: 0,
    warning: 0,
    critical: 0,
    breach: 0,
  };

  for (const row of input.events) {
    volume24h += 1;
    bySeverity[row.severity] = (bySeverity[row.severity] ?? 0) + 1;
    const isHigh = row.severity === 'critical' || row.severity === 'breach';
    if (isHigh) {
      highSeverity24h += 1;
      const closed = row.acknowledged === true || row.mitigated === true;
      if (!closed) openIncidents24h += 1;
    }

    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const age = now.getTime() - ts;
    if (age < 0 || age > 86_400_000) continue;
    const idx = Math.min(23, Math.floor((age / 86_400_000) * 24));
    const bucket = Math.max(0, Math.min(23, 23 - idx));
    volumeHourly[bucket] = (volumeHourly[bucket] ?? 0) + 1;
    const category = classifyThreatEvent(row.event_type, row.severity);
    if (category === 'blocked' || category === 'attack') {
      blockedHourly[bucket] = (blockedHourly[bucket] ?? 0) + 1;
    }
  }

  const threatsBlocked24h = threat.blocked + threat.attacks;
  const threatLevel = deriveThreatLevel(openIncidents24h, threatsBlocked24h);
  const threatLoad = threatsBlocked24h + highSeverity24h;
  const killHalted = input.killTriggered === true;
  const systemStatus: OverviewMetrics['systemStatus'] = openIncidents24h > 0 || killHalted
    ? 'ALERT'
    : 'OK';

  let threatLevelDescription: string;
  if (threatLevel === 'CRITICAL') {
    threatLevelDescription = `${openIncidents24h} open high-severity incidents in last 24h. Immediate review required.`;
  } else if (threatLevel === 'ELEVATED') {
    threatLevelDescription = `${openIncidents24h || threatsBlocked24h} flagged event${(openIncidents24h || threatsBlocked24h) === 1 ? '' : 's'} in the monitoring window.`;
  } else {
    threatLevelDescription = `No open high-severity incidents. ${volume24h} events logged in last 24h.`;
  }

  let controlState: OverviewMetrics['controlState'] = 'LIVE';
  let controlStateDetail = 'Control plane active; metrics from server aggregates';
  if (killHalted) {
    controlState = 'HALTED';
    controlStateDetail = input.killReason
      ? `Kill switch triggered: ${input.killReason}`
      : 'Kill switch triggered; agents halted';
  } else if (agents.total > 0 && agents.active === 0) {
    controlState = 'DEGRADED';
    controlStateDetail = 'No online agents in the registered fleet';
  }

  const feed = [...input.events]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 20)
    .map((row) => ({
      id: row.id ?? null,
      severity: row.severity,
      event_type: row.event_type,
      description: (row.description && String(row.description).trim()) || row.event_type,
      instance_id: row.instance_id ?? null,
      created_at: new Date(row.created_at).toISOString(),
    }));

  return {
    window: '24h',
    generatedAt: now.toISOString(),
    volume24h,
    volumeHourly,
    blocked24h: threat.blocked,
    blockedHourly,
    threatsBlocked24h,
    attacks24h: threat.attacks,
    anomalies24h: threat.anomalies,
    auditEvents24h: volume24h,
    openIncidents24h,
    highSeverity24h,
    bySeverity,
    threatLevel,
    threatLevelDescription,
    threatLoad,
    agents: {
      registered: agents.total,
      online: agents.active,
      suspended: agents.suspended,
      offline: agents.offline,
      coveragePercent,
    },
    killSwitch: {
      state: killHalted ? 'halted' : 'standby',
      halted: killHalted,
      reason: input.killReason,
    },
    systemStatus,
    systemStatusDetail: systemStatus === 'ALERT'
      ? (killHalted
        ? 'Kill switch halted'
        : `${openIncidents24h} open high-sev incident${openIncidents24h === 1 ? '' : 's'}`)
      : 'no active alerts',
    scoutScore: input.findingsScore,
    scoutScoreLabel: input.findingsScore == null
      ? 'no data yet'
      : 'findings posture / 100',
    controlState,
    controlStateDetail,
    honeypotHits24h: input.honeypotHits24h ?? 0,
    tripwireHits24h: input.tripwireHits24h ?? 0,
    feed,
  };
}
