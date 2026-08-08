# C04: Scout-Keprix Connector

**Status: COMPLETED 2026-08-07**

**What was built:**
- `scout-engine/config/targets.yaml` + env (`KEPRIX_URL`, `KEPRIX_SCOUT_KILL_TOKEN`, `SCOUT_TARGETS_CONFIG`)
- Migration `010-runtime-targets.sql` for Keprix/carina/generic runtime targets
- `src/integrations/keprix-connector.ts` (kill/resume/status/sensors, channel kill, dashboard status)
- Admin API: `GET/POST /api/admin/targets`, `POST /api/admin/targets/channel-kill`
- Dashboard API: `/api/dashboard/keprix/status`, `/runtime-targets`, killswitch/resume propagate to Keprix (<=2s)
- Agent register upserts `runtime_targets` when `type=keprix`
- Alert rule `keprix_agent_anomaly` + event ingest evaluation (`alerts/keprix-anomaly.ts`)
- Dashboard overview widget for Keprix health/sessions/filter/kill status
- Tests: `src/integrations/keprix-connector.test.ts` (19 suite tests pass including connector)

**Phase:** 3 (Security)
**Priority:** P0
**Depends on:** K06 (Scout integration on Keprix), C01 (proxy working)
**Target time:** 6 hours
**Location:** Carina (Scout)

## What This Builds

The Scout-side connector that registers Keprix as a monitored target. Scout can now see Keprix agent activity, run security scans, and trigger kill switches that propagate to Keprix.

## Architecture

```
Scout Dashboard
  -> Registers Keprix as target
  -> POST /keprix/filter (prompt check)
  -> POST /keprix/kill (kill switch propagation)
  -> GET /keprix/health (heartbeat)

Scout Warden
  -> Schedules scans against Keprix
  -> Correlates Keprix events with other targets

Scout Alerts
  -> Telegram/WhatsApp/Slack alerts include Keprix events
  -> Channel kill commands route to Keprix
```

## Scout-Side Configuration

### File: `scout-engine/config/targets.yaml`

```yaml
targets:
  keprix:
    type: keprix
    url: http://localhost:8333
    auth_token: ${CARINA_KEPRIX_SHARED_TOKEN}
    health_check_interval: 15s
    prompt_filter_enabled: true
    kill_switch_enabled: true
    sensors:
      - keprix_prompt_sensor
      - keprix_tool_sensor
      - keprix_token_sensor
      - keprix_session_sensor
```

## Scout Registration Endpoint

### File: `scout-engine/src/api/admin/targets.ts`

```typescript
POST /scout/admin/targets
{
  "name": "keprix-aiva",
  "type": "keprix",
  "url": "http://localhost:8333",
  "auth_token": "***",
  "workspace_id": "ws_abc123"
}
```

## Kill Switch Propagation

When Scout kills a workspace, it must propagate to Keprix:

```typescript
// In Scout's kill switch handler
async function killWorkspace(workspaceId: string): Promise<void> {
    // 1. Kill in Scout's own records
    await scoutDb.suspendWorkspace(workspaceId);
    
    // 2. Propagate to Keprix if workspace uses Keprix engine
    const targets = await getTargetsForWorkspace(workspaceId);
    for (const target of targets) {
        if (target.type === 'keprix') {
            await fetch(`${target.url}/keprix/kill`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${target.auth_token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    workspace_id: work...: 'scout',
                    reason: 'Operator-initiated kill from Scout dashboard',
                }),
            });
        }
    }
}
```

## Channel Kill Switch Routing

Telegram/WhatsApp kill commands already route through Scout's messaging gateway. Add Keprix as a target:

```typescript
// In Scout's control handler
async function handleChannelKill(chatId: string, command: string): Promise<void> {
    const operator = await getOperatorByChatId(chatId);
    const workspaceId = operator.workspace_id;
    
    // Kill in Scout
    await killWorkspace(workspaceId);
    
    // Propagate to Keprix
    await propagateKillToKeprix(workspaceId, {
        activated_by: 'channel',
        channel: operator.channel,  // 'telegram', 'whatsapp'
        command: command,            // '/kill', '/freeze'
        operator_id: operator.id,
    });
    
    // Confirm to operator
    await sendMessage(chatId, `Workspace ${workspaceId} halted. Audit: K-${Date.now()}`);
}
```

## Scout Dashboard Updates

### New Dashboard Widget: Keprix Agent Status

Shows:
- Keprix health (green/red)
- Active agent sessions
- Prompt filter stats (passed/blocked/flagged)
- Tool execution stats
- Kill switch status

### New Alert Rule: Keprix Agent Anomaly

```yaml
alert:
  name: keprix_agent_anomaly
  condition: keprix_prompt_blocked_count > 5 in 5m
  severity: high
  notify: [telegram, dashboard]
```

## Acceptance Criteria

- [x] Keprix registered as Scout target
- [x] Scout dashboard shows Keprix agent status
- [x] Kill switch from Scout propagates to Keprix within 2 seconds
- [x] Channel kill commands (Telegram /kill) halt Keprix agent execution
- [x] Scout Warden sensors scan Keprix activity
- [x] Alerts fire for Keprix anomalies (prompt injection, tool abuse)
- [x] Keprix events appear in Scout audit log alongside Carina events
