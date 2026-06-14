import { pool } from '../db.js';
import { config } from '../config/index.js';
import { getRedis } from '../redis.js';
import { globalKillSwitch } from '../killswitch/global-kill-switch.js';
import { buildPublicTrustFromDb } from '../trust/build-public-trust.js';
import { buildAgentStatus } from '../dashboard/widgets/agent-status.js';
import { buildIncidentOps } from '../dashboard/widgets/incident-ops.js';
import { loadPlatformSecuritySettings } from '../lib/platform-settings.js';
import { getAppliedPolicyPack } from '../security/policy-packs.js';
import { fetchApprovalStats } from '../lib/pending-approvals.js';
import { getActiveIndustryTemplateSummary } from '../lib/industry-template-store.js';
import type { IndustryTemplateId } from './industry-templates.js';
import { classifyRegulatoryRisk } from './regulatory-classification.js';
import { scoreFrameworks, type FrameworkScoreDetail } from './framework-scorer.js';

export interface GovernancePosture {
  generated_at: string;
  eu_ai_act: {
    tier: string;
    tier_label: string;
    gaps: string[];
    article_refs: string[];
    reasoning: string[];
  };
  uk_dsit: {
    alignment: string;
    alignment_label: string;
    principles_met: string[];
    principles_partial: string[];
  };
  frameworks: {
    eu_ai_act_readiness: number;
    gdpr_readiness: number;
    soc2_readiness: number;
    iso42001_readiness: number;
  };
  governance_score: number;
  governance_label: string;
  attestations: Array<{
    attested_at: string;
    chain: string;
    tx_hash: string | null;
    risk_score_at_attestation: number | null;
  }>;
  action_items: FrameworkScoreDetail['action_items'];
  agents: {
    total: number;
    governed: number;
    identified: number;
    compliant: number;
    rows: Array<{
      id: string;
      status: string;
      identified: boolean;
      incidents: number;
    }>;
  };
  human_oversight: {
    enabled: boolean;
    last_exercised: string | null;
    response_time_secs: number | null;
    approval_workflow_active: boolean;
    pending_approvals: number;
  };
  approval_stats: Awaited<ReturnType<typeof fetchApprovalStats>>;
  active_industry_template: {
    id: IndustryTemplateId;
    label: string;
    sector: string;
    regulations: string[];
    human_review_required_for: string[];
  } | null;
}

function chainLabel(chainId: number | string | null): string {
  if (chainId === 8453 || chainId === '8453') return 'base';
  if (chainId === 1 || chainId === '1') return 'ethereum';
  return chainId != null ? String(chainId) : 'unknown';
}

