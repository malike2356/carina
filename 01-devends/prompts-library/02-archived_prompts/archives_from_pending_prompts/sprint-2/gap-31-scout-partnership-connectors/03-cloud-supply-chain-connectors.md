# Gap 31 - Prompt 03: Cloud Security & Supply Chain Connectors

**Status: COMPLETED 2026-06-25**

**What was built:** `src/connectors/wiz.ts`, `snyk.ts`, `socket.ts`, `semgrep.ts`, registered in `register-all.ts`.

**Gap:** 31 Scout Partnership Integration
**Prompt number:** 03 of 04
**Name:** Wiz, Snyk, Socket, Semgrep connectors
**Primary agent:** Claude Code
**Estimated hours:** 4-5 h
**Depends on:** 01-connector-framework.md

---

## Read first

1. `connectors/types.ts` + `connectors/registry.ts` -- from prompt 01
2. `connectors/severity-map.ts` -- severity mapping (add entries for these vendors)
3. `findings/types.ts` -- Scout finding types

---

## Goal

Build four connectors for the cloud security and supply chain vendors OpenAI
named as partners. These are the "supply chain" and "cloud" layers of the
security flywheel.

### 1. Wiz Connector (Cloud Security)

**File:** `connectors/wiz.ts`

**Why Wiz:** Wiz is the leading CNAPP (Cloud-Native Application Protection
Platform). When Scout detects an AI agent compromise, Wiz can correlate it
with cloud infrastructure posture -- which VMs, containers, or serverless
functions that agent had access to.

**API:** Wiz Security Graph API
**Auth:** OAuth2 client credentials
**Base URL:** `https://api.<region>.app.wiz.io/graphql`

```typescript
export class WizConnector implements SiemConnector {
  id = 'wiz';
  name = 'Wiz';
  category = 'cloud' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent security findings to Wiz Security Graph';

  configSchema: ConnectorConfigField[] = [
    { key: 'clientId', label: 'Client ID', type: 'text', required: true },
    { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    { key: 'apiEndpoint', label: 'API Endpoint', type: 'url', required: true,
      default: 'https://api.us1.app.wiz.io/graphql' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    const token = await this.getToken();

    const mutation = `
      mutation CreateFinding($input: CreateFindingInput!) {
        createFinding(input: $input) {
          finding { id }
        }
      }
    `;

    const input = {
      name: `Scout AI Agent: ${finding.title}`,
      severity: this.mapSeverity(finding.severity),
      description: finding.description,
      // Map Scout finding to Wiz resource context
      resource: {
        externalId: finding.agentId,
        name: finding.agentName || `Agent ${finding.agentId}`,
        type: 'AI_AGENT',  // custom resource type
      },
      // Wiz-specific fields
      riskScore: finding.riskScore,
      mitreTactics: finding.mitreAttackIds,
      // Evidence as Wiz finding metadata
      metadata: {
        scoutFindingId: finding.id,
        findingType: finding.type,
        sessionId: finding.sessionId,
        ...finding.evidence,
      },
      remediation: finding.remediation || 'Review Scout console for details',
    };

    const response = await this.graphql(mutation, { input });
    return {
      ok: true,
      vendorId: response.createFinding.finding.id,
      vendorUrl: `${this.consoleUrl}/findings/${response.createFinding.finding.id}`,
      pushedAt: new Date().toISOString(),
    };
  }
}
```

### 2. Snyk Connector (Supply Chain)

**File:** `connectors/snyk.ts`

**Why Snyk:** OpenAI named Snyk as a supply chain partner. When Scout detects
vulnerability exploitation attempts against an agent's dependencies, Snyk can
correlate with known CVEs and dependency graphs.

**API:** Snyk REST API v1
**Auth:** API token (`Authorization: token <token>`)
**Base URL:** `https://api.snyk.io/rest`

```typescript
export class SnykConnector implements SiemConnector {
  id = 'snyk';
  name = 'Snyk';
  category = 'supply-chain' as const;
  version = '1.0.0';
  description = 'Push Scout AI agent vulnerability findings to Snyk';

  configSchema: ConnectorConfigField[] = [
    { key: 'apiToken', label: 'API Token', type: 'password', required: true,
      help: 'Snyk API token with issue write scope' },
    { key: 'orgId', label: 'Organization ID', type: 'text', required: true,
      help: 'Snyk organization to push findings to' },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    // Only push vulnerability-type findings to Snyk
    if (finding.type !== 'vulnerability') {
      return { ok: true, vendorId: 'skipped', pushedAt: new Date().toISOString() };
    }

    const issue = {
      data: {
        type: 'issue',
        attributes: {
          title: `Scout: ${finding.title}`,
          description: finding.description,
          severity: this.mapSeverity(finding.severity),
          // Map to Snyk's issue model
          classes: ['ai-agent-security'],
          coordinates: [{
            representations: ['.'],
            remedies: finding.remediation ? [{ description: finding.remediation, type: 'indeterminate' }] : [],
          }],
          // Attach Scout context
          custom: {
            scoutFindingId: finding.id,
            agentId: finding.agentId,
            mitreAttackIds: finding.mitreAttackIds,
          },
        },
      },
    };

    const response = await this.api.post(
      `/orgs/${this.orgId}/issues`,
      issue,
      { headers: { Authorization: `token ${this.apiToken}`, 'Content-Type': 'application/vnd.api+json' } }
    );
    return {
      ok: true,
      vendorId: response.data.id,
      vendorUrl: `https://app.snyk.io/org/${this.orgId}/issues/${response.data.id}`,
      pushedAt: new Date().toISOString(),
    };
  }
}
```

### 3. Socket Connector (Supply Chain)

**File:** `connectors/socket.ts`

**Why Socket:** Socket.dev scans npm/PyPI packages for supply chain risks.
When Scout detects an agent downloading or executing a suspicious package,
Socket can flag the package for the organization.

**API:** Socket.dev REST API
**Auth:** API key (`Authorization: Basic <base64(key:)`)
**Base URL:** `https://api.socket.dev/v0`

