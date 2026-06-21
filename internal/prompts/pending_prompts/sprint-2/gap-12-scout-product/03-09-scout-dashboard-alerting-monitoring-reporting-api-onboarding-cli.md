# Scout 03-09; Dashboard, Alerting, Agent Monitoring, Reporting, API, Onboarding, CLI

**Gap:** 12; Scout Product
**Prompts:** 03 through 09
**Agent:** Claude Code / Cursor (run in parallel where dependencies allow)

---

## Post-build (MANDATORY)

When all "Done When" criteria in this prompt are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file (use today's date).
2. Add a "**What was built:**" bullet list of key files or features shipped.
3. Move this file from `carina/internal/prompts/pending_prompts/` to `carina/internal/prompts/archived_prompts/pending_prompts/`, keeping the same relative path. Use `git mv` when possible.
4. If every prompt in this gap folder is COMPLETED, move the whole gap folder and update its `README.md` the same way.
5. Do not leave completed prompts in `pending_prompts/`; agents treat that folder as active work only.

Full checklist: `carina/internal/prompts/pending_prompts/POST-BUILD-CHECKLIST.md`


## Prompt 03: Scout Dashboard (5 days)

The console at `console.labyrinthscout.com` is currently an HTML skeleton. This builds the live dashboard with real data from the engine.

### API endpoints consumed:
- `GET /api/v1/scout-score?workspace_id=X`; score + breakdown
- `GET /api/v1/scout-score/history?workspace_id=X&days=30`; trend chart data
- `GET /api/v1/findings?workspace_id=X&severity=critical&status=open&limit=50`; findings table
- `GET /api/v1/targets?workspace_id=X`; registered targets
- `GET /api/v1/scans?workspace_id=X&limit=20`; recent scan history
- `GET /api/v1/discovered-assets?workspace_id=X`; asset inventory
- `GET /api/v1/compliance/score`; SOC2 coverage (if built)

### Pages to build:

| Page | Route | Content |
|------|-------|---------|
| Dashboard | `/` | Scout Score (large number + trend arrow), breakdown bars (exposure/vulns/compliance/agent), critical findings (top 5), recent scans timeline, quick-action buttons |
| Findings | `/findings` | Filterable table: severity, type, host, port, first seen, last seen, status. Bulk actions (mark false positive, acknowledge). CSV export. |
| Targets | `/targets` | Target list with status (last scan, next scan, finding count). Add target form (domain/IP/URL + schedule). Enable/disable toggle. Manual scan trigger. |
| Assets | `/assets` | Auto-discovered assets: subdomains, IPs, services. Grouped by type. Searchable. Shows which tool discovered each. |
| Scans | `/scans` | Scan history timeline. Each scan shows: target, duration, tools run, findings new/total. Failed scans in red. |
| Compliance | `/compliance` | SOC2 control coverage grid. Auditor export button. Compliance trend chart. (Consumes compliance module from SOC visibility spec.) |
| Settings | `/settings` | Workspace settings. Notification preferences. API keys. Team management. Billing link. |

### Technical requirements:
- React + TypeScript. Reuse the existing console shell.
- Server-side rendering for initial load speed (Next.js or similar).
- All data fetched from Scout API. No mock data. No hardcoded numbers.
- Real-time updates via WebSocket for scan progress (optional; polling every 30s as fallback).
- Mobile responsive; CISO checks dashboard from phone.
- Dark theme (indigo + amber Scout palette).

### Key component: Scout Score Widget
```
┌─────────────────────────────────────────┐
│                                         │
│           YOUR SCOUT SCORE              │
│                87                       │
│              ▲ +2 this week             │
│                                         │
│   Exposure    Vulns    Compliance Agent │
│   ████████    ██████   ██████████ ████  │
│      92        78         100      85   │
│                                         │
│   0 critical  2 high  5 medium  12 low  │
└─────────────────────────────────────────┘
```

### Key component: Findings Table
```
Findings  │  Severity: [All ▼]  Type: [All ▼]  Status: [Open ▼]  Search: [_____]

┌──────────────────────────────────────────────────────────────────────────┐
│  CRI  CVE-2026-1844  nginx:8443   Remote Code Execution   CVSS 9.8    │
│        api.example.com              First seen: Jun 15  Last: Jun 19    │
│        [Remediate] [False Positive] [Acknowledge]                        │
├──────────────────────────────────────────────────────────────────────────┤
│  HIGH  OpenSSH 7.4   app:22       Vulnerable version        CVSS 7.5  │
│        app.example.com              First seen: Jun 12  Last: Jun 19    │
│        [Remediate] [False Positive] [Acknowledge]                        │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Prompt 04: Alerting Pipeline (4 days)

Users don't check dashboards. Scout must reach them when something happens.

### Alert channel types:
1. **Email**; SMTP via existing mail config
2. **Push notification**; Firebase/APNs to Carina mobile app
3. **Webhook**; POST JSON to user-configured URL (Slack, Discord, PagerDuty, custom)
4. **In-app**; Notification bell in Scout dashboard

### Alert rules engine:

```typescript
// scout-engine/src/alerts/rules.ts

interface AlertRule {
  id: string;
  workspaceId: string;
  name: string;
  trigger: {
    event: 'finding_new' | 'finding_severity_change' | 'score_drop' | 'scan_failed' | 'agent_suspicious';
    conditions?: {
      minSeverity?: 'critical' | 'high' | 'medium';
      minScoreDrop?: number;
      findingTypes?: string[];
    };
  };
  channels: ('email' | 'push' | 'webhook')[];
  config: {
    email?: string;
    webhookUrl?: string;
    webhookSecret?: string;
  };
  enabled: boolean;
  cooldownMinutes: number; // Don't re-alert for same finding within cooldown
}
```

### Default alert rules (auto-created per workspace):
1. Critical finding → email + push (instant)
2. High finding → email (digest every 4 hours)
3. Score drops 5+ points → email + push (instant)
4. Scan fails → email (instant)
5. Suspicious agent activity → email + push (instant)

### Alert delivery:

```typescript
// scout-engine/src/alerts/delivery.ts

async function deliverAlert(rule: AlertRule, finding: Finding, score?: ScoreBreakdown): Promise<void> {
  for (const channel of rule.channels) {
    switch (channel) {
      case 'email':
        await sendEmail({
          to: rule.config.email,
          subject: `Scout Alert: ${finding.severity.toUpperCase()}; ${finding.title}`,
          html: buildAlertEmail(finding, score),
        });
        break;
      case 'push':
        await sendPush({
          userId: rule.workspaceId,
          title: `Scout: ${finding.severity.toUpperCase()} Finding`,
          body: finding.title.slice(0, 100),
          data: { findingId: finding.id, url: `/findings/${finding.id}` },
        });
        break;
      case 'webhook':
        await fetch(rule.config.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Scout-Signature': signPayload(rule.config.webhookSecret, payload) },
          body: JSON.stringify({ event: 'finding_new', finding, score }),
        });
        break;
    }
  }
}
```

### Alert suppression:
- Per-finding cooldown: don't re-alert for the same finding within cooldown window
- Digest mode: non-critical alerts batched into periodic digest emails
- Mute: user can mute a specific finding or target for a configurable duration
- Do Not Disturb: workspace-level DND schedule (e.g., no alerts between 10 PM and 7 AM)

### Database:

```sql
CREATE TABLE IF NOT EXISTS alert_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  trigger JSONB NOT NULL,
  channels TEXT[] NOT NULL,
  config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  rule_id UUID REFERENCES alert_rules(id),
  finding_id UUID REFERENCES findings(id),
  channel TEXT NOT NULL,
  delivered BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Prevent duplicate alerts within cooldown
