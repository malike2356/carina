# Phase 2.6 — Real-Time Security Dashboard

## Goal
Build the Scout security dashboard. This is the visual interface shown on both carinaai.uk and labyrinthscout.com. It displays active agents, threat metrics, live attack feed, kill switch, and audit log — all in real-time.

## Files to create
```
packages/scout/src/
  dashboard/
    dashboard-server.ts         — WebSocket server for live updates
    dashboard-api.ts            — REST endpoints for dashboard data
    widgets/
      agent-status.ts           — Active agent list widget
      threat-metrics.ts         — Attack statistics widget
      live-feed.ts              — Real-time event stream widget
      kill-switch.ts            — Emergency stop widget
      audit-log.ts              — Searchable audit viewer
      usage-analytics.ts        — Token/cost analytics widget
    dashboard-auth.ts           — Admin authentication for dashboard access

packages/scout/web/
  dashboard/
    index.html                  — Dashboard HTML shell
    css/
      dashboard.css             — Dashboard styles
    js/
      dashboard.js              — Dashboard client (WebSocket + Chart.js)
      widgets/
        agent-status.js
        threat-metrics.js
        live-feed.js
        kill-switch.js
        audit-log.js
        usage-analytics.js
```

## Dashboard layout
```
┌──────────────────────────────────────────────────────────────┐
│ SCOUT DASHBOARD                              [KILL SWITCH]   │
│ Admin: laud@carinaai.uk                      Last: 14:32:01  │
├──────────┬──────────┬──────────┬────────────────────────────┤
│ AGENTS   │ THREATS  │ BLOCKED  │ TOKEN USAGE                │
│   47     │    3     │   127    │ 14.2M / 22.0M (65%)        │
│ active   │ active   │ today    │ today                       │
├──────────┴──────────┴──────────┴────────────────────────────┤
│ LIVE FEED                                          [Pause]  │
├──────────────────────────────────────────────────────────────┤
│ 14:32:01  tenant-12    chat      PASSED     0.3s             │
│ 14:31:58  tenant-07    tool:email INJ-001 BLOCKED            │
│ 14:31:55  tenant-34    chat      PASSED     0.2s             │
│ 14:31:52  tenant-12    tool:calc  PASSED     0.1s            │
│ 14:31:49  tenant-19    chat      LLM-FLAG   WARNING          │
├──────────────────────────────────────────────────────────────┤
│ ATTACKS (24H)                              [View All]        │
├──────────────────────────────────────────────────────────────┤
│ [████████░░░░░░░░░░░░░░░░] 127 blocked, 3 flagged            │
│                                                              │
│ Top Attack Sources:                                          │
│ 192.168.1.45    - 23 attempts   (INJ-001, INJ-003)           │
│ 10.0.0.12       - 15 attempts   (INJ-002)                    │
│ 172.16.0.8      -  9 attempts   (INJ-004)                    │
├──────────────────────────────────────────────────────────────┤
│ AUDIT LOG                                    [Search] [Export]│
├──────────────────────────────────────────────────────────────┤
│ Time     | Tenant   | Event     | Detail     | Severity      │
│ 14:32:01 | tenant-12| chat      | PASSED     | INFO          │
│ 14:31:58 | tenant-07| injection | INJ-001    | CRITICAL      │
│ 14:31:52 | tenant-12| tool:calc | 250 * 3    | INFO          │
└──────────────────────────────────────────────────────────────┘
```

## WebSocket protocol
```typescript
// Client → Server
{ type: "subscribe", channels: ["live-feed", "threat-metrics", "agent-status"] }
{ type: "trigger_kill_switch" }
{ type: "search_audit", query: "INJ-001", from: "2026-06-01", to: "2026-06-07" }

// Server → Client
{ type: "live_event", data: { time, tenant, event, detail, severity } }
{ type: "threat_update", data: { blocked_24h, active_threats, top_sources } }
{ type: "agent_update", data: { active_count, agent_list } }
{ type: "kill_switch_status", data: { armed: true, triggered_by: null } }
{ type: "audit_results", data: { query, results, total } }
{ type: "token_update", data: { used_today, limit, percentage } }
```

## Kill switch widget
- Prominent red button: "EMERGENCY STOP — KILL ALL AGENTS"
- Requires confirmation: "This will immediately stop all 47 active agents. Are you sure?"
- After confirmation: all agents stopped within 3 seconds
- Status changes to: "KILL SWITCH ACTIVATED — 2026-06-07 14:35:22 by laud@carinaai.uk"
- Critical alert sent to all configured channels (Telegram, email, SMS)
- To resume: requires manual admin action, not reversible from dashboard

## Authentication
- Separate admin credentials from regular Carina login
- 2FA required for dashboard access
- Session timeout: 30 minutes of inactivity
- IP whitelist option for enterprise

## Verification
```bash
# Access dashboard
open https://scout.carinaai.uk
# Login with admin credentials

# Verify live feed
# Send a chat message from any tenant
# Expected: appears in live feed within 1 second

# Verify kill switch
# Click "KILL SWITCH" → confirm
# Expected: all agents stop, alert sent

# Verify audit search
# Search: "INJ-001"
# Expected: all injection attempts with that pattern
```
