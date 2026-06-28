# Gap 31 - Prompt 04: Ticketing, SOAR & Generic Webhook Connectors

**Status: COMPLETED 2026-06-25**

**What was built:** `src/connectors/jira.ts`, `servicenow.ts`, `pagerduty.ts`, `generic-webhook.ts`, ops Settings Connectors tab (`ops.carinaai.uk`).

**Gap:** 31 Scout Partnership Integration
**Prompt number:** 04 of 04
**Name:** Jira, ServiceNow, PagerDuty, generic webhook connectors
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** 01-connector-framework.md

---

## Read first

1. `connectors/types.ts` + `connectors/registry.ts` -- from prompt 01
2. `connectors/severity-map.ts` -- severity mapping shared file
3. `alerts/dispatcher.ts` -- alert dispatch flow
4. Vendor API docs (links below)

---

## Goal

Build four connectors for the ticketing and SOAR layer. These turn Scout
findings into work items that SOC teams can triage, assign, and close.

### 1. Jira Connector

**File:** `connectors/jira.ts`

**API:** Jira REST API v3
**Auth:** API token (Basic auth: email + token) or OAuth2
**Base URL:** `https://<tenant>.atlassian.net/rest/api/3`

```typescript
export class JiraConnector implements SiemConnector {
  id = 'jira';
  name = 'Jira';
  category = 'ticketing' as const;
  version = '1.0.0';
  description = 'Create Jira issues from Scout AI agent security findings';

  configSchema: ConnectorConfigField[] = [
    { key: 'email', label: 'Atlassian Email', type: 'text', required: true },
    { key: 'apiToken', label: 'API Token', type: 'password', required: true,
      help: 'Generate at https://id.atlassian.com/manage-profile/security/api-tokens' },
    { key: 'baseUrl', label: 'Instance URL', type: 'url', required: true,
      placeholder: 'https://your-company.atlassian.net' },
    { key: 'projectKey', label: 'Project Key', type: 'text', required: true,
      help: 'Jira project key (e.g., SEC, SCOUT)' },
    { key: 'issueType', label: 'Issue Type', type: 'select', required: true,
      options: [
        { label: 'Bug', value: 'Bug' },
        { label: 'Task', value: 'Task' },
        { label: 'Security Incident', value: 'Security Incident' },
        { label: 'Story', value: 'Story' },
      ],
      default: 'Security Incident' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64');

    const issue = {
      fields: {
        project: { key: this.projectKey },
        summary: `[Scout] ${finding.title}`,
        issuetype: { name: this.issueType },
        description: this.buildDescription(finding),
        priority: { name: this.mapPriority(finding.severity) },
        labels: ['scout', 'ai-agent-security', finding.type],
        // Custom fields for Scout context
        customfield_10001: finding.riskScore,   // configure in Jira
        customfield_10002: finding.agentId,
        customfield_10003: finding.sessionId,
      },
    };

    const response = await this.api.post('/issue', issue, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    });

    return {
      ok: true,
      vendorId: response.key,       // e.g., SEC-123
      vendorUrl: `${this.baseUrl}/browse/${response.key}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private buildDescription(finding: ScoutFinding): string {
    return `
h2. Scout AI Agent Finding

*Type:* ${finding.type}
*Severity:* ${finding.severity}
*Agent:* ${finding.agentName || finding.agentId}
*Risk Score:* ${finding.riskScore}/100
*Timestamp:* ${finding.timestamp}

h3. Description
${finding.description}

h3. MITRE ATT&CK
${finding.mitreAttackIds.map(id => `* ${id}`).join('\n')}

h3. Evidence
{code:json}
${JSON.stringify(finding.evidence || {}, null, 2)}
{code}

h3. Remediation
${finding.remediation || 'Review in Scout console'}

_Submitted by Labyrinth Scout | Finding ID: ${finding.id}_
    `.trim();
  }

  private mapPriority(severity: string): string {
    return { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low', info: 'Lowest' }[severity] || 'Medium';
  }
}
```

### 2. ServiceNow Connector

**File:** `connectors/servicenow.ts`

**API:** ServiceNow Table API (REST)
**Auth:** Basic auth (username + password) or OAuth2
**Base URL:** `https://<instance>.service-now.com/api/now`

