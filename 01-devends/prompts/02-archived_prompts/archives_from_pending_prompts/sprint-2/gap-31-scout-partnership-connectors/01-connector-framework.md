# Gap 31 - Prompt 01: Connector Framework & Registry

**Status: COMPLETED 2026-06-25**

**What was built:** `src/connectors/` framework (types, registry, router, event-mapper, severity-map), `lib/connector-config.ts`, `migrations/add-connector-schema.ts`, `api/connectors.ts`, dispatcher wiring, unit tests.

**Gap:** 31 Scout Partnership Integration
**Prompt number:** 01 of 04
**Name:** Shared connector interface, registry, routing, config UI
**Primary agent:** Claude Code
**Estimated hours:** 3-4 h
**Depends on:** Nothing (foundation -- build first)

---

## Read first

1. `02-backends/console.labyrinthscout.com/src/alerts/dispatcher.ts` -- existing alert dispatch
2. `02-backends/console.labyrinthscout.com/src/alerts/types.ts` -- alert types
3. `02-backends/console.labyrinthscout.com/src/integration/adapter-registry.ts` -- existing adapter registry pattern
4. `02-backends/console.labyrinthscout.com/src/findings/types.ts` -- finding types
5. `02-backends/console.labyrinthscout.com/src/findings/store.ts` -- finding persistence

---

## Goal

Build the connector framework before implementing individual vendor connectors.
The framework provides the shared interface, registry, and routing that all
connectors plug into.

### Step 1: Create `connectors/types.ts`

```typescript
// 02-backends/console.labyrinthscout.com/src/connectors/types.ts

export type ConnectorCategory =
  | 'siem'        // SentinelOne, CrowdStrike, Defender
  | 'edr'         // Endpoint-specific
  | 'cloud'       // Wiz, Orca, Prisma
  | 'supply-chain' // Snyk, Socket, Semgrep
  | 'ticketing'   // Jira, ServiceNow, Linear
  | 'soar'; // PagerDuty, Splunk SOAR

export interface SiemConnector {
  id: string;
  name: string;
  category: ConnectorCategory;
  version: string;
  /** Human description shown in ops panel */
  description: string;
  /** Configuration schema for ops panel form generation */
  configSchema: ConnectorConfigField[];
  /** Initialize with user-provided config */
  init(config: Record<string, string>): Promise<void>;
  /** Health check */
  health(): Promise<ConnectorHealth>;
  /** Push a finding */
  pushFinding(finding: ScoutFinding): Promise<PushResult>;
  /** Push an alert (immediate, high-priority) */
  pushAlert(alert: ScoutAlert): Promise<PushResult>;
  /** Get vendor-side status */
  getStatus(vendorId: string): Promise<VendorStatus>;
  /** Tear down */
  shutdown(): Promise<void>;
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[]; // for select type
  default?: string;
  help?: string;
}

export interface ConnectorHealth {
  ok: boolean;
  latencyMs: number;
  error?: string;
  lastChecked: string; // ISO 8601
}

export interface PushResult {
  ok: boolean;
  vendorId: string; // vendor-side ID (ticket, finding, incident)
  vendorUrl?: string; // deep link to vendor UI
  error?: string;
  pushedAt: string; // ISO 8601
}

export interface VendorStatus {
  vendorId: string;
  status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'closed' | 'unknown';
  assignee?: string;
  updatedAt?: string;
  rawResponse?: unknown;
}

// Shared finding/alert shapes used by the framework

export interface ScoutFinding {
  id: string;
  type: 'prompt_injection' | 'honeypot_triggered' | 'anomaly_spike' |
        'kill_activated' | 'egress_violation' | 'tool_abuse' |
        'vulnerability' | 'risk_score_change' | 'trust_attestation_failed';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  agentId: string;
  agentName: string;
  sessionId: string;
  timestamp: string; // ISO 8601
  mitreAttackIds: string[];
  evidence?: {
    prompt?: string;
    toolCall?: string;
    response?: string;
    sourceIp?: string;
    userAgent?: string;
  };
  remediation?: string;
  riskScore: number; // 0-100
  scoutScore?: number; // WAV/WV score
  accountId: string;
}

export interface ScoutAlert {
  id: string;
  findingId: string; // links to ScoutFinding
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  requiresImmediate: boolean;
}
```

### Step 2: Create `connectors/registry.ts`

```typescript
// 02-backends/console.labyrinthscout.com/src/connectors/registry.ts

import type { SiemConnector } from './types';

const connectors = new Map<string, SiemConnector>();

export function registerConnector(connector: SiemConnector): void {
  if (connectors.has(connector.id)) {
    throw new Error(`Connector ${connector.id} already registered`);
  }
  connectors.set(connector.id, connector);
}

export function getConnector(id: string): SiemConnector | undefined {
  return connectors.get(id);
}

export function listConnectors(): SiemConnector[] {
  return [...connectors.values()];
}

export function listByCategory(category: string): SiemConnector[] {
  return [...connectors.values()].filter(c => c.category === category);
}

export function removeConnector(id: string): boolean {
  return connectors.delete(id);
}

// Health check all registered connectors
export async function healthAll(): Promise<Record<string, { ok: boolean; latencyMs: number }>> {
  const results: Record<string, { ok: boolean; latencyMs: number }> = {};
  for (const [id, connector] of connectors) {
    try {
      results[id] = await connector.health();
    } catch (err) {
      results[id] = { ok: false, latencyMs: 0, error: String(err) };
    }
  }
  return results;
}
```