CREATE UNIQUE INDEX IF NOT EXISTS idx_alert_cooldown
  ON alert_history(finding_id, rule_id)
  WHERE created_at > NOW() - INTERVAL '1 hour';
```

---

## Prompt 05: Agent Monitoring (5 days)

Scout's unique differentiator: it monitors AI agent activity, not just servers.

### What to build:

**1. Agent connection protocol:**
- Agents register with Scout via API key
- Agent sends heartbeat every 30 seconds (WebSocket or HTTP)
- Agent streams tool execution events to Scout
- Scout analyzes events for suspicious patterns

**2. Agent event schema:**

```typescript
interface AgentEvent {
  agentId: string;
  agentType: string; // 'carina' | 'external-agent' | 'goal-result'
  workspaceId: string;
  eventType: 'tool_start' | 'tool_complete' | 'tool_error' | 'approval_request' | 'approval_granted' | 'approval_denied' | 'session_start' | 'session_end';
  toolName?: string;
  toolArgs?: Record<string, unknown>;
  toolResult?: unknown;
  duration?: number;
  sessionId?: string;
  timestamp: string;
}
```

**3. Suspicious behavior detection:**

| Pattern | Trigger | Severity |
|---------|---------|----------|
| Rapid tool execution | >10 tools in 60 seconds | medium |
| Dangerous tool in unusual hours | Metasploit at 3 AM | high |
| Exfiltration pattern | curl/wget to unknown IP + file read | critical |
| Credential access | Mimikatz, secret dump, .env read | critical |
| Lateral movement | Multiple SSH/RDP connections in sequence | high |
| Approval override | Operator approved a tool flagged as dangerous | medium |
| First-time dangerous tool | Agent using a tool it's never used before | low |

**4. Policy enforcement (optional; Vectimus-like):**
- Block specific tools by agent type
- Require approval for tools matching patterns
- Rate limit tool execution
- Alert on policy violation

**5. Agent dashboard panel:**
- Connected agents list with status (online/offline)
- Real-time event stream (WebSocket → live updating)
- Suspicious activity feed
- Tool usage statistics (most used tools, most active agents)
- Agent comparison (Scout Score per agent)

### API:
- `POST /api/v1/agents/events`; agent pushes events to Scout
- `GET /api/v1/agents`; list connected agents
- `GET /api/v1/agents/:id/events`; event history
- `GET /api/v1/agents/:id/findings`; findings from this agent's activity

### Database:

```sql
CREATE TABLE IF NOT EXISTS connected_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  agent_type TEXT NOT NULL,
  name TEXT NOT NULL,
  api_key_hash TEXT NOT NULL,
  last_heartbeat TIMESTAMP,
  status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'suspended')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES connected_agents(id),
  workspace_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  tool_name TEXT,
  tool_args JSONB,
  tool_result JSONB,
  duration_ms INTEGER,
  session_id TEXT,
  occurred_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_events_workspace ON agent_events(workspace_id, occurred_at DESC);
