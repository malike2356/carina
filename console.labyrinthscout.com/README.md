# Labyrinth Scout - Server

Security control plane for AI agents. Built from prompts in `prompts/`.

## Stack

- Node.js 22 + TypeScript 5 + Express 5
- PostgreSQL 16 (shared with Carina on port 5433)
- Redis 7 (shared with Carina)
- Port **4444**

## Run

```bash
cd console.labyrinthscout.com
cp .env.example .env   # set SCOUT_API_KEY and DB URL
pnpm install
pnpm dev               # http://localhost:4444/dashboard.html
```

Production:

```bash
pnpm build && pnpm start
```

## Build status

| Prompt | Status |
|---|---|
| 01-dashboard | Complete (dashboard + SSE/status/kill APIs) |
| 02-scout-server | Complete (foundation: events, heartbeat, migrations, auth) |
| 03-carina-integration | Complete (in `core.carinaai.uk/src/security/`) |
| 04-kill-switch | Complete (suspend/resume, Redis `labyrinth:control`, dashboard) |
| 05-prompt-injection | Complete (`src/security/prompt-guard.ts`, Carina middleware) |
| 06-tool-policy | Complete (`src/security/tool-policy.ts`, `GET /api/policy`, Carina middleware) |
| 07-egress-filter | Complete (`src/security/egress-filter.ts`, `GET /api/stats/egress-blocked`, Carina http tool) |
| 08-alert-channels | Complete (`src/alerts/`, Telegram/Email/Slack dispatch, Redis dedup) |
| 09-anomaly-detector | Complete (`src/security/anomaly-detector.ts`, scheduler, dashboard panel) |
| 10-honeypot-manager | Complete (`src/security/honeypot-manager.ts`, `/api/honeypots`, Carina file/http checks) |
| 11-http-proxy | Complete (`src/proxy/openai-proxy.ts`, OpenAI-compatible proxy on port 8080) |
| 12-sdk-packages | Complete (`sdk/node/` `@verlox/labyrinth-scout`, `sdk/python/` `labyrinth-scout`, `GET /api/instances/:id/status`) |
| 13-dashboard-cinema | Complete (cinematic SOC dashboard: radar, canvas charts, kill modal) |
| 15-dashboard-charts | Complete (8 chart panels: donut, gauge, scatter, top events, injection overlay, egress sparkline, provider pie, honeypot grid) |
| 16-dashboard-full-rebuild | Complete (layout fixes: full-width grid, radar fill, scrollable stream, canvas init rAF, centred stats) |
| 17-dashboard-final | Complete (nested flex layout, GET /api/events history preload, all charts API-backed on startup) |
| 18-block-session | Complete (POST /api/sessions/:id/block, Redis block_session, Carina turn guard, dashboard BLOCK button) |
| 19-quarantine-tool | Complete (POST/GET/DELETE /api/quarantine/tools, Redis TTL, Carina tool-runner guard, dashboard TOOLS panel) |
| 20-block-egress-domain | Complete (POST/GET/DELETE /api/egress, Redis blocklist, Carina http tool guard, dashboard EGRESS modal) |
| 21-acknowledge-event | Complete (POST /api/events/:id/acknowledge, GET /api/events/:id, dedup clear, dashboard ACK button) |
| 22-trigger-alert-test | Complete (POST /api/admin/alert-test, dedup bypass, dashboard TEST ALERTS button) |
| 23-export-audit-log | Complete (GET /api/export/events JSON/CSV, filters, dashboard EXPORT dropdown) |
| 24-add-honeypot | Complete (POST deploy snake_case, GET /summary, dashboard DEPLOY HONEYPOT modal) |
| 25-adjust-rate-limit | Complete (POST/GET/DELETE /api/rate-limit, Redis TTL, Carina session override, dashboard THROTTLE button) |
| 26-clear-session-memory | Complete (POST /api/memory/clear-session, GET /api/memory/sessions, Carina clearSession, dashboard MEMORY modal) |

## Server foundation (prompt 02)

| File | Purpose |
|---|---|
| `src/server.ts` | Express app, CORS, graceful shutdown, SSE subscriber |
| `src/types.ts` | Shared TypeScript interfaces |
| `src/config/index.ts` | Env loading and validation |
| `src/db.ts` | PostgreSQL pool + migration runner |
| `src/redis.ts` | Redis client + subscriber factory |
| `src/migrations.ts` | `security_events`, `carina_instances`, `alert_channels` |
| `src/middleware/auth.ts` | `X-Scout-Key` with timing-safe compare |
| `src/api/events.ts` | `POST /api/events`, `GET /api/events?limit=N`, `GET /api/events/:id`, `POST /api/events/:id/acknowledge` |
| `src/api/heartbeat.ts` | `POST /api/heartbeat` |

## Dashboard (prompt 01)

| File | Purpose |
|---|---|
| `public/dashboard.html` | Real-time security dashboard |
| `src/api/sse.ts` | `GET /api/stream` |
| `src/api/status.ts` | `GET /api/status` |
| `src/api/kill.ts` | `POST /api/kill/:instanceId` (requires `{ reason }` body) |
| `src/api/resume.ts` | `POST /api/resume/:instanceId` |
| `src/api/instances.ts` | `GET /api/instances/:instanceId/status` (SDK kill-switch polling) |
| `src/api/block-session.ts` | `POST /api/sessions/:sessionId/block` (operator session block) |
| `src/api/quarantine.ts` | `POST/GET/DELETE /api/quarantine/tools` (temporary tool quarantine) |
| `src/api/egress-control.ts` | `POST/GET/DELETE /api/egress` (operator egress domain blocklist) |
| `src/api/policy.ts` | `GET /api/policy` (active tool policy, read-only) |
| `src/api/stats.ts` | `GET /api/stats/egress-blocked` (24h blocked egress count) |
| `src/alerts/dispatcher.ts` | Multi-channel alert fan-out after security events |
| `src/security/anomaly-detector.ts` | Z-score baseline learning and real-time anomaly detection |
| `src/scheduler.ts` | 24h baseline recomputation job |
| `src/proxy/openai-proxy.ts` | OpenAI-compatible interception proxy (port 8080) |
| `src/lib/instance-control.ts` | Shared suspend/resume logic + Redis publish |

## Kill switch (prompt 04)

```bash
curl -X POST http://localhost:4444/api/kill/carina-local \
  -H "X-Scout-Key: $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason":"policy violation"}'

curl -X POST http://localhost:4444/api/resume/carina-local \
  -H "X-Scout-Key: $SCOUT_API_KEY"
```

Carina listens on Redis channel `labyrinth:control` when `LABYRINTH_ENABLED=true`.

## API quick test

```bash
export SCOUT_API_KEY=test_key_for_local_dev_only_change_in_production

curl -X POST http://localhost:4444/api/heartbeat \
  -H "X-Scout-Key: $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instance_id":"carina-local","name":"Carina Local"}'

curl -X POST http://localhost:4444/api/events \
  -H "X-Scout-Key: $SCOUT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"severity":"critical","source":"test","event_type":"injection_blocked","description":"Test event"}'
```

Open http://localhost:4444/ and confirm events appear in the live stream.

## Next prompt

`prompts/12-sdk-packages.md` per build order.
