import { BaseConnector } from './base-connector.js';
import { fetchJson, probeReachable } from './http.js';
import type { ConnectorConfigField, PushResult, ScoutAlert, ScoutFinding } from './types.js';

export class GenericWebhookConnector extends BaseConnector {
  id = 'generic-webhook';
  name = 'Generic Webhook';
  category = 'siem' as const;
  version = '1.0.0';
  description = 'POST Scout findings as JSON to any HTTP endpoint';

  configSchema: ConnectorConfigField[] = [
    { key: 'url', label: 'Webhook URL', type: 'url', required: true },
    {
      key: 'authHeader',
      label: 'Authorization Header',
      type: 'text',
      required: false,
      placeholder: 'Bearer your-token',
      help: 'Value of the Authorization header. Leave empty for no auth.',
    },
    {
      key: 'customHeaders',
      label: 'Custom Headers (JSON)',
      type: 'text',
      required: false,
      help: 'Additional headers as JSON object, e.g. {"X-API-Key":"..."}',
    },
    {
      key: 'template',
      label: 'Payload Template (optional)',
      type: 'text',
      required: false,
      help: 'Custom JSON template. Use {{field}} for Scout finding fields. Leave empty for full Scout payload.',
    },
  ];

  async health() {
    const probe = await probeReachable(this.cfg('url'), {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ source: 'Scout', type: 'health_check' }),
    });
    return this.healthResult(probe);
  }

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const payload = this.cfg('template')
      ? this.applyTemplate(this.cfg('template'), finding)
      : this.defaultPayload(finding);

    const { status, headers } = await fetchJson(this.cfg('url'), {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify(payload),
    });

    return {
      ok: status >= 200 && status < 300,
      vendorId: headers.get('x-request-id') || `webhook-${Date.now()}`,
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

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Scout-Connector/1.0',
    };

    if (this.cfg('authHeader')) {
      headers.Authorization = this.cfg('authHeader');
    }

    if (this.cfg('customHeaders')) {
      try {
        Object.assign(headers, JSON.parse(this.cfg('customHeaders')) as Record<string, string>);
      } catch {
        // invalid JSON, skip
      }
    }

    return headers;
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
    const rendered = template.replace(/\{\{([\w.]+)\}\}/g, (match, field: string) => {
      const value = this.resolvePath(finding, field);
      return value !== undefined ? String(value) : match;
    });
    try {
      return JSON.parse(rendered);
    } catch {
      return { raw: rendered };
    }
  }

  private resolvePath(finding: ScoutFinding, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = finding;
    for (const part of parts) {
      if (!current || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }
}