```typescript
export class ServiceNowConnector implements SiemConnector {
  id = 'servicenow';
  name = 'ServiceNow';
  category = 'ticketing' as const;
  version = '1.0.0';
  description = 'Create ServiceNow incidents from Scout AI agent security findings';

  configSchema: ConnectorConfigField[] = [
    { key: 'instanceUrl', label: 'Instance URL', type: 'url', required: true,
      placeholder: 'https://dev12345.service-now.com' },
    { key: 'username', label: 'Username', type: 'text', required: true },
    { key: 'password', label: 'Password', type: 'password', required: true },
    { key: 'assignmentGroup', label: 'Assignment Group (sys_id)', type: 'text', required: false,
      help: 'ServiceNow group to auto-assign incidents' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');

    const incident = {
      short_description: `[Scout] ${finding.title}`,
      description: this.buildDescription(finding),
      severity: this.mapSeverityToNumber(finding.severity),
      urgency: this.mapSeverityToNumber(finding.severity),
      impact: finding.severity === 'critical' ? 1 : 2,
      category: 'AI Agent Security',
      subcategory: finding.type,
      assignment_group: this.assignmentGroup,
      // Scout-specific fields
      u_scout_finding_id: finding.id,
      u_agent_id: finding.agentId,
      u_risk_score: finding.riskScore,
      u_mitre_techniques: finding.mitreAttackIds.join(','),
      comments: `Scout detected: ${finding.type}\nSession: ${finding.sessionId}\nRisk Score: ${finding.riskScore}`,
    };

    const response = await this.api.post('/table/incident', incident, {
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    });

    return {
      ok: true,
      vendorId: response.result.sys_id,
      vendorUrl: `${this.instanceUrl}/nav_to.do?uri=incident.do?sys_id=${response.result.sys_id}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private mapSeverityToNumber(severity: string): number {
    return { critical: 1, high: 2, medium: 3, low: 4, info: 5 }[severity] || 3;
  }

  private buildDescription(finding: ScoutFinding): string {
    return [
      `Scout AI Agent Security Finding`,
      ``,
      `Type: ${finding.type}`,
      `Agent: ${finding.agentName || finding.agentId}`,
      `Session: ${finding.sessionId}`,
      `Risk Score: ${finding.riskScore}/100`,
      `MITRE ATT&CK: ${finding.mitreAttackIds.join(', ')}`,
      ``,
      finding.description,
      ``,
      `Remediation: ${finding.remediation || 'Review in Scout console'}`,
      ``,
      `Finding ID: ${finding.id}`,
    ].join('\n');
  }
}
```

### 3. PagerDuty Connector

**File:** `connectors/pagerduty.ts`

**API:** PagerDuty Events API v2
**Auth:** Routing key (integration key)
**Base URL:** `https://events.pagerduty.com/v2/enqueue`

```typescript
export class PagerDutyConnector implements SiemConnector {
  id = 'pagerduty';
  name = 'PagerDuty';
  category = 'soar' as const;
  version = '1.0.0';
  description = 'Trigger PagerDuty incidents for critical Scout findings';

  configSchema: ConnectorConfigField[] = [
    { key: 'routingKey', label: 'Routing Key', type: 'password', required: true,
      help: 'PagerDuty integration key (Events API v2)' },
    { key: 'minSeverity', label: 'Minimum Severity', type: 'select', required: true,
      options: [
        { label: 'Critical only', value: 'critical' },
        { label: 'High and above', value: 'high' },
        { label: 'Medium and above', value: 'medium' },
      ],
      default: 'high',
      help: 'Only trigger PagerDuty for findings at or above this severity' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    // PagerDuty is for critical/high only -- skip lower severities
    if (!this.meetsMinSeverity(finding.severity)) {
      return { ok: true, vendorId: 'skipped-severity', pushedAt: new Date().toISOString() };
    }

    const payload = {
      routing_key: this.routingKey,
      event_action: 'trigger',
      dedup_key: `scout-${finding.id}`,
      payload: {
        summary: `[Scout] ${finding.title}`,
        source: `Scout AI Agent: ${finding.agentName || finding.agentId}`,
        severity: this.mapSeverity(finding.severity),
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
      // Link back to Scout console
      links: [{
        href: `https://console.labyrinthscout.com/findings/${finding.id}`,
        text: 'View in Scout Console',
      }],
    };

    const response = await this.http.post(this.apiUrl, payload);

    return {
      ok: true,
      vendorId: response.dedup_key,
      vendorUrl: `https://your-org.pagerduty.com/incidents?query=${response.dedup_key}`,
      pushedAt: new Date().toISOString(),
    };
  }

  /** Resolve a PagerDuty incident when Scout finding is resolved */
  async resolveIncident(scoutFindingId: string): Promise<void> {
    await this.http.post(this.apiUrl, {
      routing_key: this.routingKey,
      event_action: 'resolve',
      dedup_key: `scout-${scoutFindingId}`,
    });
  }

  private meetsMinSeverity(severity: string): boolean {
    const ranks = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    return ranks[severity] <= (ranks[this.minSeverity] ?? 1);
  }
}
```

### 4. Generic Webhook Connector

**File:** `connectors/generic-webhook.ts`

The most flexible connector -- POSTs JSON to any HTTP endpoint. Used when
the vendor doesn't have a dedicated connector yet.

```typescript
export class GenericWebhookConnector implements SiemConnector {
  id = 'generic-webhook';
  name = 'Generic Webhook';
  category = 'siem' as const; // default, configurable
  version = '1.0.0';
  description = 'POST Scout findings as JSON to any HTTP endpoint';

