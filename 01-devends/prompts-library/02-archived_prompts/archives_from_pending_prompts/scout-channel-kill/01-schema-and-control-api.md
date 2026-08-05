# Scout Channel Kill -- Prompt 01 of 05: Schema + Internal Control API
# Depends on: CHANNEL-EMERGENCY-CONTROL.md
# Blocks: 02 Telegram gateway
# Estimated time: 3-4 hours

## Task

### 1. Migrations

Add under `scout/scout-engine/src/db/migrations/`:

- `010-channel-operator-links.sql`
- `011-channel-control-events.sql`

Match schemas in `shared/security-assurance/programme/baseline/CHANNEL-EMERGENCY-CONTROL.md` (`channel_operator_links`, `channel_control_events`).

`channel_operator_links` columns at minimum:

- organization_id, dashboard_user_id, channel, channel_user_ref, chat_ref, role (`owner`|`operator`), enabled, linked_at, revoked_at, confirmed_at, control_scope

### 2. Control service

Create `scout/scout-engine/src/messaging/control.ts`:

- `pauseAgent(orgId, agentId, meta)`
- `suspendChannel(orgId, channel, meta)`
- `quarantineTool(orgId, agentId | 'all', toolName, meta)`
- `restrictOrg(orgId, meta)`
- `freezeOrg(orgId, meta)` / `killOrg(orgId, meta)` -> set all org agents `suspended`
- `resumeOrg(orgId, meta)` / `resumeAgent(...)` -> `offline`
- Allocate `audit_code` like `K-YYYY-MM-DD-NNN` per org day
- Insert `channel_control_events` row every time

### 3. Internal HTTP API (service auth)

Mount under `/api/internal/control/` with header `X-Scout-Internal-Key` === `SCOUT_INTERNAL_CONTROL_KEY` (env):

```
POST /api/internal/control/kill
POST /api/internal/control/freeze
POST /api/internal/control/pause
POST /api/internal/control/suspend-channel
POST /api/internal/control/quarantine-tool
POST /api/internal/control/restrict
POST /api/internal/control/resume
GET  /api/internal/control/status?organization_id=
```

Body includes actor metadata (channel, channel_user_ref, command, confirmed).

Dashboard killswitch should call the same control service functions (refactor existing handler to use them) so channel and UI share one path.

### 4. Plan gate

Org plan must have `killswitch: true` for kill/freeze/restrict/quarantine org-wide. Return `plan_limit` otherwise.

## Acceptance Criteria

- Migrations apply on SaaS Postgres
- Internal kill suspends all org agents; `/v1` filter returns 403 kill_switch
- Audit row written with audit_code
- Dashboard kill uses shared control service
- Trusted channel controls reuse the same control service
- No em dashes / emojis

## Post-build

Mark COMPLETED when done; archive folder only after 01-05.
