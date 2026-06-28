# Gap 31 - Scout Partnership Integration: SIEM/EDR Connectors

**Status: COMPLETED 2026-06-25 (archived)**

**What was built:**
- Scout connector framework and 11 vendor connectors under `02-backends/console.labyrinthscout.com/src/connectors/`
- DB tables (`connector_configs`, `connector_routes`, `connector_vendor_refs`), encrypted config in `lib/connector-config.ts`
- Admin API `/api/admin/connectors` and alert dispatcher routing
- STIX export vendor cross-references in `findings/stix-export.ts`
- Ops panel Connectors tab at `ops.carinaai.uk/settings#connectors`
- Unit tests plus live sandbox harness (`pnpm test:connectors:live`, `connectors.live.example.json`)

**Gap:** 31
**Sprint:** 2
**Source:** OpenAI GPT-5.5 Trusted Access for Cyber announcement (May 2026)
  Named partners: Cisco, SentinelOne, Snyk, Intel, Gen Digital, Semgrep, Socket.
  Validates the "security flywheel" model: vuln research -> supply chain ->
  detection -> network enforcement. Scout must feed into this ecosystem.
**Goal:** Build outbound connectors so Scout findings flow into the SIEM, EDR,
  cloud security, and supply chain tools that SOC teams already use. Scout
  currently pushes alerts to human channels (Telegram, Slack, email, SMS,
  Discord, WhatsApp). These new connectors push structured machine-to-machine
  data into the vendor ecosystem.

**Primary agent:** Claude Code (all prompts -- backend TypeScript)
**Estimated hours:** 14-18 h total

---

## Context

Scout already has:
- **Inbound adapters** (`integration/adapters/`): Carina, OpenAI, LangChain,
  external agents, generic, goal-result. These adapt agent events INTO Scout.
- **Outbound alert channels** (`alerts/`): Telegram, Email, Slack, SMS,
  Discord, WhatsApp. These push human-readable alerts OUT.
- **Alert dispatcher** (`alerts/dispatcher.ts`): severity-based routing,
  deduplication, throttling, escalation.
- **Findings store** (`findings/store.ts`): structured vulnerability findings
  with STIX export.
- **SSE stream** (`api/sse.ts`): real-time event stream for dashboards.

What's MISSING: machine-to-machine outbound connectors. When Scout detects a
prompt injection, honeypot trigger, or anomaly spike, a SOC team using
SentinelOne or Wiz should see it in their existing dashboard alongside their
other alerts. They should not need to check a separate Scout console.

OpenAI's announcement named the vendor ecosystem. Scout needs to connect to it.

---

## Build Order

```
01-connector-framework.md     Shared connector interface, registry, config UI
02-siem-edr-connectors.md     SentinelOne, CrowdStrike, Microsoft Defender
03-cloud-supply-chain-connectors.md  Wiz, Snyk, Socket, Semgrep
04-ticketing-soar-connectors.md      Jira, ServiceNow, PagerDuty, generic webhook
```

Start with 01 (framework), then 02-04 in parallel.

---

## Architecture

```
Scout Event (prompt_injection, honeypot_triggered, anomaly_spike, kill_activated)
  -> alerts/dispatcher.ts (existing -- dedup, throttle, severity-route)
    -> alerts/siem-connector.ts (NEW -- shared SIEM formatting)
      -> connectors/sentinelone.ts  -> SentinelOne Deep Visibility API
      -> connectors/crowdstrike.ts  -> CrowdStrike Falcon Streaming API
      -> connectors/defender.ts     -> Microsoft Defender for Cloud API
      -> connectors/wiz.ts          -> Wiz Security Graph API
      -> connectors/snyk.ts         -> Snyk REST API
      -> connectors/socket.ts       -> Socket.dev API
      -> connectors/semgrep.ts      -> Semgrep API
      -> connectors/jira.ts         -> Jira REST API
      -> connectors/servicenow.ts   -> ServiceNow Incident API
      -> connectors/pagerduty.ts    -> PagerDuty Events API v2
      -> connectors/generic.ts      -> Generic webhook (JSON POST)
```

Each connector:
1. Receives a Scout finding/alert
2. Maps Scout severity to vendor severity scale
3. Attaches MITRE ATT&CK technique IDs where applicable
4. Pushes via vendor REST API
5. Returns vendor ticket/finding/incident ID for Scout audit trail

---

## Connector Interface

```typescript
// connectors/types.ts
export interface SiemConnector {
  /** Unique connector identifier */
  id: string;
  /** Display name in Scout console */
  name: string;
  /** Vendor category for grouping */
  category: 'siem' | 'edr' | 'cloud' | 'supply-chain' | 'ticketing' | 'soar';
  /** Initialize connection (validate credentials, test reachability) */
  init(config: Record<string, string>): Promise<void>;
  /** Health check -- is the vendor endpoint reachable? */
  health(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
  /** Push a Scout finding to the vendor */
  pushFinding(finding: ScoutFinding): Promise<{ vendorId: string; url?: string }>;
  /** Push a Scout alert to the vendor (immediate, not batched) */
  pushAlert(alert: ScoutAlert): Promise<{ vendorId: string; url?: string }>;
  /** Get vendor-specific status for a previously pushed item */
  getStatus(vendorId: string): Promise<VendorStatus>;
  /** Tear down connection */
  shutdown(): Promise<void>;
}

export interface ScoutFinding {
  id: string;
  type: 'prompt_injection' | 'honeypot_triggered' | 'anomaly_spike' |
        'kill_activated' | 'egress_violation' | 'tool_abuse' |
        'vulnerability' | 'risk_score_change';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  agentId: string;
  sessionId: string;
  timestamp: string; // ISO 8601
  mitreAttackIds: string[]; // e.g. ['T1059', 'T1566']
  evidence: {
    prompt?: string;
    toolCall?: string;
    response?: string;
    sourceIp?: string;
    userAgent?: string;
  };
  remediation?: string;
  riskScore: number; // 0-100
}
```

---

## Done When

- [x] Connector framework (interface, registry, config UI) built
- [x] 11 vendor connectors implemented with health checks
- [x] Alert dispatcher routes to SIEM connectors based on severity
- [x] Vendor IDs stored in Scout findings table for cross-reference
- [x] Ops panel Connectors tab in Settings (`/settings#connectors`) with account picker and per-vendor forms
- [x] Unit tests with mocked vendor HTTP
- [x] Live vendor sandbox harness (`pnpm test:connectors:live` + `connectors.live.json`)
- [x] STIX export includes vendor cross-reference IDs
