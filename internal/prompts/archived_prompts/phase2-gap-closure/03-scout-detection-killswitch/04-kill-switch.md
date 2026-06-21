# Phase 2.11; Kill Switch

## Goal
Build Scout's kill switch; the emergency stop for all agent processes. One button on the Scout dashboard immediately terminates all active agents, blocks new tool execution, and alerts all channels. This is the most visible Scout feature on both websites.

## Files to create
```
packages/scout/src/
  killswitch/
    kill-switch.ts; Core kill switch logic
    kill-switch-api.ts; Trigger/status endpoints
    graceful-shutdown.ts; Safe process termination
    kill-switch-audit.ts; Every activation logged immutably
```

## How it works

### 1. ARM/DISARM states
```
ARMED:    Kill switch is ready. One click away from stopping everything.
TRIGGERED: Kill switch activated. All agents stopped. Cannot be disarmed remotely.
```

Only the Scout dashboard admin can trigger it. Nobody can disarm it except physically on the server.

### 2. When triggered
```
Phase 1 (0-1 seconds): 
  - All new tool calls rejected immediately
  - All new chat requests return: "Carina is temporarily unavailable."
  
Phase 2 (1-3 seconds):
  - All running tool calls receive SIGTERM
  - Active conversations: agent sends "Emergency stop activated. Session ending."
  - All WebSocket connections closed
  
Phase 3 (3-5 seconds):
  - Stubborn processes receive SIGKILL
  - All agent state persisted to database
  - Audit log: "KILL SWITCH TRIGGERED at 2026-06-07 14:35:22 by laud@carinaai.uk"
  
Phase 4 (5+ seconds):
  - CRITICAL alert sent to all configured channels
  - Dashboard shows: "KILL SWITCH ACTIVATED"
  - Status page updated (if external status page exists)
```

### 3. What gets stopped
- All active chat sessions (across all tenants)
- All running tool executions
- All scheduled cron jobs (paused, not deleted)
- All background processes
- All subagent tasks
- All WebSocket connections

### 4. What does NOT get stopped
- Scout monitoring (still watching for why the switch was triggered)
- Database (data integrity preserved)
- Web server (still serves the "unavailable" page)
- API (still responds with "temporarily unavailable")

### 5. Recovery
Kill switch cannot be disarmed remotely. Recovery requires:
```bash
# On the server:
carina scout disarm --reason "Threat resolved; injection attack contained" --admin laud@carinaai.uk
```

This ensures an attacker who compromises the dashboard cannot simply toggle the kill switch off.

## Dashboard widget
```
┌─────────────────────────────────┐
│  KILL SWITCH                   │
│                                  │
│ Status: ARMED                    │
│ All 47 agents operational        │
│                                  │
│ [EMERGENCY STOP; KILL ALL]     │
│                                  │
│ WARNING:  This will immediately stop    │
│ all agent processes. Cannot be   │
│ reversed from dashboard.         │
│                                  │
│ Admin password: [________]       │
│ Reason: [___________________]    │
│                                  │
│ [CONFIRM EMERGENCY STOP]         │
└─────────────────────────────────┘
```

After triggering:
```
┌─────────────────────────────────┐
│  KILL SWITCH; ACTIVATED       │
│                                  │
│ Triggered: 2026-06-07 14:35:22  │
│ By: laud@carinaai.uk             │
│ Reason: Injection attack bypass  │
│ Agents stopped: 47               │
│ Time to stop: 2.3 seconds        │
│                                  │
│ Recovery requires server access. │
│ SSH: carina scout disarm         │
└─────────────────────────────────┘
```

## Audit record
```json
{
  "event": "kill_switch_triggered",
  "timestamp": "2026-06-07T14:35:22Z",
  "triggered_by": "laud@carinaai.uk",
  "reason": "Injection attack bypassed all 3 layers on tenant-34",
  "agents_stopped": 47,
  "stop_duration_ms": 2300,
  "affected_tenants": 47,
  "alerts_sent": {
    "telegram": true,
    "email": true,
    "sms": true,
    "dashboard": true
  }
}
```

## Verification
```bash
# 1. Check kill switch status
curl /api/admin/scout/killswitch/status
# Expected: { armed: true, agents_active: 47 }

# 2. Trigger kill switch
curl -X POST /api/admin/scout/killswitch/trigger \
  -d '{"password": "***", "reason": "Test trigger"}'
# Expected: { triggered: true, agents_stopped: 47, duration_ms: 2300 }

# 3. Verify agents stopped
curl /api/admin/scout/killswitch/status
# Expected: { armed: false, triggered: true, triggered_by: "laud@carinaai.uk" }

# 4. Attempt to disarm remotely
curl -X POST /api/admin/scout/killswitch/disarm
# Expected: 403; "Disarm requires server access. SSH: carina scout disarm"

# 5. Verify alerts sent
# Check Telegram, email, SMS for critical alert
```
