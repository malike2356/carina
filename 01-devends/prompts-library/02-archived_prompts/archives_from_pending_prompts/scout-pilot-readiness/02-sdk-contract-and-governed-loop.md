# Scout Pilot Readiness -- Prompt 02 of 05: SDK Contract + Governed Loop
**Status: COMPLETED 2026-07-27**

**What was built:** SDK baseUrl console.labyrinthscout.com; assertAgentRunnable; governed-loop example; PUBLISH.md; Python parity

# Build Phase: Client SDK
# Depends on: Prompt 01 (kill switch enforcement)
# Blocks: Prompt 04 (runbook), Prompt 05 (e2e)
# Estimated time: 3-4 hours

## Context

`@scout-security/client` exists at `/opt/lampp/htdocs/verlox/scout/scout-sdk/` but:

- Default base URL is still `https://api.scout.security` (wrong brand/host decision: use Labyrinth Scout hosts)
- Response helpers may not match engine JSON exactly
- There is no helper that refuses work when the agent is suspended
- Package is not publish-ready for a client install story

Carina keeps using `@verlox/carina-scout`. Do not change that package in this prompt.

## Task

### 1. Align types and client with live `/v1`

Audit engine responses and update `src/types.ts` + `src/client.ts`:

| Method | Engine | Client must handle |
|--------|--------|-------------------|
| register | `{ agent_id, monitoring_token, status, created_at }` | expose `id` / `agent_id` |
| filter | `{ verdict, filtered_prompt, risk_level, distillation, finding_id }` | keep `blocked` helper (`verdict === 'blocked'`) plus raw fields |
| events | `{ accepted, rejected }` | as-is |
| status | includes `kill_switch_active` after prompt 01 | typed |
| errors | `{ error, message }` including `kill_switch` | throw `ScoutApiError` with `code` |

### 2. Defaults and env

- Default `baseUrl`: `https://console.labyrinthscout.com` if API is same-origin under `/v1`, **or** `https://api.labyrinthscout.com` if prompt 03 splits hosts. Pick one and document it; prefer matching prompt 03's proxy design.
- Respect `SCOUT_API_URL` / `SCOUT_API_KEY`.
- Remove `api.scout.security` as the default unless you explicitly add a redirect note (do not).

### 3. Kill-switch helpers

Add to client:

```ts
async assertAgentRunnable(agentId: string): Promise<AgentStatusResponse>
// throws ScoutApiError if kill_switch_active or status suspended

async filter(...): // if engine returns 403 kill_switch, throw with code kill_switch
```

Update `withScoutMonitoring` / middleware:

1. `assertAgentRunnable` (or rely on filter 403)
2. `filter` prompt if `getPrompt` provided; abort on blocked/kill_switch
3. execute tool
4. `trackEvent` success/failure

### 4. Canonical example

Create `examples/governed-loop.ts`:

- Register agent
- On each user message: filter → if blocked, return safe message
- Before each tool: `assertAgentRunnable`
- After tool: `trackEvent`
- Comments that Scout does not scan the repo

Update `examples/basic.ts` and README install section.

### 5. Publish path (code + docs, publish may be manual)

- Ensure `package.json` name `@scout-security/client`, `files: ["dist", "README.md"]`, `prepublishOnly` builds
- Add `PUBLISH.md` with: build, npm login / GitHub Packages, or `npm install github:org/repo#path` / `file:` instructions for private pilots
- Do **not** require a public npm publish to mark this prompt done if `PUBLISH.md` + local `pnpm pack` succeeds and README tells the pilot how to install the tarball

### 6. Python mirror

Update `python/scout_client.py` for the same base URL default, kill_switch handling, and `assert_agent_runnable`.

## Acceptance Criteria

- `pnpm build` (or npm) produces clean `dist/`
- Example compiles against current engine types
- Suspended agent: client surfaces `kill_switch` without swallowing it
- README install works for a private pilot (pack or registry)
- No em dashes / en dashes / emojis

## Files to Reference

- `scout/scout-sdk/src/client.ts`, `middleware.ts`, `types.ts`
- `scout/scout-engine/src/api/public/v1/index.ts`
- Prompt 01 for error contract

## Guidance

- Prefer thin client: no business logic duplication of PromptGuard.
- Do not add Carina-specific imports.
- If engine and client disagree, **fix the client** to the engine (engine is source of truth after prompt 01).

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Batch-archive with sibling prompts when 01-05 complete.
