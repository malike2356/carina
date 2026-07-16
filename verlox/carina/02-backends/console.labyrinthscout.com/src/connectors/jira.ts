import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class JiraConnector extends BaseConnector {
  id = 'jira';
  name = 'Jira';
  category = 'ticketing' as const;
  version = '1.0.0';
  description = 'Create Jira issues from Scout AI agent security findings';

  configSchema: ConnectorConfigField[] = [
    { key: 'email', label: 'Atlassian Email', type: 'text', required: true },
    {
      key: 'apiToken',
      label: 'API Token',
      type: 'password',
      required: true,
      help: 'Generate at https://id.atlassian.com/manage-profile/security/api-tokens',
    },
    {
      key: 'baseUrl',
      label: 'Instance URL',
      type: 'url',
      required: true,
      placeholder: 'https://your-company.atlassian.net',
    },
    {
      key: 'projectKey',
      label: 'Project Key',
      type: 'text',
      required: true,
      help: 'Jira project key (e.g., SEC, SCOUT)',
    },
    {
      key: 'issueType',
      label: 'Issue Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Bug', value: 'Bug' },
        { label: 'Task', value: 'Task' },
        { label: 'Security Incident', value: 'Security Incident' },
        { label: 'Story', value: 'Story' },
      ],
      default: 'Security Incident',
    },
  ];

  private get baseUrl(): string {
    return this.cfg('baseUrl').replace(/\/+$/, '');
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.cfg('email')}:${this.cfg('apiToken')}`).toString('base64')}`;
  }

  async health() {
    const probe = await probeReachable(`${this.baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: this.authHeader() },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const issue = {
      fields: {
        project: { key: this.cfg('projectKey') },
        summary: `[Scout] ${finding.title}`,
        issuetype: { name: this.cfg('issueType', 'Security Incident') },
        description: this.buildDescription(finding),
        priority: { name: this.mapPriority(finding.severity) },
        labels: ['scout', 'ai-agent-security', finding.type],
      },
    };

    const { data } = await fetchJson<{ key?: string }>(`${this.baseUrl}/rest/api/3/issue`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issue),
    });

    const vendorId = data.key ?? `jira-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: `${this.baseUrl}/browse/${vendorId}`,
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

  private buildDescription(finding: ScoutFinding): string {
    return [
      'h2. Scout AI Agent Finding',
      '',
      `*Type:* ${finding.type}`,
      `*Severity:* ${finding.severity}`,
      `*Agent:* ${finding.agentName || finding.agentId}`,
      `*Risk Score:* ${finding.riskScore}/100`,
      `*Timestamp:* ${finding.timestamp}`,
      '',
      'h3. Description',
      finding.description,
      '',
      'h3. MITRE ATT&CK',
      ...finding.mitreAttackIds.map((id) => `* ${id}`),
      '',
      'h3. Evidence',
      '{code:json}',
      JSON.stringify(finding.evidence || {}, null, 2),
      '{code}',
      '',
      'h3. Remediation',
      finding.remediation || 'Review in Scout console',
      '',
      `_Submitted by Labyrinth Scout | Finding ID: ${finding.id}_`,
    ].join('\n');
  }

  private mapPriority(severity: string): string {
    return {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      info: 'Lowest',
    }[severity] || 'Medium';
  }
}
