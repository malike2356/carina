import { pool } from '../db.js';
import { config } from '../config/index.js';
import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';
import { buildAgentStatus } from '../dashboard/widgets/agent-status.js';
import { buildIncidentOps } from '../dashboard/widgets/incident-ops.js';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';
import { loadPlatformSecuritySettings } from '../lib/platform-settings.js';
import { getRedis } from '../redis.js';
import {
  classifyRegulatoryRisk,
  type RegulatoryClassification,
  type RegulatoryClassificationInput,
} from './regulatory-classification.js';

const CACHE_KEY = 'scout:regulatory:classification';
const CACHE_TTL_SECS = 300;

export async function invalidateRegulatoryClassificationCache(): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(CACHE_KEY);
  } catch {
    /* cache miss is fine */
  }
}

export async function gatherRegulatoryClassificationInput(): Promise<RegulatoryClassificationInput> {
  const [
    trust,
    agentRows,
    audit7d,
    telemetryDays,
    breach24h,
    incidentRows,
    attestationRow,
    securitySettings,
  ] = await Promise.all([
    buildPublicTrustFromDb(),
    pool.query<{
      id: string;
      name: string;
      status: string;
      suspension_reason: string | null;
      last_heartbeat: Date | null;
    }>(
      `SELECT id, name, status, suspension_reason, last_heartbeat FROM carina_instances ORDER BY created_at ASC`,
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM security_events WHERE created_at > NOW() - INTERVAL '7 days'`,
    ),
    pool.query<{ days: string }>(
      `SELECT GREATEST(0, EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 86400)::int::text AS days
       FROM security_events`,
    ).catch(() => ({ rows: [{ days: '0' }] })),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM security_events
       WHERE severity = 'breach' AND created_at > NOW() - INTERVAL '24 hours'`,
    ).catch(() => ({ rows: [{ count: '0' }] })),
    pool.query<{
      severity: string;
      acknowledged: boolean;
      mitigated: boolean;
    }>(
      `SELECT severity, acknowledged, mitigated
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '30 days'
         AND severity IN ('critical', 'breach')`,
    ),
    pool.query<{ submitted_at: Date }>(
      `SELECT submitted_at FROM trust_attestations
       WHERE status = 'submitted'
       ORDER BY submitted_at DESC LIMIT 1`,
    ).catch(() => ({ rows: [] })),
    loadPlatformSecuritySettings(),
  ]);

  const agents = buildAgentStatus(agentRows.rows);
  const killStatus = globalKillSwitch.getStatus();
  const incidents = buildIncidentOps(
    incidentRows.rows.map((row, idx) => ({
      id: `reg-${idx}`,
      severity: row.severity,
      event_type: 'incident',
      acknowledged: row.acknowledged,
      acknowledged_at: null,
      mitigated: row.mitigated,
      created_at: new Date().toISOString(),
    })),
  );

  const alertChannelCount = [
    config.alerts.telegram.botToken && config.alerts.telegram.chatId,
    config.alerts.email.resendApiKey && config.alerts.email.to,
    config.alerts.slack.webhookUrl,
    config.alerts.discord.webhookUrl,
  ].filter(Boolean).length;

  const lastAttestation = attestationRow.rows[0]?.submitted_at
    ? new Date(attestationRow.rows[0].submitted_at).toISOString()
    : null;

  return {
    risk_score: trust.risk_score,
    unresolved_critical: incidents.unresolved_critical,
    kill_switch_armed: killStatus.armed,
    kill_switch_triggered: killStatus.triggered,
    erc8004_status: trust.chain.erc8004_status,
    agents_total: agents.total,
    last_attestation_at: lastAttestation,
    alert_channels_configured: alertChannelCount > 0,
    audit_events_last_7d: parseInt(audit7d.rows[0]?.count ?? '0', 10) > 0,
    egress_filter_enabled: securitySettings.egress_filter_enabled,
    breach_events_24h: parseInt(breach24h.rows[0]?.count ?? '0', 10),
    telemetry_days: parseInt(telemetryDays.rows[0]?.days ?? '0', 10),
  };
}

export async function loadRegulatoryClassification(): Promise<RegulatoryClassification> {
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as RegulatoryClassification;
      }
    } catch {
      /* fall through to fresh load */
    }
  }

  const input = await gatherRegulatoryClassificationInput();
  const classification = classifyRegulatoryRisk(input);

  if (redis) {
    try {
      await redis.setex(CACHE_KEY, CACHE_TTL_SECS, JSON.stringify(classification));
    } catch {
      /* non-fatal */
    }
  }

  return classification;
}
