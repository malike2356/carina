import { Router, type IRouter } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db.js';
import { searchAuditLog } from '../audit/audit-search.js';
import { config } from '../config/index.js';
import { getRedis } from '../redis.js';
import { getSseSubscriberCount } from './sse.js';
import { buildAgentStatus } from '../dashboard/widgets/agent-status.js';
import { buildThreatMetrics } from '../dashboard/widgets/threat-metrics.js';
import { buildUsageAnalytics } from '../dashboard/widgets/usage-analytics.js';
import { buildIncidentOps } from '../dashboard/widgets/incident-ops.js';
import {
  buildPostureSummary,
  type ControlPlaneHealth,
  type TrustHealthSummary,
} from '../dashboard/widgets/posture-summary.js';
import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';
import { scopedAccountId } from '../lib/scope.js';
import { loadPlatformSecuritySettings } from '../lib/platform-settings.js';
import { buildDefenseConsole } from '../dashboard/widgets/defense-console.js';
import { buildResponseTerminal } from '../dashboard/widgets/response-terminal.js';
import { getShieldMode } from '../security/session-shield.js';
import { getAppliedPolicyPack, listPolicyPacks } from '../security/policy-packs.js';
import { listSessionGrants } from '../security/jit-privileges.js';
import { listSurfaceRestrictions } from '../security/attack-surface.js';
import { getRemediationRules } from '../security/auto-remediation.js';
import { getTripwireConfig, listRecentTripwireHits } from '../security/tripwire-registry.js';

export const dashboardRouter: IRouter = Router();