```

---

## Prompt 06: Reporting Engine (3 days)

Automated reports. PDF and HTML. Scheduled. Executive summary + technical appendix.

### Report types:
1. **Weekly Security Summary**; Scout Score, findings delta, top 5 vulnerabilities, remediation progress
2. **Monthly Compliance Report**; SOC2 control coverage, auditor-ready evidence summary
3. **Quarterly Board Report**; Trend charts, peer comparison, incident summary, risk matrix
4. **Ad-hoc Report**; User selects date range and findings to include

### Report generation:

```typescript
// scout-engine/src/reports/generator.ts

async function generateReport(
  workspaceId: string,
  type: 'weekly' | 'monthly' | 'quarterly' | 'custom',
  dateRange: { start: string; end: string },
): Promise<{ html: string; pdf: Buffer }> {
  const scoreHistory = await getScoreHistory(workspaceId, dateRange);
  const findings = await getFindings(workspaceId, dateRange);
  const scans = await getScans(workspaceId, dateRange);
  const compliance = await getComplianceData(workspaceId);

  const html = renderReportTemplate({
    type,
    dateRange,
    scoreHistory,
    findings,
    scans,
    compliance,
    workspaceName: await getWorkspaceName(workspaceId),
  });

  const pdf = await htmlToPdf(html);

  return { html, pdf };
}
```

### Report scheduling:
- Weekly: Every Monday 08:00
- Monthly: 1st of month 08:00
- Quarterly: 1st of Jan/Apr/Jul/Oct 08:00
- Delivered via email. PDF attached. HTML in body.

### API:
- `POST /api/v1/reports/generate`; generate ad-hoc report
- `GET /api/v1/reports`; list generated reports
- `GET /api/v1/reports/:id/download`; download PDF
- `PUT /api/v1/reports/schedule`; configure report schedule

---

## Prompt 07: Scout API (4 days)

REST API for Carina integration and third-party tools.

### API structure:
```
POST   /api/v1/auth/login              Email + password → JWT
POST   /api/v1/auth/api-key            Generate API key
GET    /api/v1/workspace                Current workspace info

