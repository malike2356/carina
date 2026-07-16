import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class SocketConnector extends BaseConnector {
  id = 'socket';
  name = 'Socket.dev';
  category = 'supply-chain' as const;
  version = '1.0.0';
  description = 'Push Scout-detected suspicious packages to Socket.dev for supply chain blocking';

  configSchema: ConnectorConfigField[] = [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'orgSlug', label: 'Organization Slug', type: 'text', required: true },
  ];

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.cfg('apiKey')}:`).toString('base64')}`;
  }

  async health() {
    const probe = await probeReachable(`https://api.socket.dev/v0/orgs/${this.cfg('orgSlug')}`, {
      headers: { Authorization: this.authHeader() },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    if (!['tool_abuse', 'egress_violation'].includes(finding.type)) {
      return this.skipped();
    }

    const packageName = this.extractPackageName(finding);
    const { data } = await fetchJson<{ id?: string; reportUrl?: string }>(
      `https://api.socket.dev/v0/orgs/${this.cfg('orgSlug')}/report`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'ai_agent_alert',
          source: 'Scout',
          alert: {
            title: finding.title,
            description: finding.description,
            packages: packageName ? [{ name: packageName }] : [],
            metadata: {
              scoutFindingId: finding.id,
              agentId: finding.agentId,
              riskScore: finding.riskScore,
            },
          },
        }),
      },
    );

    const vendorId = data.id ?? `socket-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: data.reportUrl,
      pushedAt: new Date().toISOString(),
    };
  }

  async pushAlert(alert: ScoutAlert): Promise<PushResult> {
    return this.skipped('skipped-alert');
  }

  private extractPackageName(finding: ScoutFinding): string | null {
    const toolCall = finding.evidence?.toolCall;
    if (!toolCall) return null;
    const match = toolCall.match(/(?:npm install|pip install|yarn add|pnpm add)\s+(\S+)/);
    return match?.[1] ?? null;
  }
}
