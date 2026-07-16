import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import { mapVendorSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class SentinelOneConnector extends BaseConnector {
  id = 'sentinelone';
  name = 'SentinelOne';
  category = 'siem' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent security findings to SentinelOne Deep Visibility';

  configSchema: ConnectorConfigField[] = [
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      required: true,
      help: 'SentinelOne API token with Deep Visibility write scope',
    },
    {
      key: 'tenantUrl',
      label: 'Tenant URL',
      type: 'url',
      required: true,
      placeholder: 'https://your-tenant.sentinelone.net',
      help: 'Your SentinelOne management console URL',
    },
    {
      key: 'siteId',
      label: 'Site ID (optional)',
      type: 'text',
      required: false,
      help: 'Scope to a specific site. Leave empty for account-wide.',
    },
  ];

  private get baseUrl(): string {
    return this.cfg('tenantUrl').replace(/\/+$/, '');
  }

  async health() {
    const probe = await probeReachable(`${this.baseUrl}/web/api/v2.1/system/status`, {
      headers: { Authorization: `ApiToken ${this.cfg('apiToken')}` },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const threat = {
      data: {
        source: 'Scout',
        threatName: `Scout: ${finding.title}`,
        severity: mapVendorSeverity(this.id, finding.severity),
        detectionType: 'dynamic',
        agentDetectionInfo: {
          agentId: finding.agentId,
          sessionId: finding.sessionId,
        },
        mitreAttackIds: finding.mitreAttackIds,
        description: finding.description,
        indicators: this.buildIndicators(finding),
        customFields: {
          scoutFindingId: finding.id,
          scoutRiskScore: finding.riskScore,
          scoutScore: finding.scoutScore,
        },
        ...(this.cfg('siteId') ? { siteId: this.cfg('siteId') } : {}),
      },
    };

    const { data } = await fetchJson<{ data?: { id?: string } }>(
      `${this.baseUrl}/web/api/v2.1/deep-visibility/v2/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `ApiToken ${this.cfg('apiToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(threat),
      },
    );

    const vendorId = data.data?.id ?? `sentinelone-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: `${this.baseUrl}/incidents/${vendorId}`,
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

  private buildIndicators(finding: ScoutFinding): Array<Record<string, unknown>> {
    const indicators: Array<Record<string, unknown>> = [];
    if (finding.evidence?.sourceIp) {
      indicators.push({ type: 'ip', value: finding.evidence.sourceIp });
    }
    if (finding.type === 'honeypot_triggered' && finding.evidence?.prompt) {
      indicators.push({ type: 'url', value: finding.evidence.prompt.slice(0, 200) });
    }
    return indicators;
  }
}
