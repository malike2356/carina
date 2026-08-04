import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class ServiceNowConnector extends BaseConnector {
  id = 'servicenow';
  name = 'ServiceNow';
  category = 'ticketing' as const;
  version = '1.0.0';
  description = 'Create ServiceNow incidents from Scout AI agent security findings';

  configSchema: ConnectorConfigField[] = [
    {
      key: 'instanceUrl',
      label: 'Instance URL',
      type: 'url',
      required: true,
      placeholder: 'https://dev12345.service-now.com',
    },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    {
      key: 'assignmentGroup',
      label: 'Assignment Group (sys_id)',
      type: 'text',
      required: false,
      help: 'ServiceNow group to auto-assign incidents',
    },
  ];

  private get instanceUrl(): string {
    return this.cfg('instanceUrl').replace(/\/+$/, '');
  }

  private authHeader(): string {
    return `Basic ${Buffer.from(`${this.cfg('username')}:${this.cfg('password')}`).toString('base64')}`;
  }

  async health() {
    const probe = await probeReachable(`${this.instanceUrl}/api/now/table/sys_user?sysparm_limit=1`, {
      headers: { Authorization: this.authHeader() },
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const incident = {
      short_description: `[Scout] ${finding.title}`,
      description: this.buildDescription(finding),
      severity: this.mapSeverityToNumber(finding.severity),
      urgency: this.mapSeverityToNumber(finding.severity),
      impact: finding.severity === 'critical' ? 1 : 2,
      category: 'AI Agent Security',
      subcategory: finding.type,
      ...(this.cfg('assignmentGroup') ? { assignment_group: this.cfg('assignmentGroup') } : {}),
      u_scout_finding_id: finding.id,
      u_agent_id: finding.agentId,
      u_risk_score: finding.riskScore,
      u_mitre_techniques: finding.mitreAttackIds.join(','),
      comments: `Scout detected: ${finding.type}\nSession: ${finding.sessionId}\nRisk Score: ${finding.riskScore}`,
    };

    const { data } = await fetchJson<{ result?: { sys_id?: string } }>(
      `${this.instanceUrl}/api/now/table/incident`,
      {
        method: 'POST',
        headers: {
          Authorization: this.authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(incident),
      },
    );

    const vendorId = data.result?.sys_id ?? `servicenow-${finding.id}`;
    return {
      ok: true,
      vendorId,
      vendorUrl: `${this.instanceUrl}/nav_to.do?uri=incident.do?sys_id=${vendorId}`,
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

  private mapSeverityToNumber(severity: string): number {
    return { critical: 1, high: 2, medium: 3, low: 4, info: 5 }[severity] || 3;
  }

  private buildDescription(finding: ScoutFinding): string {
    return [
      'Scout AI Agent Security Finding',
      '',
      `Type: ${finding.type}`,
      `Agent: ${finding.agentName || finding.agentId}`,
      `Session: ${finding.sessionId}`,
      `Risk Score: ${finding.riskScore}/100`,
      `MITRE ATT&CK: ${finding.mitreAttackIds.join(', ')}`,
      '',
      finding.description,
      '',
      `Remediation: ${finding.remediation || 'Review in Scout console'}`,
      '',
      `Finding ID: ${finding.id}`,
    ].join('\n');
  }
}
