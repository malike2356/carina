import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/index.js';
import { getKillSwitchStatus } from '../kill-switch-listener.js';
import { readSecurityAuditTail, type SecurityAuditEvent } from '../security-audit.js';
import { buildSecurityTrustState } from '../trust-state.js';
import { buildComplianceDashboardFromCache } from '../compliance/index.js';
import { buildRaspStatus, getRaspEngine, isRaspEnabled } from '../rasp/index.js';
import { buildSecretsStatusReport } from '../secrets/index.js';
import { buildLatestReport } from '../red-team/store.js';
import { buildGovernanceStatus } from '../governance/index.js';
import { forensicsEngine } from '../forensics/engine.js';
import { sbomOutputPath, supplyChainCacheDir } from '../supply-chain/paths.js';
import type { SupplyChainReport } from '../supply-chain/types.js';
import type {
  ComplianceStatusSummary,
  DashboardEventAction,
  RedTeamSummary,
  ScoutDashboardStatus,
  SecretsStatus,
  SecurityDashboardData,
  SecurityEvent,
  SupplyChainHealth,
  ThreatLevel,
  TrustScorePoint,
} from './types.js';

const MS_DAY = 86_400_000;
const MS_WEEK = 7 * MS_DAY;

export function computeTrustScore(state: Awaited<ReturnType<typeof buildSecurityTrustState>>): number {
  let score = 100;
  if (state.suspended) score = 15;
  if (state.labyrinthEnabled && !state.enforcement.remoteScoutPolicy) score -= 18;
  if (!state.labyrinthEnabled) score -= 8;
  const recentIssues = state.recentSecurityAudit.filter((event) =>
    event.category === 'prompt_injection' || event.category === 'kill_switch',
  ).length;
  score -= Math.min(recentIssues * 6, 30);
  if (state.toolPolicy.allowlistEnforced) score += 5;
  return Math.max(0, Math.min(100, score));
}

function mapAuditAction(event: SecurityAuditEvent): DashboardEventAction {
  if (event.category === 'kill_switch' || event.action === 'block' || event.action === 'deny') {
    return 'blocked';
  }
  if (event.category === 'prompt_injection') return 'alert';
  if (event.action === 'monitor' || event.action === 'warn') return 'monitor';
  return 'log';
}

function mapAuditLabel(event: SecurityAuditEvent): string {
  if (event.category === 'prompt_injection') return 'Prompt injection';
  if (event.category === 'kill_switch') return 'Kill switch';
  if (event.category === 'tool_policy') return 'Tool policy';
  if (event.category === 'sandbox_policy') return 'Sandbox policy';
  if (event.category === 'scout_policy') return 'Scout policy';
  return event.category.replace(/_/g, ' ');
}

function mapAuditEvents(events: SecurityAuditEvent[]): SecurityEvent[] {
  return events.slice(-20).reverse().map((event, index) => ({
    id: `${event.at}-${index}`,
    timestamp: event.at,
    label: mapAuditLabel(event),
    action: mapAuditAction(event),
    agentId: event.sessionId ? `agent:${event.sessionId.slice(0, 12)}` : 'agent:carina-main',
    sessionId: event.sessionId,
    source: event.category,
  }));
}

function mapRaspEvents(): SecurityEvent[] {
  const signals = getRaspEngine().getActiveSignals().slice(-10).reverse();
  return signals.map((signal, index) => ({
    id: signal.id ?? `rasp-${signal.timestamp}-${index}`,
    timestamp: new Date(signal.timestamp).toISOString(),
    label: signal.type.replace(/_/g, ' '),
    action: signal.severity >= 0.75 ? 'blocked' : signal.severity >= 0.5 ? 'alert' : 'monitor',
    agentId: signal.context.agentId || `agent:${signal.context.sessionId.slice(0, 12)}`,
    sessionId: signal.context.sessionId,
    source: signal.source,
  }));
}

function deriveThreatLevel(input: {
  killSwitch: boolean;
  trustScore: number;
  activeThreats: number;
  lastThreatScore?: number;
}): ThreatLevel {
  if (input.killSwitch || input.trustScore < 25) return 'critical';
  if (input.activeThreats >= 5 || input.trustScore < 45 || (input.lastThreatScore ?? 0) >= 80) {
    return 'high';
  }
  if (input.activeThreats >= 2 || input.trustScore < 70 || (input.lastThreatScore ?? 0) >= 55) {
    return 'medium';
  }
  return 'low';
}

