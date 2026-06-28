# Gap 31 - Prompt 02: SIEM & EDR Connectors

**Status: COMPLETED 2026-06-25**

**What was built:** `src/connectors/sentinelone.ts`, `crowdstrike.ts`, `defender.ts`, shared severity mapping, mocked unit tests.

**Gap:** 31 Scout Partnership Integration
**Prompt number:** 02 of 04
**Name:** SentinelOne, CrowdStrike, Microsoft Defender connectors
**Primary agent:** Claude Code
**Estimated hours:** 4-5 h
**Depends on:** 01-connector-framework.md

---

## Read first

1. `connectors/types.ts` + `connectors/registry.ts` -- from prompt 01
2. `alerts/dispatcher.ts` -- alert severity routing
3. Each vendor's REST API docs (links below)

---

## Goal

Build three SIEM/EDR connectors. Each follows the `SiemConnector` interface.

### 1. SentinelOne Connector

**File:** `connectors/sentinelone.ts`

**API:** SentinelOne Deep Visibility REST API
**Auth:** API token (`Authorization: ApiToken <token>`)
**Base URL:** `https://<tenant>.sentinelone.net/web/api/v2.1/`

```typescript
export class SentinelOneConnector implements SiemConnector {
  id = 'sentinelone';
  name = 'SentinelOne';
  category = 'siem' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent security findings to SentinelOne Deep Visibility';

  configSchema: ConnectorConfigField[] = [
    { key: 'apiToken', label: 'API Token', type: 'password', required: true,
      help: 'SentinelOne API token with Deep Visibility write scope' },
    { key: 'tenantUrl', label: 'Tenant URL', type: 'url', required: true,
      placeholder: 'https://your-tenant.sentinelone.net',
      help: 'Your SentinelOne management console URL' },
    { key: 'siteId', label: 'Site ID (optional)', type: 'text', required: false,
      help: 'Scope to a specific site. Leave empty for account-wide.' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    // Map Scout finding to SentinelOne threat
    const threat = {
      data: {
        // Deep Visibility event
        source: 'Scout',
        threatName: `Scout: ${finding.title}`,
        severity: this.mapSeverity(finding.severity),
        detectionType: 'dynamic',
        agentDetectionInfo: {
          agentId: finding.agentId,
          sessionId: finding.sessionId,
        },
        mitreAttackIds: finding.mitreAttackIds,
        description: finding.description,
        // Map Scout evidence to SentinelOne indicators
        indicators: this.buildIndicators(finding),
        // Custom fields for Scout context
        customFields: {
          scoutFindingId: finding.id,
          scoutRiskScore: finding.riskScore,
          scoutScore: finding.scoutScore,
        },
      },
    };

    const response = await this.api.post('/deep-visibility/v2/events', threat);
    return {
      ok: true,
      vendorId: response.data.id,
      vendorUrl: `${this.baseUrl}/incidents/${response.data.id}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private mapSeverity(severity: string): string {
    const map: Record<string, string> = {
      critical: 'Critical',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
      info: 'Suspicious',
    };
    return map[severity] || 'Suspicious';
  }

  private buildIndicators(finding: ScoutFinding): Array<Record<string, unknown>> {
    const indicators = [];
    if (finding.evidence?.sourceIp) {
      indicators.push({ type: 'ip', value: finding.evidence.sourceIp });
    }
    if (finding.type === 'honeypot_triggered') {
      indicators.push({ type: 'url', value: finding.evidence?.prompt?.slice(0, 200) });
    }
    return indicators;
  }
}
```

### 2. CrowdStrike Connector

**File:** `connectors/crowdstrike.ts`

**API:** CrowdStrike Falcon Streaming API / Event Streams
**Auth:** OAuth2 client credentials (`client_id` + `client_secret`)
**Base URL:** `https://api.crowdstrike.com`

