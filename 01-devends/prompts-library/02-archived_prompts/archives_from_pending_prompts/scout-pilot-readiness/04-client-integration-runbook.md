# Scout Pilot Readiness -- Prompt 04 of 05: Client Integration Runbook
**Status: COMPLETED 2026-07-27**

**What was built:** docs/CLIENT-INTEGRATION.md; onboarding/docs snippets; scout/README links

# Build Phase: Developer experience / docs
# Depends on: Prompt 02 (SDK), Prompt 03 (host URLs)
# Blocks: Prompt 05 (e2e references the runbook paths)
# Estimated time: 2-3 hours

## Context

Pilots fail when clients think Scout "watches the server" without code changes. Document the real model and wire dashboard onboarding to production URLs and the governed-loop example.

## Task

### 1. Write `scout/docs/CLIENT-INTEGRATION.md`

Must include:

1. **What Scout does:** runtime filter + event ingest + dashboard + kill switch (API-enforced after prompt 01)
2. **What Scout does not do:** automatic git/repo scanning; transparent API gateway without SDK; Carina-level Trust Passport/connectors in this SaaS cut
3. **Connect steps:**
   - Sign up at `https://console.labyrinthscout.com/signup` (or staging URL from prompt 03)
   - Create API key
   - Install SDK (link to `scout-sdk/PUBLISH.md` / pack instructions)
   - Set `SCOUT_API_KEY` and `SCOUT_API_URL`
4. **Where to call what** (copy-pasteable):

```text
on each user/LLM input:
  scout.filter({ agentId, prompt })
  if blocked -> do not call model/tools

before each tool execution:
  scout.assertAgentRunnable(agentId)

after each tool:
  scout.trackEvent({ agentId, type, ... })
```

5. **Kill switch:** operator clicks Kill in dashboard → API returns 403 `kill_switch` → client loop must stop
6. **Plans:** Free / Monitor £99 / Govern £199 / Team £399 (SoT); kill switch requires paid plan per engine rules
7. **Support boundary:** supervised pilot; not full Govern marketing parity yet

### 2. Dashboard onboarding + docs pages

Update `scout-dashboard`:

- `/onboarding` and `/docs` use the production/public API base from `NEXT_PUBLIC_SCOUT_API_URL`
- Snippets match `examples/governed-loop.ts` (Node + Python)
- Remove any `api.scout.security` leftovers
- State clearly: instrumentation required

### 3. Root README pointer

Update `scout/README.md` with links to:

- `docs/CLIENT-INTEGRATION.md`
- `deploy/README.md`
- `scout-sdk/README.md`

### 4. Writing style

No em dashes, en dashes, or emojis. Plain ASCII labels only.

## Acceptance Criteria

- CLIENT-INTEGRATION.md exists and matches implemented SDK method names
- Onboarding snippets install/run against documented base URL
- A new engineer can follow the doc without reading engine source
- Does not over-claim features vs Carina console Scout

## Guidance

- Keep the runbook short (aim under ~200 lines). Link to examples instead of pasting huge files.
- If prompt 03 chose `api.labyrinthscout.com`, every URL in this prompt must use that host consistently.

## Post-build (MANDATORY)

Follow POST-BUILD-CHECKLIST. Archive folder only after 01-05 complete.
