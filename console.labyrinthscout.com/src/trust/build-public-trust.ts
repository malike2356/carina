import { pool } from '../db.js';
import { config } from '../config/index.js';
import {
  buildPublicTrustPayload,
  type ChainStatus,
  type TrustMetricsInput,
} from './compute-trust-metrics.js';
import { loadReferenceTrustIdentity } from './load-trust-identity.js';
import {
  loadRecentTrustAttestations,
  mapAttestationRowToPublic,
} from './load-trust-attestations.js';
import type { TrustAttestation } from './compute-trust-metrics.js';
import {
  loadLatestTrustVerification,
  mapVerificationRowToPublic,
} from './erc8126/load-verifications.js';

interface InstanceAggRow {
  agents_total: string;
  agents_active: string;
  agents_suspended: string;
  last_heartbeat: Date | null;
}

interface EventAggRow {
  events_today: string;
  injection_blocks_24h: string;
  runtime_incidents_30d: string;
  warning_24h: string;
  breach_30d: string;
  blocked_24h: string;
  threats_24h: string;
  last_event_at: Date | null;
}

function parseChainStatus(raw: string, fallback: ChainStatus): ChainStatus {
  const allowed: ChainStatus[] = ['live', 'registering', 'planned', 'enterprise'];
  return allowed.includes(raw as ChainStatus) ? (raw as ChainStatus) : fallback;
}

export async function buildPublicTrustFromDb(now = new Date()) {
  const [instances, events] = await Promise.all([
    pool.query<InstanceAggRow>(
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
    pool.query<EventAggRow>(
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
  ]);

  const instanceRow = instances.rows[0];
  const eventRow = events.rows[0];

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

  const identity = await loadReferenceTrustIdentity();
  const walletConfigured = Boolean(config.trust.attesterPrivateKey?.trim());
  let erc8004Status = identity?.registered
    ? 'live'
    : parseChainStatus(config.trust.erc8004Status, 'registering');
  if (!walletConfigured && !identity?.registered) {
    erc8004Status = 'planned';
  }

  const slug = identity?.slug ?? 'carina-reference';
  const [onChainRows, verificationRow] = await Promise.all([
    loadRecentTrustAttestations(slug),
    loadLatestTrustVerification(slug),
  ]);
  const onChainAttestations = onChainRows.map(mapAttestationRowToPublic);

  let erc8126Status = verificationRow
    ? 'live'
    : parseChainStatus(config.trust.erc8126Status, 'planned');
  if (!walletConfigured && !verificationRow) {
    erc8126Status = 'planned';
  }

  const payload = buildPublicTrustPayload(metrics, {
    erc8004: erc8004Status,
    erc8126: erc8126Status,
    walletConfigured,
  }, identity, now);

  if (verificationRow) {
    const verification = mapVerificationRowToPublic(verificationRow);
    payload.verification = verification;
    payload.risk_score = verification.unified_risk_score;
    payload.risk_tier = verification.unified_risk_tier;
    payload.risk_tier_label = verification.unified_risk_tier_label;
  }

  payload.attestations = mergeAttestations(onChainAttestations, payload.attestations);
  return payload;
}

function mergeAttestations(
  onChain: TrustAttestation[],
  offChain: TrustAttestation[],
): TrustAttestation[] {
  const merged = [...onChain];
  for (const item of offChain) {
    if (merged.length >= 5) break;
    if (item.on_chain) continue;
    merged.push(item);
  }
  return merged.slice(0, 5);
}
