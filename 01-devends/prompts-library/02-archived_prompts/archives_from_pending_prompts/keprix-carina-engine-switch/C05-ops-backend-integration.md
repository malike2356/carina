# C05: Carina OPS Backend Integration with Keprix

**Status: COMPLETED 2026-08-07**

**What was built:**
- Core: `src/ops/agent-engine/` store/service/Keprix client/PHP bridge/alerts + `/api/ops/agent-engine/*` routes (health, config, workspaces switch, emergency rollback, deploy, logs, kill-notify)
- Aiva PHP: `AgentEngineAdminController` with OPS bearer auth (`AIVA_OPS_ENGINE_TOKEN` / `CARINA_OPS_TOKEN`) for config/workspaces/switch-all/health
- OPS UI: `/agent-engine` page (status, config, workspace table, deploy, emergency rollback, logs) + nav under AI; audits via `writeOpsAudit`
- Tests: Core `ops-agent-engine-routes.test.ts` (6 passed), OPS `routes/agent-engine.test.ts` (1 passed), PHP unit scaffold for admin controller

**Phase:** 3 (Security/OPS)
**Priority:** P1
**Depends on:** C01, K01 (proxy + Keprix running)
**Target time:** 6 hours
**Location:** Carina (OPS Backend)

## What This Builds

The Carina OPS backend (`ops.carinaai.uk`) can now manage Keprix: view health, configure, deploy updates, restart, and monitor logs. This gives Laud a single pane of glass for both the Carina app and the Keprix engine.

## OPS Dashboard Additions

### New Section: Agent Engine

```
OPS Dashboard
  -> Agent Engine
     -> Engine Status (Keprix / Carina Native)
     -> Engine Health (heartbeat, uptime, resource usage)
     -> Active Sessions (count, per workspace)
     -> Tool Execution Stats (calls/sec, error rate, latency)
     -> Kill Switch Status (active workspaces, recent kills)
     -> Configuration (model, temperature, max iterations)
     -> Deployment (version, last deploy, restart button)
```

## OPS API Endpoints

### Engine Health

```
GET /api/ops/agent-engine/health

Response:
{
  "engine": "keprix",
  "status": "healthy",
  "uptime_seconds": 86400,
  "version": "0.16.0",
  "active_sessions": 12,
  "memory_usage_mb": 450,
  "cpu_percent": 15,
  "last_error": null
}
```

### Engine Configuration

```json
GET /api/ops/agent-engine/config

{
  "global_engine": "keprix",
  "keprix_url": "http://localhost:8333",
  "default_model": "deepseek-v4-pro",
  "max_iterations": 10,
  "timeout_seconds": 30,
  "prompt_filter_enabled": true,
  "kill_switch_enabled": true,
  "scout_integration_enabled": true
}
```

```
PATCH /api/ops/agent-engine/config
{
  "default_model": "gemini-2.5-pro",
  "max_iterations": 15
}
```

### Workspace Engine Assignment

```json
GET /api/ops/agent-engine/workspaces

{
  "workspaces": [
    {"id": "ws_salim", "name": "Salim", "engine": "keprix", "status": "active"},
    {"id": "ws_test", "name": "Test", "engine": "carina", "status": "active"},
    {"id": "ws_papa_lord", "name": "Papa Lord", "engine": "keprix", "status": "active"}
  ],
  "summary": {
    "total": 3,
    "on_keprix": 2,
    "on_carina": 1
  }
}
```

```
POST /api/ops/agent-engine/workspaces/{id}/switch
{
  "engine": "keprix"
}
```

### Deployment

```
POST /api/ops/agent-engine/deploy
{
  "action": "restart" | "update" | "rollback"
}

Response:
{
  "action": "restart",
  "status": "initiated",
  "estimated_downtime_seconds": 5
}
```

### Logs

```
GET /api/ops/agent-engine/logs?level=error&limit=50

Response:
{
  "logs": [
    {
      "timestamp": "2026-08-06T19:10:00Z",
      "level": "ERROR",
      "workspace_id": "ws_salim",
      "message": "Provider deepseek timeout after 30s"
    }
  ]
}
```

## OPS Dashboard UI

Add to `ops.carinaai.uk`:

### Agent Engine Page

- **Status Card:** Green/red indicator, engine name, version, uptime
- **Health Metrics:** CPU, memory, active sessions (line charts, 24h)
- **Kill Switch Panel:** Active kills, recent kills, kill/resume buttons per workspace
- **Workspace Assignment Table:** Which workspaces use which engine, with switch buttons
- **Deploy Panel:** Restart button, last deploy timestamp, version number
- **Log Viewer:** Filterable log stream, last 100 entries

### Quick Actions

- **Emergency Rollback:** "Switch All to Carina Native" button (with confirmation)
- **Restart Keprix:** "Restart Engine" button (with 5-second warning)
- **Kill All Workspaces:** Global kill switch (with confirmation + audit log)

## OPS Alerts

Configure alerts that fire when:

- Keprix health check fails 3 times in a row -> Telegram notification
- Memory usage exceeds 80% -> warning
- Error rate exceeds 1% -> warning
- Kill switch activated for any workspace -> Telegram notification
- Engine switched via emergency rollback -> Telegram notification

## Acceptance Criteria

- [ ] OPS dashboard shows Keprix health status
- [ ] Workspace engine assignment visible and switchable from OPS
- [ ] Restart Keprix from OPS with estimated downtime displayed
- [ ] Emergency rollback button works (switches all to Carina Native)
- [ ] Log viewer shows Keprix logs
- [ ] Alerts fire for health check failures and kill switch activations
- [ ] All OPS actions logged to audit trail
