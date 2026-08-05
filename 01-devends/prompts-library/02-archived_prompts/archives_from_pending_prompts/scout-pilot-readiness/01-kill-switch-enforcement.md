# Scout Pilot Readiness -- Prompt 01 of 05: Kill Switch Enforcement
**Status: COMPLETED 2026-07-27**

**What was built:** agent-guard.ts; filter/events 403 kill_switch; resume + e2e set-plan; kill_switch_active on status

# Build Phase: Runtime control
# Depends on: Nothing
# Blocks: Prompt 02 (SDK), Prompt 05 (e2e)
# Estimated time: 2-3 hours

## Context

Dashboard kill switch today only sets `connected_agents.status = 'suspended'`. Public `/v1/prompts/filter` and `/v1/events` still accept traffic for suspended agents. A paying client cannot be told Scout can "stop" an agent unless the API refuses work after kill.

Keep Carina's production Scout untouched. Edit only `/opt/lampp/htdocs/verlox/scout/scout-engine/`.

## What Already Exists

- `POST /api/dashboard/killswitch/:agentId` (plan-gated) sets status `suspended`
- `GET /v1/agents/:id/status` returns agent status for the org
- `POST /v1/prompts/filter`, `POST /v1/events`, `POST /v1/agents/register`
- Tenant middleware attaches `organizationId` / `workspaceId`

## Task

### 1. Shared guard helper

Create `src/api/public/v1/agent-guard.ts` (or `src/lib/agent-runtime.ts`):

- `loadOrgAgent(organizationId, agentId)`: fetch from `connected_agents` scoped by org; 404 if missing
- `assertAgentRunnable(agent)`: if `status` is `suspended` (or `killed` if you add that alias), throw a typed error used by routes

### 2. Enforce on public routes

Update `src/api/public/v1/index.ts`:

**`POST /v1/prompts/filter`**
- Require `agent_id` in body (string). Reject 400 if missing.
- Load agent; org scope; if suspended return:

```json
{
  "error": "kill_switch",
  "message": "Agent is suspended. Tool and prompt processing are blocked until an operator resumes it.",
  "agent_id": "...",
  "status": "suspended"
}
```

HTTP status: **403**.

**`POST /v1/events`**
- Same check for `agent_id` before insert. Return 403 `kill_switch` if suspended.
- Do not accept events that would mark a suspended agent `online`.

**`POST /v1/agents/register`**
- Unchanged (new agents start offline/active per current design).

**`GET /v1/agents/:id/status`**
- Include clear fields: `status`, `kill_switch_active` (boolean true when suspended).

### 3. Optional resume (dashboard)

Add `POST /api/dashboard/agents/:id/resume` (Govern/Team only, same plan gate as killswitch) that sets status back to `offline` or `online`. If you skip resume in this prompt, document that resume is SQL/ops-only for v1 and still enforce kill.

### 4. Tests

Add a focused test or script under `scout-engine` (tsx test or small `src/api/public/v1/kill-switch.test.ts`):

1. Create org + agent (or use db fixtures)
2. Suspend agent
3. `filter` and `events` return 403 `kill_switch`
4. Status shows `kill_switch_active: true`

## Acceptance Criteria

- Suspended agent cannot successfully call filter or events (403 + `error: kill_switch`)
- Active agent still can
- Org A cannot kill/check Org B agents
- No em dashes / en dashes / emojis
- Carina production console codepaths unchanged

## Files to Reference

- `scout/scout-engine/src/api/public/v1/index.ts`
- `scout/scout-engine/src/api/dashboard/index.ts` (killswitch handler)
- `scout/scout-engine/src/api/middleware/plan-enforce.ts`

## Guidance for the executing agent

- Prefer one helper used by both routes; do not copy-paste status checks.
- Keep error shape consistent with existing public errors (`error`, `message`).
- Do not implement full fleet kill or Carina instance killswitch listeners here.

## Post-build (MANDATORY)

Follow `01-devends/prompts-library/00-library-docs/POST-BUILD-CHECKLIST.md`.  
Mark this file COMPLETED when acceptance passes; archive the whole `scout-pilot-readiness/` folder only after prompts 01-05 are done.