```typescript
export class SocketConnector implements SiemConnector {
  id = 'socket';
  name = 'Socket.dev';
  category = 'supply-chain' as const;
  version = '1.0.0';
  description = 'Push Scout-detected suspicious packages to Socket.dev for supply chain blocking';

  configSchema: ConnectorConfigField[] = [
    { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    { key: 'orgSlug', label: 'Organization Slug', type: 'text', required: true },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    // Only for supply chain / tool abuse findings
    if (!['tool_abuse', 'egress_violation'].includes(finding.type)) {
      return { ok: true, vendorId: 'skipped', pushedAt: new Date().toISOString() };
    }

    // Extract package info from finding evidence
    const packageName = this.extractPackageName(finding);

    // Create a Socket alert/report
    const report = await this.api.post(
      `/orgs/${this.orgSlug}/report`,
      {
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
      },
      { headers: { Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}` } }
    );
    return {
      ok: true,
      vendorId: report.id,
      vendorUrl: report.reportUrl,
      pushedAt: new Date().toISOString(),
    };
  }

  private extractPackageName(finding: ScoutFinding): string | null {
    // Parse tool call params for npm install / pip install patterns
    const toolCall = finding.evidence?.toolCall;
    if (!toolCall) return null;
    const match = toolCall.match(/(?:npm install|pip install|yarn add|pnpm add)\s+(\S+)/);
    return match?.[1] || null;
  }
}
```

### 4. Semgrep Connector (SAST)

**File:** `connectors/semgrep.ts`

**Why Semgrep:** OpenAI named Semgrep as a supply chain partner. When Scout
finds code-level vulnerabilities through agent behaviour analysis, Semgrep
can turn them into custom rules for the organization's CI pipeline.

**API:** Semgrep API / Semgrep App
**Auth:** API token (`Authorization: Bearer <token>`)
**Base URL:** `https://semgrep.dev/api/v1`

```typescript
export class SemgrepConnector implements SiemConnector {
  id = 'semgrep';
  name = 'Semgrep';
  category = 'supply-chain' as const;
  version = '1.0.0';
  description = 'Push Scout code vulnerability findings to Semgrep as custom rules';

  configSchema: ConnectorConfigField[] = [
    { key: 'apiToken', label: 'API Token', type: 'password', required: true },
    { key: 'deploymentSlug', label: 'Deployment Slug', type: 'text', required: true },
  ];

  async pushFinding(finding: ScoutFinding): Promise<PushResult> {
    if (finding.type !== 'vulnerability') {
      return { ok: true, vendorId: 'skipped', pushedAt: new Date().toISOString() };
    }

    // Convert Scout finding to a Semgrep rule
    // This lets the finding become a permanent CI check rather than a one-off alert
    const rule = this.findingToSemgrepRule(finding);

    const response = await this.api.post(
      `/deployments/${this.deploymentSlug}/rules`,
      rule,
      { headers: { Authorization: `Bearer ${this.apiToken}` } }
    );
    return {
      ok: true,
      vendorId: response.id,
      vendorUrl: `https://semgrep.dev/orgs/${this.deploymentSlug}/rules/${response.id}`,
      pushedAt: new Date().toISOString(),
    };
  }

  private findingToSemgrepRule(finding: ScoutFinding): Record<string, unknown> {
    return {
      // Map finding patterns to Semgrep rule syntax
      rule: {
        id: `scout.${finding.id.slice(0, 8)}`,
        message: finding.title,
        severity: this.mapSeverity(finding.severity).toUpperCase(),
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
      // Add to "Scout" ruleset
      rulesetName: 'Scout AI Agent Detections',
    };
  }
}
```

---

## Registration

In `connectors/registry.ts` (or a new `connectors/register-all.ts`):

```typescript
import { SentinelOneConnector } from './sentinelone';
import { CrowdStrikeConnector } from './crowdstrike';
import { DefenderConnector } from './defender';
import { WizConnector } from './wiz';
import { SnykConnector } from './snyk';
import { SocketConnector } from './socket';
import { SemgrepConnector } from './semgrep';

export function registerAllConnectors(): void {
  for (const Connector of [
    SentinelOneConnector, CrowdStrikeConnector, DefenderConnector,
    WizConnector, SnykConnector, SocketConnector, SemgrepConnector,
  ]) {
    registerConnector(new Connector());
  }
}
```

---

## Testing

Each connector: unit test with mocked API, severity mapping, error handling.
Focus on the mapping logic -- vendor APIs change, but the mapping from Scout
finding to vendor format is the value.

---

## Existing Carina code to integrate with

- `02-backends/console.labyrinthscout.com/src/connectors/registry.ts`
- `02-backends/console.labyrinthscout.com/src/connectors/severity-map.ts`
- `02-backends/console.labyrinthscout.com/src/alerts/dispatcher.ts`
- `02-backends/console.labyrinthscout.com/src/findings/types.ts`
