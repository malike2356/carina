import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import { mapVendorSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
}

export class DefenderConnector extends BaseConnector {
  id = 'defender';
  name = 'Microsoft Defender';
  category = 'siem' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent findings to Microsoft 365 Defender';

  configSchema: ConnectorConfigField[] = [
    { key: 'tenantId', label: 'Azure Tenant ID', type: 'text', required: true },
    { key: 'clientId', label: 'App Registration Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
  ];

  private token: string | null = null;
  private tokenExpiresAt = 0;

  async health() {
    const probe = await probeReachable('https://api.security.microsoft.com/api/alerts?$top=1', {
      headers: { Authorization: `Bearer ${await this.getToken()}` },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const token = await this.getToken();
    const alert = {
      title: `Scout AI Agent: ${finding.title}`,
      category: 'AI Agent Security',
      severity: mapVendorSeverity(this.id, finding.severity),
      description: finding.description,
      sourceMaterials: [finding.type],
      mitreTechniques: finding.mitreAttackIds,
      entities: this.buildEntities(finding),
      evidence: finding.evidence,
    };

    const { data } = await fetchJson<{ id?: string }>(
      'https://api.security.microsoft.com/api/alerts',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert),
      },
    );

    const vendorId = data.id ?? `defender-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: `https://security.microsoft.com/alerts/${vendorId}`,
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

  private buildEntities(finding: ScoutFinding): Array<Record<string, unknown>> {
    const entities: Array<Record<string, unknown>> = [];
    if (finding.evidence?.sourceIp) {
      entities.push({
        '@odata.type': '#microsoft.graph.security.ipEvidence',
        ipAddress: finding.evidence.sourceIp,
      });
    }
    entities.push({
      '@odata.type': '#microsoft.graph.security.cloudApplicationEvidence',
      appId: finding.agentId,
      displayName: finding.agentName,
    });
    return entities;
  }

  private async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt) {
      return this.token;
    }

    const tenantId = this.cfg('tenantId');
    const body = new URLSearchParams({
      client_id: this.cfg('clientId'),
      client_secret: this.cfg('clientSecret'),
      scope: 'https://api.security.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const { data } = await fetchJson<OAuthTokenResponse>(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
    );

    if (!data.access_token) {
      throw new Error('Microsoft Defender OAuth token missing access_token');
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
