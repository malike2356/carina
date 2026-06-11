import {
  computeRiskScore,
  evaluateDataFreshness,
  formatRelativeTime,
  type PublicTrustPayload,
  type TrustMetricsInput,
} from '../../trust/compute-trust-metrics.js';
import type { AgentStatusSummary } from './agent-status.js';
import type { IncidentOpsSummary } from './incident-ops.js';
import type { ThreatMetricsSummary } from './threat-metrics.js';

export interface ControlPlaneHealth {
  alert_channels_configured: boolean;
  alert_channel_count: number;
  deception_enabled: boolean;
  egress_filter_enabled: boolean;
  egress_filter_source?: 'gui' | 'env';
  sandbox_enabled: boolean;
  sandbox_source?: 'gui' | 'env';
  redis_connected: boolean;
  database_connected: boolean;
  sse_subscribers: number;
  kill_switch_armed: boolean;
  kill_switch_triggered: boolean;
}

export interface TrustHealthSummary {
  last_attestation_at: string | null;
  last_attestation_age: string | null;
  last_verification_at: string | null;
  last_verification_age: string | null;
  erc8004_status: string;
  erc8004_label: string;
  erc8126_status: string;
  erc8126_label: string;
  wallet_configured: boolean;
  on_chain_request_tx: string | null;
  on_chain_response_tx: string | null;
}

export interface PostureSummary {
  generated_at: string;
  risk_score: number;
  risk_tier: string;
  risk_tier_label: string;
  agents: Pick<AgentStatusSummary, 'total' | 'active' | 'suspended' | 'offline'>;
  freshness: PublicTrustPayload['data_freshness'] & {
    heartbeat_age_seconds: number | null;
    heartbeat_age_label: string | null;
    last_event_age_seconds: number | null;
    last_event_age_label: string | null;
    sse_subscribers: number;
  };
  incidents: IncidentOpsSummary;
  trust: TrustHealthSummary;
  control_plane: ControlPlaneHealth;
  attacks: Pick<
    ThreatMetricsSummary,
    | 'attacks'
    | 'blocked'
    | 'anomalies'
    | 'admin_actions'
    | 'topTools'
    | 'topBlockedDestinations'
    | 'topInstanceIds'
    | 'topPatterns'
    | 'attacksByIncidentType'
  >;
  action_queue: Array<{ id: string; label: string; severity: 'critical' | 'warning' | 'info' }>;
}

export function buildPostureSummary(input: {
  metrics: TrustMetricsInput;
  trust: PublicTrustPayload;
  agents: AgentStatusSummary;
  incidents: IncidentOpsSummary;
  threats: ThreatMetricsSummary;
  controlPlane: ControlPlaneHealth;
  trustHealth: TrustHealthSummary;
  now?: Date;
}): PostureSummary {
  const now = input.now ?? new Date();
  const freshness = evaluateDataFreshness(input.metrics, now);
  const heartbeatAge = ageSeconds(input.metrics.lastHeartbeatAt, now);
  const eventAge = ageSeconds(input.metrics.lastEventAt, now);
  const queue = buildActionQueue(input);

  return {
    generated_at: now.toISOString(),
    risk_score: input.trust.risk_score,
    risk_tier: input.trust.risk_tier,
    risk_tier_label: input.trust.risk_tier_label,
    agents: {
      total: input.agents.total,
      active: input.agents.active,
      suspended: input.agents.suspended,
      offline: input.agents.offline,
    },
    freshness: {
      ...freshness,
      heartbeat_age_seconds: heartbeatAge,
      heartbeat_age_label: formatRelativeTime(input.metrics.lastHeartbeatAt, now.getTime()),
      last_event_age_seconds: eventAge,
      last_event_age_label: formatRelativeTime(input.metrics.lastEventAt, now.getTime()),
      sse_subscribers: input.controlPlane.sse_subscribers,
    },
    incidents: input.incidents,
    trust: input.trustHealth,
    control_plane: input.controlPlane,
    attacks: {
      attacks: input.threats.attacks,
      blocked: input.threats.blocked,
      anomalies: input.threats.anomalies,
      admin_actions: input.threats.admin_actions,
      topTools: input.threats.topTools,
      topBlockedDestinations: input.threats.topBlockedDestinations,
      topInstanceIds: input.threats.topInstanceIds,
      topPatterns: input.threats.topPatterns,
      attacksByIncidentType: input.threats.attacksByIncidentType,
    },
    action_queue: queue,
  };
}

function buildActionQueue(input: {
  incidents: IncidentOpsSummary;
  controlPlane: ControlPlaneHealth;
  trust: PublicTrustPayload;
  metrics: TrustMetricsInput;
}): PostureSummary['action_queue'] {
  const queue: PostureSummary['action_queue'] = [];

  if (input.incidents.unresolved_critical > 0) {
    queue.push({
      id: 'unresolved-critical',
      label: `${input.incidents.unresolved_critical} unresolved critical incident(s)`,
      severity: 'critical',
    });
  }
  if (input.trust.data_freshness.stale) {
    queue.push({
      id: 'stale-data',
      label: input.trust.data_freshness.stale_reason ?? 'Telemetry is stale',
      severity: 'warning',
    });
  }
  if (input.controlPlane.kill_switch_triggered) {
    queue.push({
      id: 'kill-switch',
      label: 'Kill switch is triggered',
      severity: 'critical',
    });
  }
  if (!input.controlPlane.alert_channels_configured) {
    queue.push({
      id: 'alerts',
      label: 'No alert channels configured',
      severity: 'warning',
    });
  }
  if (input.metrics.agentsActive === 0 && input.metrics.agentsTotal > 0) {
    queue.push({
      id: 'agents-offline',
      label: 'No active agents; all protected instances offline',
      severity: 'warning',
    });
  }
  if (!input.trust.chain.wallet_configured) {
    queue.push({
      id: 'wallet',
      label: 'Trust wallet not configured',
      severity: 'info',
    });
  }

  return queue.slice(0, 6);
}

function ageSeconds(iso: string | null, now: Date): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.max(0, Math.floor((now.getTime() - then) / 1000));
}

export function computeRiskDelta(current: number, previous: number | null): number | null {
  if (previous === null || !Number.isFinite(previous)) return null;
  return current - previous;
}

export { computeRiskScore };