```typescript
export class CrowdStrikeConnector implements SiemConnector {
  id = 'crowdstrike';
  name = 'CrowdStrike Falcon';
  category = 'edr' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent threats to CrowdStrike Falcon Event Streams';

  configSchema: ConnectorConfigField[] = [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true,
      help: 'CrowdStrike API client ID with Event Streams write' },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    { key: 'baseUrl', label: 'API Base URL', type: 'url', required: true,
      default: 'https://api.crowdstrike.com',
      help: 'Use api.us-2.crowdstrike.com for US-2 tenants' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    // Authenticate via OAuth2
    const token = await this.getToken();

    // Map to CrowdStrike Custom IOA (Indicator of Attack)
    const ioa = {
      name: `Scout: ${finding.title}`,
      description: finding.description,
      platform: 'all',
      severity: this.mapSeverity(finding.severity),
      action: 'detect',
      pattern: this.buildIoaPattern(finding),
      mitre_techniques: finding.mitreAttackIds,
    };

    const response = await this.api.post('/custom-ioa/entities/rules/v1', ioa, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      ok: true,
      vendorId: response.resources[0].id,
      vendorUrl: `${this.consoleUrl}/custom-ioa/rules/${response.resources[0].id}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private buildIoaPattern(finding: ScoutFinding): string {
    // Build a pattern that matches Scout findings for fleet-wide detection
    return `(ai_agent_name="${finding.agentId}" AND scout_risk_score>=${finding.riskScore})`;
  }

  // OAuth2 token management with refresh
  private async getToken(): Promise<string> {
    // ... OAuth2 client_credentials flow
  }
}
```

### 3. Microsoft Defender Connector

**File:** `connectors/defender.ts`

**API:** Microsoft Defender for Cloud / Microsoft 365 Defender API
**Auth:** Azure AD app registration (OAuth2 client credentials)
**Base URL:** `https://api.security.microsoft.com/api`

```typescript
export class DefenderConnector implements SiemConnector {
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

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const token = await this.getToken();

    // Map to Defender custom detection / advanced hunting
    const alert = {
      title: `Scout AI Agent: ${finding.title}`,
      category: 'AI Agent Security',
      severity: this.mapSeverity(finding.severity),
      description: finding.description,
      sourceMaterials: [finding.type],
      mitreTechniques: finding.mitreAttackIds,
      entities: this.buildEntities(finding),
      // Custom evidence
      evidence: {
        '@odata.type': '#microsoft.graph.security.alertEvidence',
        ...finding.evidence,
      },
    };

    const response = await this.api.post('/api/alerts', alert, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return {
      ok: true,
      vendorId: response.id,
      vendorUrl: `https://security.microsoft.com/alerts/${response.id}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private buildEntities(finding: ScoutFinding): Array<Record<string, unknown>> {
    const entities = [];
    if (finding.evidence?.sourceIp) {
      entities.push({
        '@odata.type': '#microsoft.graph.security.ipEvidence',
        ipAddress: finding.evidence.sourceIp,
      });
    }
    // Add agent as a custom entity
    entities.push({
      '@odata.type': '#microsoft.graph.security.cloudApplicationEvidence',
      appId: finding.agentId,
      displayName: finding.agentName,
    });
    return entities;
  }

  private mapSeverity(severity: string): string {
    return { critical: 'high', high: 'high', medium: 'medium', low: 'low', info: 'informational' }[severity] || 'medium';
  }
}
```

### Severity Mapping Table (used by all connectors)

```typescript
// connectors/severity-map.ts
export const SCOUT_TO_VENDOR_SEVERITY: Record<string, Record<string, string>> = {
  sentinelone: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Suspicious' },
  crowdstrike: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low', info: 'Informational' },
  defender:    { critical: 'high', high: 'high', medium: 'medium', low: 'low', info: 'informational' },
  wiz:         { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFORMATIONAL' },
  snyk:        { critical: 'critical', high: 'high', medium: 'medium', low: 'low', info: 'note' },
  jira:        { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low', info: 'Lowest' },
  pagerduty:   { critical: 'critical', high: 'error', medium: 'warning', low: 'info', info: 'info' },
};
```

---

## Testing

Each connector needs:
1. Unit test with mocked vendor API
2. Severity mapping test
3. Error handling test (API down, auth expired, rate limited)

```typescript
// connectors/__tests__/sentinelone.test.ts
describe('SentinelOneConnector', () => {
  it('maps Scout severity to SentinelOne severity');
  it('builds indicators from finding evidence');
  it('includes MITRE ATT&CK IDs in threat payload');
  it('handles API 401 by surfacing auth error');
  it('health check returns ok when API reachable');
});
```

---

## Existing Carina code to integrate with

- `02-backends/console.labyrinthscout.com/src/connectors/registry.ts` -- register connectors
- `02-backends/console.labyrinthscout.com/src/connectors/severity-map.ts` -- new shared file
- `02-backends/console.labyrinthscout.com/src/alerts/dispatcher.ts` -- severity routing
- `02-backends/console.labyrinthscout.com/src/findings/store.ts` -- vendor ref storage