function deriveRaspStatus(
  rasp: Awaited<ReturnType<typeof buildRaspStatus>>,
): SecurityDashboardData['raspStatus'] {
  if (!isRaspEnabled()) return 'offline';
  if (rasp.suspended || !rasp.enabled) return 'degraded';
  return 'active';
}

function buildTrustHistory(events: SecurityAuditEvent[], currentScore: number): TrustScorePoint[] {
  const buckets = new Map<string, number>();
  const now = Date.now();
  for (let day = 29; day >= 0; day -= 1) {
    const date = new Date(now - day * MS_DAY);
    buckets.set(date.toISOString().slice(0, 10), currentScore);
  }
  for (const event of events) {
    const day = event.at.slice(0, 10);
    if (!buckets.has(day)) continue;
    let score = buckets.get(day) ?? currentScore;
    if (event.category === 'kill_switch' || event.category === 'prompt_injection') score -= 8;
    else if (event.action === 'block' || event.action === 'deny') score -= 4;
    buckets.set(day, Math.max(0, Math.min(100, score)));
  }
  return [...buckets.entries()].map(([date, score]) => ({ date, score }));
}

function countIncidentsByWindow(incidents: Awaited<ReturnType<typeof forensicsEngine.listIncidents>>, sinceMs: number): number {
  return incidents.filter((row) => row.detectedAt >= sinceMs).length;
}

async function loadSupplyChainHealth(): Promise<SupplyChainHealth> {
  const fallback: SupplyChainHealth = {
    dependencyCount: 0,
    vulnerabilityCount: 0,
    criticalCount: 0,
    sbomGeneratedAt: null,
    lastScanAt: null,
    verdict: 'unknown',
  };

  try {
    const cachePath = path.join(supplyChainCacheDir(), 'last-report.json');
    const raw = await fs.readFile(cachePath, 'utf8');
    return mapSupplyChainHealth(JSON.parse(raw) as SupplyChainReport);
  } catch {
    // fall through
  }

  try {
    const sbomPath = sbomOutputPath();
    const stat = await fs.stat(sbomPath);
    fallback.sbomGeneratedAt = stat.mtime.toISOString();
  } catch {
    // ignore
  }

  if (process.env.CARINA_DASHBOARD_LIVE_SUPPLY_CHAIN === 'true') {
    try {
      const { runSupplyChainReview } = await import('../supply-chain/index.js');
      const report = await runSupplyChainReview({ includeSbom: false });
      await fs.mkdir(supplyChainCacheDir(), { recursive: true });
      await fs.writeFile(
        path.join(supplyChainCacheDir(), 'last-report.json'),
        JSON.stringify(report, null, 2),
        { mode: 0o600 },
      );
      return mapSupplyChainHealth(report);
    } catch {
      return fallback;
    }
  }

  return fallback;
}

function mapSupplyChainHealth(report: SupplyChainReport): SupplyChainHealth {
  const scan = report.dependencyScan;
  const sbomPackages = report.sbom?.packages?.length ?? 0;
  return {
    dependencyCount: scan?.findings.length ? scan.findings.length + sbomPackages : sbomPackages,
    vulnerabilityCount: scan
      ? scan.summary.critical + scan.summary.high + scan.summary.medium + scan.summary.low
      : 0,
    criticalCount: scan?.summary.critical ?? 0,
    sbomGeneratedAt: report.sbom?.creationInfo.created ?? null,
    lastScanAt: scan?.scannedAt ?? report.generatedAt ?? null,
    verdict: scan?.verdict ?? 'unknown',
  };
}

function mapComplianceStatus(
  dashboard: Awaited<ReturnType<typeof buildComplianceDashboardFromCache>>,
): ComplianceStatusSummary {
  return {
    overallScorePercent: dashboard.overallScorePercent,
    overallStatus: dashboard.overallStatus,
    frameworks: dashboard.frameworks.map((row) => ({
      id: row.id,
      name: row.name,
      scorePercent: row.scorePercent,
    })),
  };
}

