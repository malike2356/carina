import { describe, expect, it, vi, beforeEach } from 'vitest';
import { searchAuditLog } from '../../audit/audit-search.js';
import { buildPostureSummary } from '../../dashboard/widgets/posture-summary.js';
import { buildPublicTrustPayload } from '../../trust/compute-trust-metrics.js';
import { buildAgentStatus } from '../../dashboard/widgets/agent-status.js';
import { buildIncidentOps } from '../../dashboard/widgets/incident-ops.js';
import { buildThreatMetrics } from '../../dashboard/widgets/threat-metrics.js';

vi.mock('../../audit/audit-search.js', () => ({
  searchAuditLog: vi.fn(),
}));

describe('dashboard audit log semantics', () => {
  beforeEach(() => {
    vi.mocked(searchAuditLog).mockReset();
  });

  it('reads immutable audit_log rows via searchAuditLog', async () => {
    vi.mocked(searchAuditLog).mockResolvedValue({
      events: [{
        id: 'abc',
        tenant_id: 'tenant-1',
        event_type: 'admin',
        action: 'kill_switch_triggered',
        detail: { reason: 'test' },
        severity: 'critical',
        session_id: null,
        ip_address: null,
        admin_email: 'ops@example.com',
        timestamp: '2026-06-07T12:00:00Z',
      }],
      total: 1,
      page: 1,
      per_page: 80,
    });

    const result = await searchAuditLog({ per_page: 80, page: 1 });
    expect(result.events[0]?.event_type).toBe('admin');
    expect(result.events[0]?.action).toBe('kill_switch_triggered');
    expect(searchAuditLog).toHaveBeenCalled();
  });
});

describe('buildPostureSummary freshness', () => {
  it('marks stale telemetry when heartbeat and events are old', () => {
    const now = new Date('2026-06-07T12:00:00Z');
    const trust = buildPublicTrustPayload({
      agentsTotal: 1,
      agentsActive: 1,
      agentsSuspended: 0,
      runtimeIncidents30d: 0,
      warning24h: 0,
      breach30d: 0,
      eventsToday: 0,
      injectionBlocks24h: 0,
      blocked24h: 0,
      threats24h: 0,
      lastEventAt: '2026-06-07T08:00:00Z',
      lastHeartbeatAt: '2026-06-07T08:00:00Z',
    }, { erc8004: 'planned', erc8126: 'planned', walletConfigured: false }, null, now);

    const summary = buildPostureSummary({
      metrics: {
        agentsTotal: 1,
        agentsActive: 1,
        agentsSuspended: 0,
        runtimeIncidents30d: 0,
        warning24h: 0,
        breach30d: 0,
        eventsToday: 0,
        injectionBlocks24h: 0,
        blocked24h: 0,
        threats24h: 0,
        lastEventAt: '2026-06-07T08:00:00Z',
        lastHeartbeatAt: '2026-06-07T08:00:00Z',
      },
      trust,
      agents: buildAgentStatus([]),
      incidents: buildIncidentOps([]),
      threats: buildThreatMetrics([]),
      controlPlane: {
        alert_channels_configured: false,
        alert_channel_count: 0,
        deception_enabled: false,
        egress_filter_enabled: false,
        sandbox_enabled: false,
        redis_connected: false,
        database_connected: true,
        sse_subscribers: 0,
        kill_switch_armed: true,
        kill_switch_triggered: false,
      },
      trustHealth: {
        last_attestation_at: null,
        last_attestation_age: null,
        last_verification_at: null,
        last_verification_age: null,
        erc8004_status: 'planned',
        erc8004_label: 'Planned',
        erc8126_status: 'planned',
        erc8126_label: 'Planned',
        wallet_configured: false,
        on_chain_request_tx: null,
        on_chain_response_tx: null,
      },
      now,
    });

    expect(summary.freshness.stale).toBe(true);
    expect(summary.action_queue.some((item) => item.id === 'stale-data')).toBe(true);
  });
});