### Step 3: Create `connectors/router.ts`

```typescript
// 02-backends/console.labyrinthscout.com/src/connectors/router.ts

import { getConnector, listByCategory } from './registry';
import type { ScoutFinding, ScoutAlert } from './types';

interface ConnectorRoute {
  connectorId: string;
  /** Route findings of these types to this connector */
  findingTypes?: string[];
  /** Only route findings at or above this severity */
  minSeverity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  /** Route ALL alerts regardless of type */
  routeAllAlerts?: boolean;
}

/**
 * Routes Scout findings and alerts to configured connectors.
 * Configuration stored in DB (connector_routes table).
 */
export class ConnectorRouter {
  private routes: ConnectorRoute[] = [];

  async loadRoutes(): Promise<void> {
    // Load from DB
    const rows = await pool.query(
      'SELECT * FROM connector_routes WHERE enabled = true ORDER BY priority'
    );
    this.routes = rows.rows.map(this.rowToRoute);
  }

  async pushFinding(finding: ScoutFinding): Promise<void> {
    for (const route of this.routes) {
      if (!this.matchesRoute(finding, route)) continue;
      const connector = getConnector(route.connectorId);
      if (!connector) continue;

      try {
        const result = await connector.pushFinding(finding);
        // Store vendor ID for cross-reference
        await this.storeVendorRef(finding.id, route.connectorId, result.vendorId);
      } catch (err) {
        console.error(`[connector] ${route.connectorId} push failed:`, err);
      }
    }
  }

  async pushAlert(alert: ScoutAlert): Promise<void> {
    for (const route of this.routes) {
      if (!route.routeAllAlerts) continue;
      const connector = getConnector(route.connectorId);
      if (!connector) continue;
      try {
        const result = await connector.pushAlert(alert);
        await this.storeVendorRef(alert.findingId, route.connectorId, result.vendorId);
      } catch (err) {
        console.error(`[connector] ${route.connectorId} alert push failed:`, err);
      }
    }
  }

  private matchesRoute(finding: ScoutFinding, route: ConnectorRoute): boolean {
    if (route.findingTypes && !route.findingTypes.includes(finding.type)) return false;
    // severity ordering not yet implemented
    return true;
  }
}
```

### Step 4: Wire into Alert Dispatcher

In `alerts/dispatcher.ts`, after existing channel dispatch, add:

```typescript
// After existing Telegram/Slack/email dispatch:
// Route to SIEM connectors
const connectorRouter = getConnectorRouter();
await connectorRouter.pushFinding(finding);
if (isNeverThrottle(finding)) {
  await connectorRouter.pushAlert({
    id: alertId,
    findingId: finding.id,
    severity: finding.severity,
    title: finding.title,
    message: buildAlertMessage(finding),
    timestamp: new Date().toISOString(),
    requiresImmediate: true,
  });
}
```

### Step 5: Ops Panel Config UI

Add a "Connectors" page to the Scout console (`api/connectors.ts`):

```
GET  /api/connectors              List all available connectors
POST /api/connectors/:id/enable   Enable and configure a connector
POST /api/connectors/:id/disable  Disable a connector
GET  /api/connectors/:id/health   Run health check for a connector
POST /api/connectors/:id/test     Send test finding (dry run)
```

### Step 6: Database Migrations

New tables in `migrations/add-connector-schema.ts`:

```sql
CREATE TABLE connector_configs (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connector_id  TEXT NOT NULL,       -- matches SiemConnector.id
  account_id    TEXT NOT NULL,
  config        JSONB NOT NULL,       -- encrypted connector-specific config
  enabled       BOOLEAN NOT NULL DEFAULT false,
  last_health   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id, connector_id)
);

CREATE TABLE connector_routes (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  connector_id    TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  finding_types   TEXT[],            -- null = all types
  min_severity    TEXT DEFAULT 'medium',
  route_alerts    BOOLEAN NOT NULL DEFAULT true,
  enabled         BOOLEAN NOT NULL DEFAULT true,
  priority        INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE connector_vendor_refs (
  scout_finding_id  TEXT NOT NULL,
  connector_id      TEXT NOT NULL,
  vendor_id         TEXT NOT NULL,
  vendor_url        TEXT,
  pushed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scout_finding_id, connector_id)
);
```

---

## Testing

```typescript
// connectors/__tests__/registry.test.ts
describe('ConnectorRegistry', () => {
  it('registers and retrieves connectors');
  it('lists by category');
  it('prevents duplicate registration');
  it('healthAll checks all connectors');
});

// connectors/__tests__/router.test.ts
describe('ConnectorRouter', () => {
  it('routes findings to matching connectors');
  it('skips connectors not matching finding type');
  it('stores vendor refs after successful push');
  it('handles connector errors gracefully');
});
```

---

## Existing Carina code to integrate with

- `02-backends/console.labyrinthscout.com/src/alerts/dispatcher.ts` -- wire connector push after channel dispatch
- `02-backends/console.labyrinthscout.com/src/findings/store.ts` -- add vendor_refs query
- `02-backends/console.labyrinthscout.com/src/findings/stix-export.ts` -- include vendor refs in STIX export
- `02-backends/console.labyrinthscout.com/src/integration/adapter-registry.ts` -- follow same registry pattern
- `02-backends/console.labyrinthscout.com/src/migrations/` -- new migration
- `02-backends/console.labyrinthscout.com/src/db.ts` -- pool access
