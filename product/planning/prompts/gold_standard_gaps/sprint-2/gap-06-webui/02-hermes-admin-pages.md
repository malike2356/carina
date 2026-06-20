# Web UI Upgrade 02; Hermes Admin Pages

> **REUSE RULE:** See `../REUSE-RULES.md`. File name references the behavioral source only. All implementation must use Carina's own voice, naming, CLI output, and UI copy. No competitor brand names in any shipped file.


**Source:** Hermes Agent (`web/src/pages/*.tsx`; 23 pages)
**Status:** Partial in Carina
**Effort:** 4 weeks

---

## PAGES TO BUILD (9 pages)

| # | Page | Route | Hermes Reference | Priority |
|---|------|-------|-----------------|----------|
| 1 | Cron/Jobs | `/cron` | `CronPage.tsx` + `ScheduleBuilder.tsx` | HIGH |
| 2 | Webhooks | `/webhooks` | `WebhooksPage.tsx` | HIGH |
| 3 | Analytics | `/analytics` | `AnalyticsPage.tsx` | MEDIUM |
| 4 | Logs | `/logs` | `LogsPage.tsx` | MEDIUM |
| 5 | MCP Servers | `/mcp` | `McpPage.tsx` | MEDIUM |
| 6 | Files | `/files` | `FilesPage.tsx` | LOW |
| 7 | Environment | `/env` | `EnvPage.tsx` | LOW |
| 8 | System Health | `/system` | `SystemPage.tsx` | LOW |
| 9 | Profiles | `/profiles` | `ProfilesPage.tsx` + `ProfileBuilderPage.tsx` | MEDIUM |

---

## PAGE 1; CRON/JOBS MANAGEMENT (`/cron`)

### What This Is
Schedule recurring agent tasks. View/edit/delete/pause/resume cron jobs. Schedule builder UI.

Carina note: this page now exists in `app.carinaai.uk/src/app/(workspace)/cron/page.tsx` and talks to the shared core cron store through `GET/POST/PUT/DELETE /api/scheduled/cron` plus job run and history endpoints.

### API Endpoints Needed
```
GET    /api/cron; list all jobs
POST   /api/cron; create job
PUT    /api/cron/:id; update job
DELETE /api/cron/:id; delete job
POST   /api/cron/:id/pause; pause job
POST   /api/cron/:id/resume; resume job
POST   /api/cron/:id/run; run job now
GET    /api/cron/:id/history; job run history
```

### UI Components
```
CronPage.tsx
├── JobList; table of all jobs (name, schedule, status, last run, next run)
├── JobCard; expandable job detail
│   ├── JobStatus; running/paused/error indicator
│   ├── JobSchedule; cron expression display with human-readable next run
│   ├── JobHistory; recent runs with status and output preview
│   └── JobActions; pause/resume/run now/edit/delete buttons
├── ScheduleBuilder; visual cron expression builder
│   ├── PresetSelector; "Every 30m", "Every hour", "Daily at 9am", "Custom"
│   ├── CronInput; raw cron expression input
│   └── Preview; human-readable: "Next run: June 17, 2026 at 9:00 AM"
├── JobEditor; create/edit modal
│   ├── NameInput
│   ├── PromptEditor; task instructions
│   ├── ModelSelector; per-job model override
│   ├── ToolsetSelector; per-job tool restrictions
│   ├── DeliveryTarget; where to send results
│   └── ScriptUpload; attach script file
└── JobRunOutput; expandable output viewer for completed runs
```

**Study reference:** `hermes-agent/web/src/pages/CronPage.tsx` + `hermes-agent/web/src/components/ScheduleBuilder.tsx`

### Existing Carina Code to Integrate
```
src/agents/cron-scheduler.ts; cron scheduler
src/agents/cron-delivery.ts; cron delivery
src/agents/cron-workflow-engine.ts; workflow engine
src/api/scheduled-api.ts; scheduled tasks API (extend for cron)
```

---

## PAGE 2; WEBHOOK MANAGEMENT (`/webhooks`)

