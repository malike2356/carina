# Security 12; Unified Security Operations Dashboard

**Source:** NEW (Consolidates all Carina security systems into one view)
**Effort:** 2 weeks

---

## SPECIFICATION

A single security operations dashboard that consolidates ALL Carina security systems: RASP, forensics, compliance, supply chain, red team, governance, trust, and Scout. Built as a Next.js page in the web UI and a TUI view.

### Dashboard Layout (Web UI)

```
┌──────────────────────────────────────────────────────────────────┐
│    SECURITY OPERATIONS                           Last updated: 2s ago │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────┐ │
│  │ THREAT   │ │ ACTIVE   │ │ TRUST    │ │ INCIDENTS│ │RASP   │ │
│  │ LEVEL    │ │ THREATS  │ │ SCORE    │ │ THIS WEEK│ │STATUS │ │
│  │          │ │          │ │          │ │          │ │       │ │
│  │        │ │    2     │ │  87/100  │ │    5     │ │ACTIVE │ │
│  │  LOW     │ │      │ │  ●●●●○   │ │  ↓12%    │ │       │ │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┘ │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │   REAL-TIME THREAT MAP                                     │ │
│  │  ┌──────────────────────────────────────────────────────┐    │ │
│  │  │  [Prompt Injection] ──→ [BLOCKED]  agent:coding-3    │    │ │
│  │  │  [Tool Sequence]    ──→ [MONITOR]  agent:research-1  │    │ │
│  │  │  [Trust Drop]       ──→ [ALERT]    agent:carina-main │    │ │
│  │  └──────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌──────────────────────┐ ┌──────────────────────────────────┐  │
│  │   TRUST OVER TIME   │ │    COMPLIANCE STATUS           │  │
│  │  [Line chart: 30d]    │ │  SOC 2     ████████████░  94%   │  │
│  │                       │ │  ISO 27001 ███████████░░░  88%  │  │
│  │  Current: 87/100 ↑    │ │  GDPR      ██████████████ 100%  │  │
│  └──────────────────────┘ └──────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐ ┌──────────────────────────────────┐  │
│  │   RECENT INCIDENTS  │ │   RED TEAM RESULTS             │  │
│  │  • Prompt injection   │ │  Last run: 4h ago                 │  │
│  │    Blocked · 2m ago   │ │  Passed: 18/20 (90%)              │  │
│  │  • Unusual sequence   │ │  Critical gaps: 0                 │  │
│  │    Monitoring · 15m   │ │  [ Run Now ]  [ View Report ]     │  │
│  │  • Trust score drop   │ │                                   │  │
│  │    Investigating · 1h │ │                                   │  │
│  └──────────────────────┘ └──────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────┐ ┌──────────────────────────────────┐  │
│  │   SUPPLY CHAIN      │ │   SECRETS STATUS               │  │
│  │  Dependencies: 247    │ │  Active: 12                       │  │
│  │  Vulnerabilities: 0   │ │  Expiring soon: 1 (3d)           │  │
│  │  SBOM: Generated 2h   │ │  Stale: 0                        │  │
│  │  [ Scan Now ]         │ │  [ Rotate All ]                  │  │
│  └──────────────────────┘ └──────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │   QUICK ACTIONS                                             │ │
│  │  [Run Pen Test] [Collect Compliance] [Generate SBOM]         │ │
│  │  [Rotate Secrets] [Run Red Team] [Export Forensics]          │ │
│  │  [Activate Kill Switch] ← behind confirmation                │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### TUI View

```
┌─ SECURITY DASHBOARD ───────────────────────────────────────────┐
│                                                                │
│  Threat Level:  LOW     Trust: 87/100     RASP: ACTIVE       │
│  Active Threats: 2    Incidents: 5/wk    Scout:  ARMED   │
│                                                                │
│  ┌─ Real-time Events ──────────────────────────────────────┐   │
│  │  12:34:56  BLOCKED   Prompt injection    agent:coding-3 │   │
│  │  12:32:11  MONITOR   Tool sequence       agent:research │   │
│  │  12:15:43  ALERT     Trust drop (-12)     agent:main    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌─ Compliance ────────────────────────────────────────────┐   │
│  │  SOC 2: 94% ████████████░   ISO: 88% ███████████░░░     │   │
│  │  GDPR: 100% ██████████████                              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                │
│  Press /search to filter    Tab to switch panel                │
│  :pentest :redteam :forensics :compliance :secrets              │
└────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// security/dashboard/api.ts

// GET /api/security/dashboard; returns all dashboard data
interface SecurityDashboardData {
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  activeThreats: number;
  trustScore: number;
  incidentsThisWeek: number;
  incidentsTrend: number; // % change from last week
  raspStatus: 'active' | 'degraded' | 'offline';
  realTimeEvents: SecurityEvent[];
  complianceStatus: ComplianceStatus;
  supplyChainHealth: SupplyChainHealth;
  secretsStatus: SecretsStatus;
  redTeamResults: RedTeamSummary;
  recentIncidents: ForensicIncident[];
}

// WebSocket for real-time updates
// ws://localhost:8080/api/security/dashboard/stream
```

### Page Route

```
app/(workspace)/security/page.tsx; Security dashboard page
Added to sidebar: " Security" → /security (gated behind admin/security_admin role)
```