dashboardRouter.get('/defense', async (req: Request, res: Response): Promise<void> => {
  try {
    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : null;
    const instanceId = typeof req.query.instance_id === 'string' ? req.query.instance_id : 'default';

    const eventsResult = await pool.query<{
      id: string;
      event_type: string;
      description: string;
      severity: 'info' | 'warning' | 'critical' | 'breach';
      session_id: string | null;
      metadata: Record<string, unknown> | string | null;
      created_at: Date;
    }>(
      `SELECT id, event_type, description, severity, session_id, metadata, created_at
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 200`,
    );

    const rows = eventsResult.rows;
    const blockedCount = rows.filter((r) =>
      /blocked|quarantine|policy_decision|injection/.test(r.event_type),
    ).length;
    const toolCounts = new Map<string, number>();
    for (const row of rows) {
      const meta = typeof row.metadata === 'object' && row.metadata !== null
        ? row.metadata as Record<string, unknown>
        : {};
      const tool = typeof meta.tool === 'string' ? meta.tool : null;
      if (tool && (row.severity === 'critical' || row.severity === 'warning')) {
        toolCounts.set(tool, (toolCounts.get(tool) ?? 0) + 1);
      }
    }
    const suspiciousTools = [...toolCounts.entries()]
      .filter(([, count]) => count >= 2)
      .map(([tool]) => tool);
    const lastUnsafe = rows.find((r) => r.severity === 'critical' || r.severity === 'breach') ?? null;

    const shield = sessionId ? await getShieldMode(sessionId) : null;
    const restrictions = await listSurfaceRestrictions(instanceId, sessionId ?? undefined);
    const grants = sessionId ? await listSessionGrants(sessionId) : [];
    const riskScore = Math.min(100, blockedCount * 5 + suspiciousTools.length * 10
      + (shield?.mode === 'quarantine' ? 30 : shield?.mode === 'restrict' ? 20 : 0));

    const terminal = buildResponseTerminal({
      riskScore,
      shieldMode: shield?.mode ?? null,
      sessionId,
      blockedActions24h: blockedCount,
      suspiciousTools,
      restrictions,
      grants,
      lastUnsafeEvent: lastUnsafe
        ? {
          id: lastUnsafe.id,
          event_type: lastUnsafe.event_type,
          description: lastUnsafe.description,
          created_at: new Date(lastUnsafe.created_at).toISOString(),
          session_id: lastUnsafe.session_id,
        }
        : null,
    });

    const payload = buildDefenseConsole({
      shield,
      activePack: getAppliedPolicyPack(sessionId ?? undefined, instanceId),
      packs: listPolicyPacks(),
      grants,
      restrictions,
      remediationRules: getRemediationRules(),
      tripwireConfig: getTripwireConfig(),
      tripwireHits: await listRecentTripwireHits(20),
      terminal,
    });

    res.json(payload);
  } catch (err) {
    console.error('[dashboard] defense failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/agent-status', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const result = await pool.query<{
      id: string;
      name: string;
      status: string;
      suspension_reason: string | null;
      last_heartbeat: Date | null;
    }>(
      accountId
        ? `SELECT id, name, status, suspension_reason, last_heartbeat
           FROM carina_instances
           WHERE account_id = $1
           ORDER BY created_at ASC`
        : `SELECT id, name, status, suspension_reason, last_heartbeat
           FROM carina_instances
           ORDER BY created_at ASC`,
      accountId ? [accountId] : [],
    );
    res.json(buildAgentStatus(result.rows));
  } catch (err) {
    console.error('[dashboard] agent-status failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/threat-metrics', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const result = await pool.query<{
      severity: 'info' | 'warning' | 'critical' | 'breach';
      event_type: string;
      ip_address: string | null;
      instance_id: string | null;
      metadata: Record<string, unknown> | string | null;
      created_at: Date;
    }>(
      accountId
        ? `SELECT e.severity, e.event_type, e.ip_address, e.instance_id, e.metadata, e.created_at
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           WHERE i.account_id = $1
             AND e.created_at > NOW() - INTERVAL '24 hours'
           ORDER BY e.created_at DESC
           LIMIT 5000`
        : `SELECT severity, event_type, ip_address, instance_id, metadata, created_at
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '24 hours'
           ORDER BY created_at DESC
           LIMIT 5000`,
      accountId ? [accountId] : [],
    );
    res.json(buildThreatMetrics(result.rows));
  } catch (err) {
    console.error('[dashboard] threat-metrics failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/usage-analytics', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const result = await pool.query<{
      metadata: Record<string, unknown> | string | null;
      description: string | null;
    }>(
      accountId
        ? `SELECT e.metadata, e.description
           FROM security_events e
           JOIN carina_instances i ON i.id = e.instance_id
           WHERE i.account_id = $1
             AND e.created_at > NOW() - INTERVAL '24 hours'
             AND (e.event_type = 'tool_call'
                  OR e.event_type = 'session_metrics'
                  OR e.metadata ? 'tokens_used'
                  OR e.metadata ? 'total_tokens')`
        : `SELECT metadata, description
           FROM security_events
           WHERE created_at > NOW() - INTERVAL '24 hours'
             AND (event_type = 'tool_call'
                  OR event_type = 'session_metrics'
                  OR metadata ? 'tokens_used'
                  OR metadata ? 'total_tokens')`,
      accountId ? [accountId] : [],
    );
    res.json(buildUsageAnalytics(result.rows));
  } catch (err) {
    console.error('[dashboard] usage-analytics failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/audit-log', async (req: Request, res: Response): Promise<void> => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 120) : '';
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);

  try {
    const result = await searchAuditLog({
      query: query || undefined,
      per_page: limit,
      page: 1,
    });

    res.json({
      source: 'audit_log',
      label: 'Immutable admin and operator audit log',
      events: result.events.map((event) => ({
        id: event.id,
        tenant_id: event.tenant_id,
        event_type: event.event_type,
        action: event.action,
        detail: event.detail,
        severity: event.severity,
        session_id: event.session_id,
        ip_address: event.ip_address,
        admin_email: event.admin_email,
        created_at: event.timestamp,
      })),
      count: result.events.length,
      total: result.total,
    });
  } catch (err) {
    console.error('[dashboard] audit-log failed:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

dashboardRouter.get('/posture', async (req: Request, res: Response): Promise<void> => {
  const accountId = scopedAccountId(req);
  try {
    const [trust, agentRows, threatRows, incidentRows, rateRows, honeypotCount] = await Promise.all([
      buildPublicTrustFromDb(),
      pool.query<{
        id: string;
        name: string;
        status: string;
        suspension_reason: string | null;
        last_heartbeat: Date | null;
      }>(
        accountId
          ? `SELECT id, name, status, suspension_reason, last_heartbeat
             FROM carina_instances WHERE account_id = $1 ORDER BY created_at ASC`
          : `SELECT id, name, status, suspension_reason, last_heartbeat
             FROM carina_instances ORDER BY created_at ASC`,
        accountId ? [accountId] : [],
      ),
      pool.query<{
        severity: 'info' | 'warning' | 'critical' | 'breach';
        event_type: string;
        ip_address: string | null;
        instance_id: string | null;
        metadata: Record<string, unknown> | string | null;
        created_at: Date;
      }>(
        accountId
          ? `SELECT e.severity, e.event_type, e.ip_address, e.instance_id, e.metadata, e.created_at
             FROM security_events e
             JOIN carina_instances i ON i.id = e.instance_id
             WHERE i.account_id = $1 AND e.created_at > NOW() - INTERVAL '24 hours'
             ORDER BY e.created_at DESC LIMIT 5000`
          : `SELECT severity, event_type, ip_address, instance_id, metadata, created_at
             FROM security_events
             WHERE created_at > NOW() - INTERVAL '24 hours'
             ORDER BY created_at DESC LIMIT 5000`,
        accountId ? [accountId] : [],
      ),
      pool.query<{
        id: string;
        severity: string;
        event_type: string;
        acknowledged: boolean;
        acknowledged_at: Date | null;
        mitigated: boolean;
        created_at: Date;
      }>(
        accountId
          ? `SELECT e.id, e.severity, e.event_type, e.acknowledged, e.acknowledged_at, e.mitigated, e.created_at
             FROM security_events e
             JOIN carina_instances i ON i.id = e.instance_id
             WHERE i.account_id = $1
               AND e.created_at > NOW() - INTERVAL '24 hours'
               AND e.severity IN ('warning', 'critical', 'breach')`
          : `SELECT id, severity, event_type, acknowledged, acknowledged_at, mitigated, created_at
             FROM security_events
             WHERE created_at > NOW() - INTERVAL '24 hours'
               AND severity IN ('warning', 'critical', 'breach')`,
        accountId ? [accountId] : [],
      ),
      pool.query<{ recent: string; previous: string }>(
        accountId
          ? `SELECT
               COUNT(*) FILTER (WHERE e.created_at > NOW() - INTERVAL '24 hours')::text AS recent,
               COUNT(*) FILTER (
                 WHERE e.created_at <= NOW() - INTERVAL '24 hours'
                   AND e.created_at > NOW() - INTERVAL '48 hours'
               )::text AS previous
             FROM security_events e
             JOIN carina_instances i ON i.id = e.instance_id
             WHERE i.account_id = $1
               AND e.severity IN ('warning', 'critical', 'breach')`
          : `SELECT
               COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::text AS recent,
               COUNT(*) FILTER (
                 WHERE created_at <= NOW() - INTERVAL '24 hours'
                   AND created_at > NOW() - INTERVAL '48 hours'
               )::text AS previous
             FROM security_events
             WHERE severity IN ('warning', 'critical', 'breach')`,
        accountId ? [accountId] : [],
      ),
      pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM honeypots WHERE retired_at IS NULL`,
      ),
    ]);

    const agents = buildAgentStatus(agentRows.rows);
    const threats = buildThreatMetrics(threatRows.rows);
    const recent = parseInt(rateRows.rows[0]?.recent ?? '0', 10);
    const previous = parseInt(rateRows.rows[0]?.previous ?? '0', 10);
    const incidentRateChange = previous > 0
      ? Math.round(((recent - previous) / previous) * 100)
      : null;

    const incidents = buildIncidentOps(incidentRows.rows, {
      blocked_actions_24h: trust.metrics.blocked_24h,
      injection_blocks_24h: trust.metrics.injection_blocks_24h,
      incident_rate_change_pct: incidentRateChange,
    });

    const controlPlane = await buildControlPlaneHealth(honeypotCount.rows[0]?.count ?? '0');
    const trustHealth = await buildTrustHealthSummary(trust);

    const metricsInput = {
      agentsTotal: trust.monitoring.agents_protected,
      agentsActive: trust.monitoring.agents_active,
      agentsSuspended: trust.monitoring.agents_suspended,
      runtimeIncidents30d: trust.metrics.runtime_incidents_30d,
      warning24h: 0,
      breach30d: 0,
      eventsToday: trust.metrics.events_today,
      injectionBlocks24h: trust.metrics.injection_blocks_24h,
      blocked24h: trust.metrics.blocked_24h,
      threats24h: trust.metrics.threats_24h,
      lastEventAt: trust.monitoring.last_scan_at,
      lastHeartbeatAt: trust.monitoring.last_heartbeat_at,
    };

    res.json(buildPostureSummary({
      metrics: metricsInput,
      trust,
      agents,
      incidents,
      threats,
      controlPlane,
      trustHealth,
    }));
  } catch (err) {
    console.error('[dashboard] posture failed:', err);
    res.status(500).json({ error: 'Posture summary unavailable' });
  }
});

async function buildControlPlaneHealth(activeHoneypots: string): Promise<ControlPlaneHealth> {
  let databaseConnected = false;
  try {
    await pool.query('SELECT 1');
    databaseConnected = true;
  } catch {
    databaseConnected = false;
  }

  const redis = getRedis();
  let redisConnected = false;
  if (redis) {
    try {
      await redis.ping();
      redisConnected = true;
    } catch {
      redisConnected = false;
    }
  }

  const alertChannelCount = [
    config.alerts.telegram.botToken && config.alerts.telegram.chatId,
    config.alerts.email.resendApiKey && config.alerts.email.to,
    config.alerts.slack.webhookUrl,
    config.alerts.discord.webhookUrl,
  ].filter(Boolean).length;

  const killStatus = globalKillSwitch.getStatus();
  const securitySettings = await loadPlatformSecuritySettings();

  return {
    alert_channels_configured: alertChannelCount > 0,
    alert_channel_count: alertChannelCount,
    deception_enabled: parseInt(activeHoneypots, 10) > 0,
    egress_filter_enabled: securitySettings.egress_filter_enabled,
    egress_filter_source: securitySettings.egress_filter_source,
    sandbox_enabled: securitySettings.sandbox_enabled,
    sandbox_source: securitySettings.sandbox_source,
    redis_connected: redisConnected,
    database_connected: databaseConnected,
    sse_subscribers: getSseSubscriberCount(),
    kill_switch_armed: killStatus.armed,
    kill_switch_triggered: killStatus.triggered,
  };
}

async function buildTrustHealthSummary(trust: Awaited<ReturnType<typeof buildPublicTrustFromDb>>): Promise<TrustHealthSummary> {
  const [attestationRow, verificationRow] = await Promise.all([
    pool.query<{ submitted_at: Date }>(
      `SELECT submitted_at FROM trust_attestations
       WHERE status = 'submitted'
       ORDER BY submitted_at DESC LIMIT 1`,
    ),
    pool.query<{ submitted_at: Date; request_tx_hash: string | null; response_tx_hash: string | null }>(
      `SELECT submitted_at, request_tx_hash, response_tx_hash FROM trust_verifications
       WHERE status = 'submitted'
       ORDER BY submitted_at DESC LIMIT 1`,
    ),
  ]);

  const lastAttestation = attestationRow.rows[0]?.submitted_at
    ? new Date(attestationRow.rows[0].submitted_at).toISOString()
    : null;
  const lastVerification = verificationRow.rows[0]?.submitted_at
    ? new Date(verificationRow.rows[0].submitted_at).toISOString()
    : null;

  return {
    last_attestation_at: lastAttestation,
    last_attestation_age: lastAttestation
      ? formatAgeLabel(lastAttestation)
      : null,
    last_verification_at: lastVerification,
    last_verification_age: lastVerification
      ? formatAgeLabel(lastVerification)
      : null,
    erc8004_status: trust.chain.erc8004_status,
    erc8004_label: trust.chain.erc8004_label,
    erc8126_status: trust.chain.erc8126_status,
    erc8126_label: trust.chain.erc8126_label,
    wallet_configured: trust.chain.wallet_configured,
    on_chain_request_tx: verificationRow.rows[0]?.request_tx_hash ?? null,
    on_chain_response_tx: verificationRow.rows[0]?.response_tx_hash ?? null,
  };
}

function formatAgeLabel(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