GET    /api/v1/scout-score              Current score + breakdown
GET    /api/v1/scout-score/history      Score time-series

POST   /api/v1/targets                  Register new scan target
GET    /api/v1/targets                  List targets
GET    /api/v1/targets/:id              Target details
PUT    /api/v1/targets/:id              Update target
DELETE /api/v1/targets/:id              Remove target
POST   /api/v1/targets/:id/scan         Trigger manual scan

GET    /api/v1/findings                 Query findings (severity, type, status filters)
GET    /api/v1/findings/:id             Finding details
PUT    /api/v1/findings/:id             Update status (remediated, false_positive)

GET    /api/v1/scans                    Scan history
GET    /api/v1/scans/:id                Scan details + tool executions

GET    /api/v1/discovered-assets        Asset inventory

POST   /api/v1/agents/events            Agent pushes tool events (API key auth)
GET    /api/v1/agents                   List connected agents
GET    /api/v1/agents/:id/events        Agent event stream

GET    /api/v1/compliance/score         SOC2 compliance score
POST   /api/v1/compliance/export        Generate auditor evidence package

GET    /api/v1/reports                  List reports
POST   /api/v1/reports/generate         Generate report
GET    /api/v1/reports/:id/download     Download report PDF

POST   /api/v1/alerts/rules             Create alert rule
GET    /api/v1/alerts/rules             List alert rules
PUT    /api/v1/alerts/rules/:id         Update alert rule
DELETE /api/v1/alerts/rules/:id         Delete alert rule

GET    /api/v1/webhooks                 List configured webhooks
POST   /api/v1/webhooks                 Create webhook
DELETE /api/v1/webhooks/:id             Delete webhook
```

### Authentication:
- JWT for dashboard users (email + password)
- API key for programmatic access (Carina, third-party tools)
- API keys are scoped to workspace + have permission levels (read, write, admin)
- Rate limiting: 100 req/min for API keys, 1000 req/min for dashboard users

### API documentation:
- OpenAPI 3.0 spec at `/api/docs`
- Auto-generated from route definitions
- Swagger UI at `/api/docs/ui`

---

## Prompt 08: Scout Onboarding (3 days)

Users who don't complete onboarding churn. Must be dead simple.

### Onboarding flow:

```
Step 1: Sign up (email + password OR Google OAuth)
  Time: 30 seconds

Step 2: "What do you want Scout to monitor?"
  ┌──────────────────────────────────────────┐
  │  Add your first domain or IP to scan.    │
  │                                          │
  │  [  example.com                     ]    │
  │                                          │
  │  Scout will:                             │
  │  • Discover subdomains                   │
  │  • Scan for open ports                   │
  │  • Check for known CVEs                  │
  │  • Find exposed services                 │
  │                                          │
  │  [Start Scanning]                        │
  └──────────────────────────────────────────┘

Step 3: Scanning in progress (live progress)
  ┌──────────────────────────────────────────┐
  │  Scanning example.com...                 │
  │                                          │
  │  ████████████░░░░░░░░  6/25 tools       │
  │                                          │
  │   nmap; found 3 open ports            │
  │   amass; found 7 subdomains           │
  │  ⟳ nuclei; checking 2,000+ CVEs       │
  │  ○ nikto; queued                        │
  │                                          │
  │  [Your first Scout Score will appear     │
  │   when scanning is complete]             │
  └──────────────────────────────────────────┘

Step 4: Results (scan complete)
  ┌──────────────────────────────────────────┐
  │  Your Scout Score: 72                    │
  │                                          │
  │  We found:                               │
  │  • 3 open ports (22, 80, 443)           │
  │  • 7 subdomains (2 unknown to you)       │
  │  • 1 critical CVE (nginx, CVSS 9.8)     │
  │  • 2 expired SSL certificates            │
  │                                          │
  │  What to do first:                       │
  │  1. Patch the critical CVE on nginx     │
  │  2. Investigate the 2 unknown subdomains │
  │  3. Renew SSL certificates               │
  │                                          │
  │  [Go to Dashboard]                       │
  └──────────────────────────────────────────┘

Step 5: "Stay informed"
  ┌──────────────────────────────────────────┐
  │  How should Scout reach you?             │
  │                                          │
  │   Email alerts for critical findings   │
  │   Push notifications to your phone     │
  │   Weekly summary report                │
  │                                          │
  │  [Finish Setup]                          │
  └──────────────────────────────────────────┘
