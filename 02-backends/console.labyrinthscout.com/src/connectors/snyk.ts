import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import { mapVendorSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class SnykConnector extends BaseConnector {
  id = 'snyk';
  name = 'Snyk';
  category = 'supply-chain' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent vulnerability findings to Snyk';

  configSchema: ConnectorConfigField[] = [
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      required: true,
      help: 'Snyk API token with issue write scope',
    },
    {
      key: 'orgId',
      label: 'Organization ID',
      type: 'text',
      required: true,
      help: 'Snyk organization to push findings to',
    },
  ];

  async health() {
    const probe = await probeReachable(`https://api.snyk.io/rest/orgs/${this.cfg('orgId')}`, {
      headers: {
        Authorization: `token ${this.cfg('apiToken')}`,
        Accept: 'application/vnd.api+json',
      },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    if (finding.type !== 'vulnerability') {
      return this.skipped();
    }

    const issue = {
      data: {
        type: 'issue',
        attributes: {
          title: `Scout: ${finding.title}`,
          description: finding.description,
          severity: mapVendorSeverity(this.id, finding.severity),
          classes: ['ai-agent-security'],
          coordinates: [{
            representations: ['.'],
            remedies: finding.remediation
              ? [{ description: finding.remediation, type: 'indeterminate' }]
              : [],
          }],
          custom: {
            scoutFindingId: finding.id,
            agentId: finding.agentId,
            mitreAttackIds: finding.mitreAttackIds,
          },
        },
      },
    };

    const { data } = await fetchJson<{ data?: { id?: string } }>(
      `https://api.snyk.io/rest/orgs/${this.cfg('orgId')}/issues`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${this.cfg('apiToken')}`,
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify(issue),
      },
    );

    const vendorId = data.data?.id ?? `snyk-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: `https://app.snyk.io/org/${this.cfg('orgId')}/issues/${vendorId}`,
      pushedAt: new Date().toISOString(),
    };
  }

  async pushAlert(alert: ScoutAlert): Promise<PushResult> {
    return this.skipped('skipped-alert');
  }
}
