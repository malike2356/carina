# Action: Build Scout's Agent-Integration Layer and `scout deploy` Command

## Goal
Build the adapter interface, six framework adapters (Carina/Hermes/OpenClaw/OpenAI/LangChain/generic), middleware/proxy/wrap integration modes, and the `scout deploy` one-command setup that makes labyrinthscout.com's "works with any agent" and "Deploy Scout in 3 steps" promises real. This is the largest genuine build in the gap-closure batch.

## Context
- Spec file: `chat.carinaai.uk/prompts/phase2-gap-closure/04-scout-audit-deploy/03-agent-integration-deploy.md`
- **Mostly greenfield — only an OpenAI-specific proxy currently exists.** Read these first:
  - `console.labyrinthscout.com/src/proxy/openai-proxy.ts` (348 lines) — read in FULL; this is the ONLY integration code that exists today, and it is OpenAI-only and presumably not adapter-pattern-based. It is the seed for `adapters/openai-adapter.ts` and `scout-proxy.ts` — do not discard it; generalize from it.
  - `core.carinaai.uk/src/gateway/router.ts` (127 lines) and `commands.ts` (75 lines) — read to understand the existing CLI command-registration pattern your `deploy-command.ts` and any `carina config set scout.*` additions must follow
  - `core.carinaai.uk/bin/carina.ts` (87 lines) — the CLI entry point; any `carina config set scout.url ...` support must be wired through here
- Confirmed via `grep -ril "scout.enabled\|scout.url\|scout_enabled\|adapter.*registry\|IAgentAdapter" console.labyrinthscout.com/src core.carinaai.uk/src` → **NOTHING beyond the OpenAI proxy**. The adapter interface, registry, middleware, reverse-proxy generalization, and `scout deploy`/`scout license` commands are all genuinely new.
- Conventions: TypeScript strict, Node 18+, no emojis/em-dashes, every adapter and the registry get `*.test.ts` with mocked HTTP, Docker artifacts follow the style of the existing `core.carinaai.uk/docker-compose*.yml` files (read one before writing the new one).

## Files to create
```
console.labyrinthscout.com/src/integration/
  agent-adapter.interface.ts   — IAgentAdapter: normalizes requests/responses across frameworks
  adapters/
    carina-adapter.ts          — Native Carina integration
    hermes-adapter.ts          — Hermes agent integration
    openclaw-adapter.ts        — OpenClaw integration
    openai-adapter.ts          — Generalizes openai-proxy.ts into the adapter shape
    langchain-adapter.ts       — LangChain agent integration
    generic-adapter.ts         — Generic REST adapter for any HTTP-based agent
  adapter-registry.ts          — Discovery/registration of adapters by agentType string
  scout-middleware.ts          — Express/Fastify drop-in middleware (Mode 1)
  scout-proxy.ts               — Reverse-proxy sidecar mode (Mode 2), generalized from openai-proxy.ts
  scout-wrap.ts                — API-wrapping mode (Mode 3): scoutWrap(client, opts)
  __tests__/
    agent-adapter.test.ts
    adapter-registry.test.ts
    scout-middleware.test.ts
    scout-proxy.test.ts
    scout-wrap.test.ts
console.labyrinthscout.com/src/deploy/
  deploy-command.ts            — `scout deploy` CLI command (one-command setup)
  license-activator.ts         — Licence-key validation and `scout license activate`
  __tests__/
    deploy-command.test.ts
    license-activator.test.ts
console.labyrinthscout.com/
  docker-compose.yml           — Full Scout stack (mirror the structure of core.carinaai.uk/docker-compose.yml — read it first)
  .env.template                — Environment variable template (SCOUT_LICENSE_KEY, SCOUT_API_KEY, SCOUT_PORT, etc.)
```