### What This Is
Manage incoming/outgoing webhooks. Subscribe to agent events. Configure webhook endpoints.

### API Endpoints Needed
```
GET    /api/webhooks; list webhooks
POST   /api/webhooks; create webhook
PUT    /api/webhooks/:id; update webhook
DELETE /api/webhooks/:id; delete webhook
POST   /api/webhooks/:id/test; send test payload
GET    /api/webhooks/:id/logs; delivery logs
```

### UI Components
```
Carina note: the web webhook manager is now implemented in `app.carinaai.uk/src/app/(workspace)/webhooks/page.tsx` with the supporting client component in `src/components/webhooks/WebhooksManager.tsx`. Keep future webhook work aligned with that page and the shared `/api/webhooks` proxy.

WebhooksPage.tsx
├── WebhookList; table (URL, events, status, last delivery)
├── WebhookEditor; create/edit modal
│   ├── URLInput
│   ├── EventSelector; checkboxes: agent.message, agent.tool_call, agent.error, cron.complete, etc.
│   ├── SecretInput; HMAC secret for signature verification
│   ├── FormatSelector; JSON / form-encoded
│   └── TestButton; send test event
└── WebhookLogs; delivery history with status, response, latency
```

**Study reference:** `hermes-agent/web/src/pages/WebhooksPage.tsx`

### Existing Carina Code to Integrate
```
src/webhooks/dispatcher.ts; webhook dispatcher
src/webhooks/store.ts; webhook store
src/webhooks/webhook-delivery.ts; delivery tracking
src/api/webhook-api.ts; webhook API
```

---

## PAGE 3; ANALYTICS DASHBOARD (`/analytics`)

Carina note: the analytics surface is now implemented in `app.carinaai.uk/src/app/(workspace)/analytics/page.tsx` with the data loader in `src/lib/analytics-overview.ts` and the shared route at `src/app/api/analytics/overview/route.ts`. Keep future work aligned with these Carina-native surfaces and do not add placeholder numbers.

### What This Is
Usage metrics, cost breakdown, session statistics, model performance, trend charts.

### API Endpoints Needed
```
GET /api/analytics/overview; summary stats (total sessions, messages, cost, tokens)
GET /api/analytics/usage; usage over time (daily/weekly/monthly)
GET /api/analytics/costs; cost breakdown by model/provider
GET /api/analytics/sessions; session statistics (avg length, tools used, completion rate)
GET /api/analytics/models; model usage distribution
GET /api/analytics/errors; error rate over time
```

### UI Components
```
AnalyticsPage.tsx
├── OverviewCards; 4 stat cards: Total Sessions, Messages, Cost, Tokens
├── UsageChart; line chart: usage over time (daily/weekly/monthly)
├── CostBreakdown; pie chart: cost by model
├── ModelDistribution; bar chart: model usage frequency
├── SessionStats; avg turns, avg tools, completion rate
├── ErrorRateChart; line chart: errors over time
├── TopSkills; most used skills
└── ExportButton; download CSV/PDF report
```

