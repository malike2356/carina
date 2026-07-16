import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import { mapVendorSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class CrowdStrikeConnector extends BaseConnector {
  id = 'crowdstrike';
  name = 'CrowdStrike Falcon';
  category = 'edr' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent threats to CrowdStrike Falcon Event Streams';

  configSchema: ConnectorConfigField[] = [
    {
      key: 'clientId',
      label: 'Client ID',
      type: 'text',
      required: true,
      help: 'CrowdStrike API client ID with Event Streams write',
    },
    {
      key: 'clientSecret',
      label: 'Client Secret',
      type: 'password',
      required: true,
    },
    {
      key: 'baseUrl',
      label: 'API Base URL',
      type: 'url',
      required: true,
      default: 'https://api.crowdstrike.com',
      help: 'Use api.us-2.crowdstrike.com for US-2 tenants',
    },
  ];

  private token: string | null = null;
  private tokenExpiresAt = 0;

  private get apiBase(): string {
    return this.cfg('baseUrl', 'https://api.crowdstrike.com').replace(/\/+$/, '');
  }

  async health() {
    const probe = await probeReachable(`${this.apiBase}/sensors/queries/sensors/v1`, {
      headers: { Authorization: `Bearer ${await this.getToken()}` },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const token = await this.getToken();
    const ioa = {
      name: `Scout: ${finding.title}`,
      description: finding.description,
      platform: 'all',
      severity: mapVendorSeverity(this.id, finding.severity),
      action: 'detect',
      pattern: `(ai_agent_name="${finding.agentId}" AND scout_risk_score>=${finding.riskScore})`,
      mitre_techniques: finding.mitreAttackIds,
    };

    const { data } = await fetchJson<{ resources?: Array<{ id?: string }> }>(
      `${this.apiBase}/custom-ioa/entities/rules/v1`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(ioa),
      },
    );

    const vendorId = data.resources?.[0]?.id ?? `crowdstrike-${finding.id}`;
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

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const body = new URLSearchParams({
      client_id: this.cfg('clientId'),
      client_secret: this.cfg('clientSecret'),
      grant_type: 'client_credentials',
    });

    const { data } = await fetchJson<OAuthTokenResponse>(`${this.apiBase}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!data.access_token) {
      throw new Error('CrowdStrike OAuth token missing access_token');
    }

    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + ((data.expires_in ?? 1800) - 60) * 1000;
    return this.token;
  }

  override async shutdown(): Promise<void> {
    this.token = null;
    this.tokenExpiresAt = 0;
    await super.shutdown();
  }
}
