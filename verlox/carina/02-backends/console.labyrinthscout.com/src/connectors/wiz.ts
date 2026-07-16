import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import { mapVendorSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class WizConnector extends BaseConnector {
  id = 'wiz';
  name = 'Wiz';
  category = 'cloud' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent security findings to Wiz Security Graph';

  configSchema: ConnectorConfigField[] = [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    {
      key: 'apiEndpoint',
      label: 'API Endpoint',
      type: 'url',
      required: true,
      default: 'https://api.us1.app.wiz.io/graphql',
    },
    {
      key: 'authEndpoint',
      label: 'Auth Endpoint',
      type: 'url',
      required: false,
      default: 'https://auth.app.wiz.io/oauth/token',
    },
  ];

  private token: string | null = null;
  private tokenExpiresAt = 0;

  async health() {
    const probe = await probeReachable(this.cfg('apiEndpoint'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const mutation = `
      mutation CreateFinding($input: CreateFindingInput!) {
        createFinding(input: $input) {
          finding { id }
        }
      }
    `;

    const input = {
      name: `Scout AI Agent: ${finding.title}`,
      severity: mapVendorSeverity(this.id, finding.severity),
      description: finding.description,
      resource: {
        externalId: finding.agentId,
        name: finding.agentName || `Agent ${finding.agentId}`,
        type: 'AI_AGENT',
      },
      riskScore: finding.riskScore,
      mitreTactics: finding.mitreAttackIds,
      metadata: {
        scoutFindingId: finding.id,
        findingType: finding.type,
        sessionId: finding.sessionId,
        ...finding.evidence,
      },
      remediation: finding.remediation || 'Review Scout console for details',
    };

    const { data } = await fetchJson<{
      data?: { createFinding?: { finding?: { id?: string } } };
    }>(this.cfg('apiEndpoint'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.getToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: mutation, variables: { input } }),
    });

    const vendorId = data.data?.createFinding?.finding?.id ?? `wiz-${finding.id}`;
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
      grant_type: 'client_credentials',
      client_id: this.cfg('clientId'),
      client_secret: this.cfg('clientSecret'),
      audience: 'wiz-api',
    });

    const { data } = await fetchJson<OAuthTokenResponse>(
      this.cfg('authEndpoint', 'https://auth.app.wiz.io/oauth/token'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    if (!data.access_token) {
      throw new Error('Wiz OAuth token missing access_token');
    }

    this.token = data.access_token;
    this.tokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) - 60) * 1000;
    return this.token;
  }

  override async shutdown(): Promise<void> {
    this.token = null;
    this.tokenExpiresAt = 0;
    await super.shutdown();
  }
}