**Charts library:** Recharts or Chart.js (already in Carina's dependency tree?)

**Study reference:** `hermes-agent/web/src/pages/AnalyticsPage.tsx`

### Existing Carina Code to Integrate
```
src/telemetry/usage-metrics.ts; usage metrics
src/telemetry/session-telemetry.ts; session stats
src/telemetry/error-classifier.ts; error stats
src/billing/usage-meter.ts; cost data
```

---

## PAGE 4; LOGS VIEWER (`/logs`)

Carina note: the logs viewer is now implemented in `app.carinaai.uk/src/app/(workspace)/logs/page.tsx` with the client component in `src/components/logs/LogsPage.tsx`, proxied through `src/app/api/ops/logs/route.ts` and `src/app/api/ops/logs/stream/route.ts`.

### What This Is
Real-time log viewer with filtering by level, source, session. Search and follow (tail -f mode).

### API Endpoints Needed
```
GET /api/logs; fetch logs (pagination, level filter, source filter, search)
GET /api/logs/stream; SSE stream for real-time log tailing
GET /api/logs/sessions; list sessions with logs
GET /api/logs/session/:id; logs for specific session
```

### UI Components
```
LogsPage.tsx
├── LogToolbar
│   ├── LevelFilter; ERROR, WARNING, INFO, DEBUG toggles
│   ├── SourceFilter; agent, gateway, cron, web, system
│   ├── SessionFilter; search by session ID or name
│   ├── SearchInput; full-text search
│   └── FollowToggle; auto-scroll to newest (tail mode)
├── LogList
│   ├── LogEntry; timestamp, level badge, source badge, message
│   └── LogDetail; expandable entry with full context and stack trace
└── LogExport; download as text/JSON
```

**Study reference:** `hermes-agent/web/src/pages/LogsPage.tsx`

---

## PAGE 5; MCP SERVER MANAGEMENT (`/mcp`)

### What This Is
Manage MCP (Model Context Protocol) server connections. Add, remove, configure, test MCP servers.

### API Endpoints Needed
```
GET    /api/mcp; list configured MCP servers
POST   /api/mcp; add MCP server
PUT    /api/mcp/:id; update MCP server config
DELETE /api/mcp/:id; remove MCP server
POST   /api/mcp/:id/test; test connection
GET    /api/mcp/:id/tools; list tools provided by server
GET    /api/mcp/catalog; browse known MCP servers (optional catalog)
```

### UI Components
```
McpPage.tsx
├── McpServerList; table (name, transport, status, tools count)
├── McpServerEditor; add/edit modal
│   ├── NameInput
│   ├── TransportSelector; stdio / HTTP
│   ├── CommandInput; for stdio: command + args
│   ├── URLInput; for HTTP: endpoint URL
│   ├── EnvVarEditor; environment variables for the server
│   └── TestButton; test connection, show discovered tools
├── McpToolList; tools discovered from the server
└── McpCatalog; optional: browse known MCP servers
```

**Study reference:** `hermes-agent/web/src/pages/McpPage.tsx`

### Existing Carina Code to Integrate
```
src/mcp/registry.ts; MCP registry
src/mcp/http-client.ts; HTTP MCP client
src/mcp/stdio-client.ts; stdio MCP client
src/extensions/mcp-loader.ts; MCP loader
```

---

## PAGE 6; FILE BROWSER (`/files`)

### What This Is
Browse Carina's workspace files. View, upload, download, delete files. Tree view.

### UI Components
```
FilesPage.tsx
├── FileToolbar
│   ├── Breadcrumb; current path navigation
│   ├── UploadButton
│   ├── NewFolderButton
│   └── SearchInput
├── FileTree; directory tree
├── FileList; table (name, size, type, modified)
│   ├── FileRow; single file with actions
│   └── FolderRow; clickable folder
├── FilePreview; text/code preview for supported types
└── FileActions; download, rename, delete, copy path
```

**Study reference:** `hermes-agent/web/src/pages/FilesPage.tsx`

---

## PAGE 7; ENVIRONMENT VARIABLES (`/env`)

### What This Is
View and edit Carina's environment variables (.env file). Masked secrets.

### API Endpoints
```
GET  /api/env; list all env vars (values masked for secrets)
PUT  /api/env; update env vars
POST /api/env/reload; reload env without restart
```

### UI Components
```
EnvPage.tsx
├── EnvTable; key-value table
│   ├── EnvRow; key | masked value (••••••) | edit button
│   └── SecretToggle; show/hide for individual secrets
├── EnvEditor; edit modal with validation
├── ReloadButton; reload environment
└── ImportExport; import/export .env file
```

**Study reference:** `hermes-agent/web/src/pages/EnvPage.tsx`

---

## PAGE 8; SYSTEM HEALTH (`/system`)

### What This Is
System status dashboard. CPU, memory, disk, uptime. Service health. Version info.

### API Endpoints
```
GET /api/system/health; comprehensive health check
GET /api/system/info; system info (OS, arch, versions)
GET /api/system/services; service status (core, gateway, web)
```

### UI Components
```
SystemPage.tsx
├── HealthStatus; overall: HEALTHY / DEGRADED / DOWN
├── ResourceCards; CPU %, Memory %, Disk %, Uptime
├── ServiceList; service status indicators
│   ├── ServiceRow; name | status dot | uptime | restart button
├── VersionInfo; Carina version, Node version, OS
├── DependencyVersions; key dependency versions
└── RestartButton; restart gateway/core (with confirmation)
```

**Study reference:** `hermes-agent/web/src/pages/SystemPage.tsx`

### Existing Carina Code to Integrate
```
src/ops/health-check.ts; health check
src/ops/health-deep-scan.ts; deep health scan
src/ops/control-status.ts; service status
```

---

## PAGE 9; PROFILES (`/profiles`)

Carina note: the profiles workspace page is now implemented in `app.carinaai.uk/src/app/(workspace)/profiles/page.tsx` with the client surface in `src/components/profiles/ProfilesManager.tsx`. Keep future profile work aligned with the existing `/api/web/context` and `/api/web/context/profile` proxy routes.

### What This Is
Manage Carina profiles (separate identities/configs). Create, switch, clone, delete profiles.

### UI Components
```
ProfilesPage.tsx
├── ProfileList; list of profiles
│   ├── ProfileCard; name, avatar, last active, is-active indicator
│   └── ProfileActions; activate, clone, delete
├── ProfileBuilder; create/edit wizard
│   ├── NameInput
│   ├── AvatarPicker
│   ├── ModelDefaults; default model, provider, temperature
│   ├── PersonaEditor; SOUL.md content editor
│   └── ScopeSelector; what to isolate (skills, memory, config)
└── ProfileSwitcher; quick switch dropdown (also in sidebar)
```

**Study reference:** `hermes-agent/web/src/pages/ProfilesPage.tsx` + `hermes-agent/web/src/pages/ProfileBuilderPage.tsx` + `hermes-agent/web/src/components/ProfileSwitcher.tsx`

### Existing Carina Code to Integrate
```
src/profiles/manager.ts; profile manager
src/profiles/personality.ts; personality/SOUL.md
src/profiles/scope.ts; isolation scoping
src/profiles/isolation.ts; profile isolation
```

---

## IMPLEMENTATION PLAN

### Week 1; Cron + Webhooks (HIGH priority)
```
- CronPage.tsx with ScheduleBuilder
- WebhooksPage.tsx
- API routes for cron and webhooks CRUD
```

### Week 2; Analytics + Logs (MEDIUM priority)
```
- AnalyticsPage.tsx with charts
- LogsPage.tsx with real-time tailing
- SSE endpoint for log streaming
```

### Week 3; MCP + Files + Env (MEDIUM/LOW priority)
```
- McpPage.tsx with catalog
- FilesPage.tsx with tree browser
- EnvPage.tsx with masked secrets
```

### Week 4; System + Profiles (LOW/MEDIUM priority)
```
- SystemPage.tsx with health dashboard
- ProfilesPage.tsx with builder wizard
- ProfileSwitcher in sidebar
```

---

## SHARED COMPONENTS TO CREATE

These are reused across multiple admin pages:

```
components/admin/
├── AdminLayout.tsx; shared admin page shell (sidebar + header)
├── AdminTable.tsx; reusable table with sorting, filtering, pagination
├── StatusBadge.tsx; colored status dot (healthy, error, paused, etc.)
├── ConfirmDialog.tsx; confirmation modal for destructive actions
├── EmptyState.tsx; "No items yet" placeholder
├── SearchInput.tsx; search with debounce
└── RefreshButton.tsx; manual refresh with loading spinner
```

---

## NAVIGATION

Add "Admin" section to the workspace sidebar:

```
sidebar/
├── Admin
│   ├── Cron Jobs       → /cron
│   ├── Webhooks        → /webhooks
│   ├── Analytics       → /analytics
│   ├── Logs            → /logs
│   ├── MCP Servers     → /mcp
│   ├── Files           → /files
│   ├── Environment     → /env
│   ├── System Health   → /system
│   └── Profiles        → /profiles
```

Feature-gate admin pages behind workspace admin role or `features.adminPages` config flag.