  configSchema: ConnectorConfigField[] = [
    { key: 'url', label: 'Webhook URL', type: 'url', required: true },
    { key: 'authHeader', label: 'Authorization Header', type: 'text', required: false,
      placeholder: 'Bearer your-token',
      help: 'Value of the Authorization header. Leave empty for no auth.' },
    { key: 'customHeaders', label: 'Custom Headers (JSON)', type: 'text', required: false,
      help: 'Additional headers as JSON object, e.g. {"X-API-Key":"..."}' },
    { key: 'template', label: 'Payload Template (optional)', type: 'text', required: false,
      help: 'Custom JSON template. Use {{field}} for Scout finding fields. Leave empty for full Scout payload.' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Scout-Connector/1.0',
    };

    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }

    if (this.customHeaders) {
      try {
        Object.assign(headers, JSON.parse(this.customHeaders));
      } catch { /* invalid JSON, skip */ }
    }

    // Apply template if configured
    const payload = this.template
      ? this.applyTemplate(this.template, finding)
      : this.defaultPayload(finding);

    const response = await this.http.post(this.url, payload, { headers });

    return {
      ok: response.status >= 200 && response.status < 300,
      vendorId: response.headers['x-request-id'] || `webhook-${Date.now()}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private defaultPayload(finding: ScoutFinding): Record<string, unknown> {
    return {
      source: 'Scout',
      version: '1.0',
      finding: {
        id: finding.id,
        type: finding.type,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        agentId: finding.agentId,
        agentName: finding.agentName,
        sessionId: finding.sessionId,
        timestamp: finding.timestamp,
        riskScore: finding.riskScore,
        scoutScore: finding.scoutScore,
        mitreAttackIds: finding.mitreAttackIds,
        evidence: finding.evidence,
        remediation: finding.remediation,
      },
      consoleUrl: `https://console.labyrinthscout.com/findings/${finding.id}`,
    };
  }

  private applyTemplate(template: string, finding: ScoutFinding): unknown {
    // Simple template: replace {{field}} with finding values
    const replacer = (match: string, field: string): string => {
      const value = this.resolvePath(finding, field);
      return value !== undefined ? String(value) : match;
    };
    const rendered = template.replace(/\{\{([\w.]+)\}\}/g, replacer);
    try { return JSON.parse(rendered); } catch { return { raw: rendered }; }
  }
}
```

### Registration

Add all four to `connectors/register-all.ts`:

```typescript
import { JiraConnector } from './jira';
import { ServiceNowConnector } from './servicenow';
import { PagerDutyConnector } from './pagerduty';
import { GenericWebhookConnector } from './generic-webhook';

// Add to registerAllConnectors():
JiraConnector, ServiceNowConnector, PagerDutyConnector, GenericWebhookConnector,
```

---

## Testing

```typescript
// connectors/__tests__/jira.test.ts
describe('JiraConnector', () => {
  it('builds Jira description with Scout finding fields');
  it('maps Scout severity to Jira priority');
  it('includes MITRE ATT&CK IDs in description');
  it('returns vendor key (e.g., SEC-123) as vendorId');
  it('handles Jira API 400 with validation error');
});

// connectors/__tests__/pagerduty.test.ts
describe('PagerDutyConnector', () => {
  it('skips findings below minSeverity threshold');
  it('triggers incident for critical findings');
  it('resolves incident when finding is resolved');
  it('includes dedup_key based on scout finding ID');
  it('maps severity correctly');
});

// connectors/__tests__/generic-webhook.test.ts
describe('GenericWebhookConnector', () => {
  it('POSTs default Scout payload to configured URL');
  it('applies custom headers from config');
  it('renders template fields from finding data');
  it('handles non-200 responses gracefully');
});
```

---

## Existing Carina code to integrate with

- `02-backends/console.labyrinthscout.com/src/connectors/registry.ts`
- `02-backends/console.labyrinthscout.com/src/connectors/severity-map.ts`
- `02-backends/console.labyrinthscout.com/src/alerts/dispatcher.ts`
- `02-backends/console.labyrinthscout.com/src/findings/store.ts`
- `02-backends/console.labyrinthscout.com/src/api/connectors.ts` -- ops panel API