function mapSecretsStatus(report: Awaited<ReturnType<typeof buildSecretsStatusReport>>): SecretsStatus {
  const rows = report.rows.map((row) => ({
    provider: row.provider,
    expiresInDays: Math.max(0, Math.ceil(row.expiresInMs / MS_DAY)),
    stale: row.stale,
  }));
  return {
    activeCount: rows.length,
    expiringSoonCount: rows.filter((row) => row.expiresInDays <= 7 && !row.stale).length,
    staleCount: rows.filter((row) => row.stale).length,
    rows,
  };
}

function mapRedTeamSummary(report: Awaited<ReturnType<typeof buildLatestReport>>): RedTeamSummary {
  const totalCount = report.results.length;
  const passedCount = report.results.filter((row) => row.blocked || row.detected).length;
  const lastRun = report.results.reduce<number | null>((latest, row) => {
    if (latest === null || row.timestamp > latest) return row.timestamp;
    return latest;
  }, null);
  return {
    lastRunAt: lastRun ? new Date(lastRun).toISOString() : null,
    exercisesRun: report.exercisesRun,
    passedCount,
    totalCount,
    passRatePercent: totalCount > 0 ? Math.round((passedCount / totalCount) * 100) : 0,
    criticalGaps: report.unresolvedGaps.filter((gap) => gap.severity === 'critical').length,
  };
}

function mapScoutStatus(state: Awaited<ReturnType<typeof buildSecurityTrustState>>): ScoutDashboardStatus {
  return {
    connected: state.enforcement.remoteScoutPolicy,
    armed: state.labyrinthEnabled && state.scoutConfigured,
    url: config.labyrinth.enabled ? config.labyrinth.url : null,
  };
}

export async function buildSecurityDashboardData(): Promise<SecurityDashboardData> {
  const now = Date.now();
  const [
    trustState,
    raspStatus,
    compliance,
    secretsReport,
    redTeamReport,
    governance,
    incidents,
    supplyChainHealth,
  ] = await Promise.all([
    buildSecurityTrustState(),
    buildRaspStatus(),
    buildComplianceDashboardFromCache(),
    buildSecretsStatusReport(),
    buildLatestReport(),
    buildGovernanceStatus(),
    forensicsEngine.listIncidents(50),
    loadSupplyChainHealth(),
  ]);

  const trustScore = computeTrustScore(trustState);
  const auditEvents = readSecurityAuditTail(200);
  const trustHistory = buildTrustHistory(auditEvents, trustScore);
  const previousTrust = trustHistory.length > 1
    ? trustHistory[trustHistory.length - 2].score
    : trustScore;
  const incidentsThisWeek = countIncidentsByWindow(incidents, now - MS_WEEK);
  const incidentsLastWeek = countIncidentsByWindow(
    incidents,
    now - 2 * MS_WEEK,
  ) - incidentsThisWeek;
  const incidentsTrend = incidentsLastWeek > 0
    ? Math.round(((incidentsThisWeek - incidentsLastWeek) / incidentsLastWeek) * 100)
    : incidentsThisWeek > 0 ? 100 : 0;

  const raspEvents = mapRaspEvents();
  const auditMapped = mapAuditEvents(auditEvents);
  const realTimeEvents = [...raspEvents, ...auditMapped]
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 20);

  const activeThreats = raspStatus.activeSignalCount + raspStatus.blockedSessionCount;
  const killSwitchActive = getKillSwitchStatus().active;

  return {
    generatedAt: new Date().toISOString(),
    threatLevel: deriveThreatLevel({
      killSwitch: killSwitchActive,
      trustScore,
      activeThreats,
      lastThreatScore: raspStatus.lastAssessment?.threatScore,
    }),
    activeThreats,
    trustScore,
    trustScoreTrend: trustScore - previousTrust,
    trustHistory,
    incidentsThisWeek,
    incidentsTrend,
    raspStatus: deriveRaspStatus(raspStatus),
    scoutStatus: mapScoutStatus(trustState),
    realTimeEvents,
    complianceStatus: mapComplianceStatus(compliance),
    supplyChainHealth,
    secretsStatus: mapSecretsStatus(secretsReport),
    redTeamResults: mapRedTeamSummary(redTeamReport),
    recentIncidents: incidents.slice(0, 8),
    governanceHealthy: governance.auditChainValid && governance.activePolicies > 0,
    killSwitchActive,
  };
}
