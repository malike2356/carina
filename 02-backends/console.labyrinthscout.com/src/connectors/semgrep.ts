import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import { mapVendorSeverity } from './severity-map.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class SemgrepConnector extends BaseConnector {
  id = 'semgrep';
  name = 'Semgrep';
  category = 'supply-chain' as const;
  version = '1.0.0';
  description = 'Push Scout code vulnerability findings to Semgrep as custom rules';

  configSchema: ConnectorConfigField[] = [
    { key: 'apiToken', label: 'API Token', type: 'password', required: true },
    { key: 'deploymentSlug', label: 'Deployment Slug', type: 'text', required: true },
  ];

  async health() {
    const probe = await probeReachable(
      `https://semgrep.dev/api/v1/deployments/${this.cfg('deploymentSlug')}`,
      { headers: { Authorization: `Bearer ${this.cfg('apiToken')}` } },
    );
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    if (finding.type !== 'vulnerability') {
      return this.skipped();
    }

    const rule = this.findingToSemgrepRule(finding);
    const { data } = await fetchJson<{ id?: string }>(
      `https://semgrep.dev/api/v1/deployments/${this.cfg('deploymentSlug')}/rules`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.cfg('apiToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rule),
      },
    );

    const vendorId = data.id ?? `semgrep-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: `https://semgrep.dev/orgs/${this.cfg('deploymentSlug')}/rules/${vendorId}`,
      pushedAt: new Date().toISOString(),
    };
  }

  async pushAlert(alert: ScoutAlert): Promise<PushResult> {
    return this.skipped('skipped-alert');
  }

  private findingToSemgrepRule(finding: ScoutFinding): Record<string, unknown> {
    return {
      rule: {
        id: `scout.${finding.id.slice(0, 8)}`,
        message: finding.title,
        severity: mapVendorSeverity(this.id, finding.severity).toUpperCase(),
        languages: ['generic'],
        patterns: [{
          pattern: finding.evidence?.prompt || finding.description,
        }],
        metadata: {
          category: 'ai-agent-security',
          source: 'Scout',
          scoutFindingId: finding.id,
          mitreAttackIds: finding.mitreAttackIds,
          remediation: finding.remediation,
        },
      },
      rulesetName: 'Scout AI Agent Detections',
    };
  }
}