export async function buildGovernancePosture(accountId?: string): Promise<GovernancePosture> {
  const now = new Date();

  const [
    trust,
    agentRows,
    audit7d,
    audit24h,
    telemetryDays,
    attestationRows,
    killEventRow,
    approvalStats,
    incidentRows,
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
      accountId
        ? `SELECT id, name, status, suspension_reason, last_heartbeat FROM carina_instances WHERE account_id = $1 ORDER BY created_at ASC`
        : `SELECT id, name, status, suspension_reason, last_heartbeat FROM carina_instances ORDER BY created_at ASC`,
      accountId ? [accountId] : [],
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM security_events WHERE created_at > NOW() - INTERVAL '7 days'`,
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM security_events WHERE created_at > NOW() - INTERVAL '24 hours'`,
    ),
    pool.query<{ days: string }>(
      `SELECT GREATEST(1, EXTRACT(EPOCH FROM (NOW() - MIN(created_at))) / 86400)::int::text AS days
       FROM security_events`,
    ).catch(() => ({ rows: [{ days: '1' }] })),
    pool.query<{
      submitted_at: Date;
      chain_id: number;
      tx_hash: string;
      score: number;
    }>(
      `SELECT submitted_at, chain_id, tx_hash, score
       FROM trust_attestations
       ORDER BY submitted_at DESC
       LIMIT 5`,
    ).catch(() => ({ rows: [] })),
    pool.query<{ created_at: Date; metadata: Record<string, unknown> | null }>(
      `SELECT created_at, metadata FROM security_events
       WHERE event_type IN ('kill_switch_activated', 'kill_switch_triggered')
       ORDER BY created_at DESC LIMIT 1`,
    ).catch(() => ({ rows: [] })),
    fetchApprovalStats(),
    pool.query<{
      instance_id: string | null;
      severity: string;
      acknowledged: boolean;
      mitigated: boolean;
    }>(
      `SELECT instance_id, severity, acknowledged, mitigated
       FROM security_events
       WHERE created_at > NOW() - INTERVAL '30 days'
         AND severity IN ('critical', 'breach')`,
    ),
    loadPlatformSecuritySettings(),
  ]);

  const agents = buildAgentStatus(agentRows.rows);
  const killStatus = globalKillSwitch.getStatus();
  const incidents = buildIncidentOps(
    incidentRows.rows.map((row, idx) => ({
      id: `gov-${idx}`,
      severity: row.severity,
      event_type: 'incident',
      acknowledged: row.acknowledged,
      acknowledged_at: null,
      mitigated: row.mitigated,
      created_at: now.toISOString(),
    })),
  );

  const breach24h = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM security_events
     WHERE severity = 'breach' AND created_at > NOW() - INTERVAL '24 hours'`,
  ).catch(() => ({ rows: [{ count: '0' }] }));

  const lastAttestation = attestationRows.rows[0]?.submitted_at
    ? new Date(attestationRows.rows[0].submitted_at).toISOString()
    : null;

  const attestationDays = lastAttestation
    ? Math.floor((now.getTime() - new Date(lastAttestation).getTime()) / 86_400_000)
    : null;

  const alertChannelCount = [
    config.alerts.telegram.botToken && config.alerts.telegram.chatId,
    config.alerts.email.resendApiKey && config.alerts.email.to,
    config.alerts.slack.webhookUrl,
    config.alerts.discord.webhookUrl,
  ].filter(Boolean).length;

  const regulatory = classifyRegulatoryRisk({
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
    telemetry_days: parseInt(telemetryDays.rows[0]?.days ?? '1', 10),
  }, now);

  const heartbeatWithin24h = agentRows.rows.some((row) => {
    if (!row.last_heartbeat) return false;
    return now.getTime() - new Date(row.last_heartbeat).getTime() <= 86_400_000;
  });

  const heartbeatWithin1h = agentRows.rows.some((row) => {
    if (!row.last_heartbeat) return false;
    return now.getTime() - new Date(row.last_heartbeat).getTime() <= 3_600_000;
  });

  const appliedPack = getAppliedPolicyPack(undefined, 'default');
  const frameworkDetail = scoreFrameworks({
    audit_log_active_7d: parseInt(audit7d.rows[0]?.count ?? '0', 10) > 0,
    audit_log_active_24h: parseInt(audit24h.rows[0]?.count ?? '0', 10) > 0,
    kill_switch_armed: killStatus.armed,
    last_attestation_within_60d: attestationDays !== null && attestationDays <= 60,
    erc8004_live: trust.chain.erc8004_status === 'live',
    heartbeat_within_24h: heartbeatWithin24h,
    heartbeat_within_1h: heartbeatWithin1h,
    alert_channels_configured: alertChannelCount > 0,
    retention_configured: true,
    policy_pack_not_observe: appliedPack != null && appliedPack.packId !== 'observe',
    risk_score_documented: trust.risk_score >= 0,
    incidents_table_has_rows: incidentRows.rows.length > 0,
    approval_workflow_active: approvalStats.workflow_active,
  }, regulatory);

  const identified = trust.chain.erc8004_status === 'live';
  const incidentCountByInstance = new Map<string, number>();
  for (const row of incidentRows.rows) {
    if (!row.instance_id || row.acknowledged || row.mitigated) continue;
    incidentCountByInstance.set(
      row.instance_id,
      (incidentCountByInstance.get(row.instance_id) ?? 0) + 1,
    );
  }

  const agentTableRows = agentRows.rows.map((row) => {
    const rowGoverned = row.last_heartbeat != null
      && now.getTime() - new Date(row.last_heartbeat).getTime() <= 86_400_000;
    const openIncidents = incidentCountByInstance.get(row.id) ?? 0;
    const rowCompliant = rowGoverned && identified && openIncidents === 0;
    return {
      id: row.id,
      status: row.status,
      identified,
      incidents: openIncidents,
      governed: rowGoverned,
      compliant: rowCompliant,
    };
  });

  const governed = agentTableRows.filter((row) => row.governed).length;
  const compliant = agentTableRows.filter((row) => row.compliant).length;

  const killMeta = killEventRow.rows[0]?.metadata;
  const responseTimeSecs = killMeta && typeof killMeta.duration_ms === 'number'
    ? Math.round(killMeta.duration_ms / 1000)
    : killMeta && typeof killMeta.stop_duration_ms === 'number'
      ? Math.round(killMeta.stop_duration_ms / 1000)
      : null;

  void getRedis();

  const activeIndustryTemplate = await getActiveIndustryTemplateSummary(undefined, 'default');

  return {
    generated_at: now.toISOString(),
    eu_ai_act: {
      tier: regulatory.eu_ai_act.tier,
      tier_label: regulatory.eu_ai_act.tier_label,
      gaps: regulatory.eu_ai_act.gaps,
      article_refs: regulatory.eu_ai_act.article_refs,
      reasoning: regulatory.eu_ai_act.reasoning,
    },
    uk_dsit: regulatory.uk_dsit,
    frameworks: {
      eu_ai_act_readiness: frameworkDetail.eu_ai_act_readiness,
      gdpr_readiness: frameworkDetail.gdpr_readiness,
      soc2_readiness: frameworkDetail.soc2_readiness,
      iso42001_readiness: frameworkDetail.iso42001_readiness,
    },
    governance_score: frameworkDetail.governance_score,
    governance_label: frameworkDetail.governance_label,
    attestations: attestationRows.rows.map((row) => ({
      attested_at: new Date(row.submitted_at).toISOString(),
      chain: chainLabel(row.chain_id),
      tx_hash: row.tx_hash ?? null,
      risk_score_at_attestation: row.score ?? null,
    })),
    action_items: frameworkDetail.action_items,
    agents: {
      total: agents.total,
      governed,
      identified: identified ? agents.total : 0,
      compliant,
      rows: agentTableRows.map(({ id, status, identified: idOk, incidents }) => ({
        id,
        status,
        identified: idOk,
        incidents,
      })),
    },
    human_oversight: {
      enabled: killStatus.armed || approvalStats.workflow_active,
      last_exercised: killEventRow.rows[0]
        ? new Date(killEventRow.rows[0].created_at).toISOString()
        : null,
      response_time_secs: responseTimeSecs,
      approval_workflow_active: approvalStats.workflow_active,
      pending_approvals: approvalStats.pending_count,
    },
    approval_stats: approvalStats,
    active_industry_template: activeIndustryTemplate,
  };
}