```

### Technical:
- Onboarding is a single-page React app with step progression
- Scan progress uses WebSocket for live updates
- First scan uses a fast subset of tools (10 tools, 2 minutes) to get immediate results
- Full scan runs in background after onboarding completes
- Onboarding completion triggers welcome email with summary

---

## Prompt 09: Scout CLI (2 days)

Power users need terminal access. `carina scout` commands.

### Commands:

```bash
# Connection
carina scout connect                # Authenticate with Scout API
carina scout status                 # Show connection status + current Scout Score

# Targets
carina scout targets list           # List registered targets
carina scout targets add <domain>   # Register a new target (--schedule daily|weekly|monthly)
carina scout targets remove <id>    # Remove a target
carina scout targets scan <id>      # Trigger manual scan

# Findings
carina scout findings               # List recent findings (--severity critical|high|medium|low)
carina scout findings <id>          # Show finding details
carina scout findings acknowledge <id>    # Acknowledge finding
carina scout findings remediate <id>      # Mark as remediated

# Score
carina scout score                  # Show current Scout Score + breakdown
carina scout score history          # Show score trend (--days 30|90|180)

# Reports
carina scout report generate        # Generate ad-hoc report (--type weekly|monthly)
carina scout report list            # List available reports
carina scout report download <id>   # Download report PDF

# Agents
carina scout agents list            # List connected agents
carina scout agents events <id>     # Show agent event stream

# Alerts
carina scout alerts list            # List configured alert rules
carina scout alerts test            # Send test alert

# Compliance
carina scout compliance             # Show SOC2 compliance status
carina scout compliance export      # Export auditor evidence package
```

### Implementation:
- Add `src/cli/commands/scout.ts` to Carina core
- Commands call Scout API via HTTP client
- Output formatted for terminal (tables, colors, severity icons)
- `carina scout connect` stores API key in `~/.carina/scout.json`

---

## Files Summary (Prompts 03-09)

```
# Dashboard (prompt 03)
console.labyrinthscout.com/
  src/pages/Dashboard.tsx
  src/pages/Findings.tsx
  src/pages/Targets.tsx
  src/pages/Assets.tsx
  src/pages/Scans.tsx
  src/pages/Compliance.tsx
  src/pages/Settings.tsx
  src/components/ScoutScoreWidget.tsx
  src/components/FindingsTable.tsx

# Alerting (prompt 04)
scout-engine/src/alerts/rules.ts
scout-engine/src/alerts/delivery.ts
scout-engine/src/alerts/digest.ts
scout-engine/src/db/migrations/003-alerts.sql

# Agent Monitoring (prompt 05)
scout-engine/src/agents/event-ingest.ts
scout-engine/src/agents/suspicious-detector.ts
scout-engine/src/agents/policy-engine.ts
scout-engine/src/db/migrations/004-agents.sql

# Reporting (prompt 06)
scout-engine/src/reports/generator.ts
scout-engine/src/reports/templates/
scout-engine/src/reports/scheduler.ts

# API (prompt 07)
scout-engine/src/api/ (all endpoint files)
scout-engine/src/api/docs/openapi.yaml

# Onboarding (prompt 08)
console.labyrinthscout.com/src/pages/Onboarding.tsx

# CLI (prompt 09)
core.carinaai.uk/src/cli/commands/scout.ts
```

---

## Done-When Criteria (All Prompts)

- [ ] Dashboard loads real data from Scout API; score, findings, targets, scans
- [ ] Findings table is filterable, sortable, and supports bulk actions
- [ ] Critical finding triggers email + push notification within 60 seconds
- [ ] Alert rules are configurable per workspace
- [ ] Agent connects to Scout, streams events, suspicious behavior generates findings
- [ ] Weekly report generates automatically and emails to workspace owner
- [ ] All API endpoints return correct data with proper auth
- [ ] OpenAPI spec is accurate and Swagger UI is functional
- [ ] Onboarding flow completes in <5 minutes with real scan results
- [ ] `carina scout score` returns real score from Scout API
- [ ] `carina scout findings --severity critical` returns real findings
- [ ] Zero hardcoded prices. Zero mock data in production paths.