## Files to modify
- `console.labyrinthscout.com/src/proxy/openai-proxy.ts` — refactor its OpenAI-specific request/response handling into `adapters/openai-adapter.ts` behind the new `IAgentAdapter` interface; keep the file as a thin re-export or delete it only once the adapter is verified to behave identically (run any existing tests for it first: `find . -iname "openai-proxy.test.ts"`)
- `core.carinaai.uk/src/gateway/commands.ts` — add `carina config set scout.enabled <bool>` and `carina config set scout.url <url>` following the existing config-command pattern (read how `/provider` at line ~42 reads/writes config)
- `core.carinaai.uk/bin/carina.ts` — wire any new top-level CLI verbs needed for the config commands above (only if `commands.ts` cannot register them on its own — read the existing registration flow first)
- `console.labyrinthscout.com/src/server.ts` — mount `scout-middleware`/`scout-proxy` and register the `deploy`/`license` CLI entry points if this codebase runs its CLI through the same process (check how `bin/carina.ts` differs from any `console.labyrinthscout.com` bin entry — `grep -n "\"bin\"" console.labyrinthscout.com/package.json`)

## Step-by-step
1. Read `openai-proxy.ts` in full (348 lines). Identify exactly which parts are OpenAI-specific (request/response shape translation, streaming handling, error mapping) versus which parts are generic proxy plumbing (HTTP forwarding, header handling, logging hooks). The generic plumbing becomes `scout-proxy.ts`; the OpenAI-specific parts become `adapters/openai-adapter.ts`.
2. Design `IAgentAdapter` (in `agent-adapter.interface.ts`) around what `openai-proxy.ts` already needs to do PLUS what the spec's other five frameworks need: methods like `parseRequest(raw): NormalizedRequest`, `formatResponse(scoutResult): raw`, `extractToolCalls(raw): ToolCall[]`, `agentType: string`. Keep it minimal — do not design for hypothetical frameworks beyond the six named.
3. Build `adapter-registry.ts`: a `Map<string, IAgentAdapter>` with `register`/`resolve(agentType)`, following whatever singleton/registry pattern this codebase already uses elsewhere (e.g. `honeypotManager`/`anomalyDetector` singletons — check if there's a shared registry helper).
4. Implement `adapters/openai-adapter.ts` by porting the OpenAI-specific logic identified in Step 1 into the `IAgentAdapter` shape. Run any existing proxy tests against it to confirm behavioral parity before touching `openai-proxy.ts`.
5. Implement `adapters/carina-adapter.ts`: this is the adapter for THIS codebase's own agent — it should be able to parse `core.carinaai.uk`'s actual request/response shapes (read `gateway/web.ts`, 223 lines, for the real wire format) rather than a guessed generic shape.
6. Implement `adapters/generic-adapter.ts`: a configurable REST adapter (the spec's "any agent with an API" — JSON in, JSON out, with configurable JSONPath-style field mappings for request/response/tool-call extraction). This is the fallback every unlisted framework uses.
7. Implement `adapters/hermes-adapter.ts`, `openclaw-adapter.ts`, `langchain-adapter.ts` — for each, search this monorepo and the wider `/opt/lampp/htdocs/verlox/` tree for any existing Hermes/OpenClaw integration code (`grep -ril "hermes\|openclaw" /opt/lampp/htdocs/verlox --include="*.ts" -l | head -20`) to ground the wire-format assumptions in something real; where nothing exists, base the adapter on the framework's PUBLIC API conventions (LangChain's standard agent executor JSON shape, etc.) and clearly comment any assumption that needs verification against a live instance.
8. Build `scout-middleware.ts` (Mode 1): an Express/Fastify-compatible middleware factory `scoutMiddleware({ agentType, apiKey })` that resolves the right adapter via the registry and runs every request/response through the existing security pipeline (`prompt-guard`, `tool-policy`, `egress-filter`, `anomaly-detector` — wire to the SAME functions the rest of Scout uses, this is the entire point of the integration layer).
9. Build `scout-proxy.ts` (Mode 2) by generalizing the HTTP-forwarding plumbing isolated in Step 1 to work with any `--target` URL and any adapter, implementing `scout deploy --mode proxy --target <url> --port <port>`.
10. Build `scout-wrap.ts` (Mode 3): `scoutWrap(client, { provider, apiKey })` returns a proxy object wrapping an SDK client (e.g. an OpenAI client instance) so that calls like `.chat.completions.create()` are intercepted and routed through Scout's pipeline before reaching the real provider.
11. Build `deploy-command.ts`: the `scout deploy` CLI command. Read how `core.carinaai.uk/bin/carina.ts` registers commands and follow an equivalent pattern for `console.labyrinthscout.com` (check its `package.json` `bin` field — it may need one added). Support `--mode proxy --target <url> --port <port>` and a default "deploy the full stack" mode.
12. Build `license-activator.ts`: `scout license activate --key ***` validates a licence key (format/signature check; if no licensing backend exists yet, implement a structurally-correct stub that validates format and stores the key, with a clear comment that server-side validation against a licensing API is a follow-up) and prints `"Licence activated. {N} agents protected. Dashboard: http://localhost:{port}/dashboard"`.
13. Read an existing `core.carinaai.uk/docker-compose*.yml` file and mirror its structure for `console.labyrinthscout.com/docker-compose.yml` (Postgres + Redis + the Scout server, exposing port 3001) and `.env.template`.
14. Add `carina config set scout.enabled`/`scout.url` to `commands.ts`, following the exact pattern used by the existing `/provider` command (read it at line ~42 first).

## Expected behavior
- `docker run -d -p 3001:3001 -e SCOUT_LICENSE_KEY=*** -e SCOUT_API_KEY=*** carinaaiuk/scout:latest` brings up a working Scout instance on port 3001
- `app.use(scoutMiddleware({ agentType: 'carina', apiKey: '...' }))` intercepts every request/response in one line, running it through the existing prompt-guard/egress/anomaly pipeline
- `scout deploy --mode proxy --target http://localhost:3000 --port 3001` stands up a sidecar that filters traffic to an arbitrary agent with zero code changes to that agent
- `scoutWrap(openaiClient, { provider: 'openai', apiKey })` transparently routes `chat.completions.create()` calls through Scout
- `carina config set scout.url http://localhost:3001` updates Carina's config and Carina's traffic immediately starts flowing through Scout
- `scout license activate --key ***` prints `"Licence activated. 47 agents protected. Dashboard: http://localhost:3001/dashboard"`
- The dashboard shows agent counts incrementing as each new agent (Carina, then Hermes) connects
- Sending `"ignore all previous instructions"` through any connected agent gets blocked by Scout regardless of which adapter is in use

## Test
- `agent-adapter.test.ts`: each adapter's `parseRequest`/`formatResponse`/`extractToolCalls` round-trip correctly against fixture payloads representative of that framework's real wire format
- `adapter-registry.test.ts`: registration/resolution by `agentType`; unknown types fall back to `generic-adapter`
- `scout-middleware.test.ts`: a mocked Express app routes through the security pipeline and blocks an injection attempt
- `scout-proxy.test.ts`: forwarding preserves headers/streaming and applies filtering on both legs (request to agent, response to user)
- `scout-wrap.test.ts`: wrapped client methods are intercepted and the underlying client is still called on pass-through
- `deploy-command.test.ts` / `license-activator.test.ts`: CLI argument parsing and the documented output strings
- Run `pnpm test -- integration deploy adapter` and confirm all pass

## Dependencies
- Step 1 (fully understanding `openai-proxy.ts`) is the foundation everything else builds on — it is the only working reference for what "passing traffic through Scout's pipeline" looks like in this codebase
- The middleware/proxy/wrap modes all call into the SAME existing security pipeline (`prompt-guard`, `tool-policy`, `egress-filter`, `anomaly-detector`) — grep for how `openai-proxy.ts` currently invokes them and follow that exact call pattern; this integration layer's value is entirely in NOT duplicating that pipeline
- `core.carinaai.uk/src/gateway/commands.ts`'s `/provider` command is the template for the new `carina config set scout.*` commands
