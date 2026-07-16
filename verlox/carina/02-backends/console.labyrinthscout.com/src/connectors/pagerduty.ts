import { BaseConnector } from './base-connector.js';
import { fetchJson } from './http.js';
import { mapVendorSeverity, meetsMinSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding, ScoutFindingSeverity } from './types.js';

export class PagerDutyConnector extends BaseConnector {
  id = 'pagerduty';
  name = 'PagerDuty';
  category = 'soar' as const;
  version = '1.0.0';
  description = 'Trigger PagerDuty incidents for critical Scout findings';

  configSchema: ConnectorConfigField[] = [
    {
      key: 'routingKey',
      label: 'Routing Key',
      type: 'password',
      required: true,
      help: 'PagerDuty integration key (Events API v2)',
    },
    {
      key: 'minSeverity',
      label: 'Minimum Severity',
      type: 'select',
      required: true,
      options: [
        { label: 'Critical only', value: 'critical' },
        { label: 'High and above', value: 'high' },
        { label: 'Medium and above', value: 'medium' },
      ],
      default: 'high',
      help: 'Only trigger PagerDuty for findings at or above this severity',
    },
  ];

  private get apiUrl(): string {
    return 'https://events.pagerduty.com/v2/enqueue';
  }

  async health() {
    const started = Date.now();
    try {
      await fetchJson(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routing_key: this.cfg('routingKey'),
          event_action: 'trigger',
          dedup_key: `scout-health-${Date.now()}`,
          payload: {
            summary: 'Scout connector health check',
            source: 'Scout',
            severity: 'info',
          },
        }),
      });
      return this.healthResult({ ok: true, latencyMs: Date.now() - started });
    } catch (err) {
      return this.healthResult({
        ok: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const minSeverity = this.cfg('minSeverity', 'high') as ScoutFindingSeverity;
    if (!meetsMinSeverity(finding.severity, minSeverity)) {
      return this.skipped('skipped-severity');
    }

    const payload = {
      routing_key: this.cfg('routingKey'),
      event_action: 'trigger',
      dedup_key: `scout-${finding.id}`,
      payload: {
        summary: `[Scout] ${finding.title}`,
        source: `Scout AI Agent: ${finding.agentName || finding.agentId}`,
        severity: mapVendorSeverity(this.id, finding.severity),
        timestamp: finding.timestamp,
        component: finding.agentId,
        group: 'ai-agent-security',
        class: finding.type,
        custom_details: {
          scoutFindingId: finding.id,
          sessionId: finding.sessionId,
          riskScore: finding.riskScore,
          mitreAttackIds: finding.mitreAttackIds,
          description: finding.description,
          remediation: finding.remediation,
        },
      },
      links: [{
        href: `https://console.labyrinthscout.com/findings/${finding.id}`,
        text: 'View in Scout Console',
      }],
    };

    const { data } = await fetchJson<{ dedup_key?: string }>(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const vendorId = data.dedup_key ?? `scout-${finding.id}`;
    return {
      ok: true,
      vendorId,
      pushedAt: new Date().toISOString(),
    };
  }

  async pushAlert(alert: ScoutAlert): Promise<PushResult> {
    return this.pushFinding({
      id: alert.findingId,
      type: 'anomaly_spike',
      severity: alert.severity,
      title: alert.title,
      description: alert.message,
      agentId: 'scout-alert',
      agentName: 'Scout Alert',
      sessionId: 'system',
      timestamp: alert.timestamp,
      mitreAttackIds: [],
      riskScore: 90,
      accountId: 'system',
    });
  }

  async resolveIncident(scoutFindingId: string): Promise<void> {
    await fetchJson(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        routing_key: this.cfg('routingKey'),
        event_action: 'resolve',
        dedup_key: `scout-${scoutFindingId}`,
      }),
    });
  }
}
