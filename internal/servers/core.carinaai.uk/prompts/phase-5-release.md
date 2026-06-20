# Phase 5 - Public Release

**Status: PARTIALLY COMPLETE**

Cursor built the infrastructure. The remaining work is content, deployment, and tests.

## What Was Built (Do Not Rebuild)

- `bin/carina.ts` - global CLI entry point: `carina`, `carina setup`, `carina install-pack <n>`, `carina list-packs`, `carina web`, `carina version`, `carina help`
- `src/setup/wizard.ts` - interactive first-run setup via `@inquirer/prompts`; writes `~/.carina/.env`
- `src/setup/install-pack.ts` - downloads `.tar.gz` from Skills Hub, extracts to `~/.carina/packs/`, runs ingestion
- `src/config/paths.ts` - `CARINA_HOME` (`~/.carina`), `CARINA_ENV_PATH`, `CARINA_DATA_DIR`, `CARINA_PACKS_DIR`
- `src/config/load-env.ts` - loads `~/.carina/.env` then local `.env`, `override: false` so local wins
- `src/skills/hub/server.ts` - Skills Hub Express app: `GET /packs`, `GET /packs/:name`, `GET /packs/:name/download`, `POST /packs` (with validation)
- `src/skills/hub/validate.ts` - pack validation: checks `pack.json`, minimum knowledge docs, scans for credentials
- `src/skills/hub/build-pack.ts` - `buildPack()`: archives skills and knowledge into `.tar.gz`
- `src/skills/hub/migrations.ts` - `carina_skills_hub` database schema
- `src/api/hosted.ts` - hosted mode: JWT auth, Stripe subscriptions (free 100/day, Pro £10/mo), `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/me`, `POST /webhooks/stripe`
- `src/api/hosted-auth.ts` - bcrypt passwords, JWT sign/verify, pg-backed user store, `incrementMessageCount`
- `src/api/hosted-migrations.ts` - hosted user/subscription schema
- `install.sh` - curl-pipe install script with Node 22 version check
- `package.json` `prepublishOnly`: `pnpm build && pnpm test`

## What Remains - In Priority Order

### 1. Tests (Highest Priority - Blocks npm Publish)

`pnpm test` currently runs only `src/skills/hub/validate.test.ts` and `src/skills/store.test.ts`. The `prepublishOnly` hook will pass with near-zero coverage, which is wrong.

Write tests before shipping. Use Vitest. Mock the database with a test-only in-memory SQLite or a real pg test database.

**Minimum test surface to cover:**

| File | Test cases |
|---|---|
| `src/memory/store.ts` | `saveMemory` inserts, `getSessionHistory` returns ordered, `searchRag` returns results |
| `src/tools/web-search.ts` | throws when key missing; parses Brave response correctly |
| `src/tools/file.ts` | blocks `..` traversal; blocks `/etc`; reads truncated at 100KB |
| `src/tools/http.ts` | blocks `http://`; blocks localhost; blocks 192.168.x |
| `src/tools/shell.ts` | blocks root execution |
| `src/agents/tool-runner.ts` | calls confirm before dangerous tools; returns `{error}` on unknown tool |
| `src/agents/carina.ts` | `buildContext` returns messages array; `turn` yields text events |
| `src/agents/orchestrator.ts` | `decompose` returns `singleAgent: true` for a simple question |
| `src/skills/auto-writer.ts` | does not save when `skillAutoWrite=false`; deduplicates at Jaccard threshold |

### 2. VitePress Documentation Content

VitePress is installed (`pnpm docs:dev` works). The `docs/` directory needs actual content.

Write the following files as standard VitePress Markdown:

```
docs/
├── index.md              what Carina is, install command, 30-second demo
├── .vitepress/config.ts  nav + sidebar config
├── getting-started.md    install, first run, setup wizard walkthrough
├── configuration.md      every .env variable, what it does, when it is needed
├── tools/
│   ├── overview.md
│   ├── web-search.md     BRAVE_SEARCH_API_KEY, limits, output format
│   ├── file.md           path rules, size limits, confirmation behaviour
│   ├── shell.md          Docker requirement, what is sandboxed, logging
│   ├── http.md           SSRF rules, HTTPS only, body limits
│   ├── email.md          Resend setup, inbound webhook config
│   └── code.md           JS and Python, Docker vs vm fallback
├── skill-packs/
│   ├── overview.md       what a pack contains, how loading works
│   ├── property-uk.md    the 6 built-in skills, PropertyData API
│   └── creating-packs.md pack.json schema, build-pack script, publish to Hub
└── gateways/
    ├── cli.md            commands reference
    ├── telegram.md       bot setup, polling vs webhook
    ├── whatsapp.md       Twilio setup, media handling
    └── web.md            SSE streaming, session ID, CORS_ORIGIN
```

The `.vitepress/config.ts` sidebar must match this structure exactly.

### 3. Session GC in GatewayRouter

`src/gateway/router.ts` keeps all `CarinaOrchestrator` instances in a `Map` forever. For the hosted product at `app.carinaai.uk` with real users this will leak memory.

Add a `lastSeen` timestamp per session and a periodic cleanup sweep:

```typescript
private agentMeta = new Map<string, { lastSeen: number }>();

// In getAgent(), update lastSeen on every access
// Add to constructor:
setInterval(() => this.evictStaleSessions(), 10 * 60 * 1000); // every 10 min

private evictStaleSessions(): void {
  const cutoff = Date.now() - config.carina.sessionTimeout;
  for (const [id, meta] of this.agentMeta) {
    if (meta.lastSeen < cutoff) {
      this.agents.delete(id);
      this.agentMeta.delete(id);
    }
  }
}
```

### 4. Ingestion File Cleanup

Two files do similar work:
- `src/skills/ingestion.ts` - the live file; handles `--pack` and `--skills-only` flags; reads from `archive/property-saas-spec/`
- `src/skills/ingest-pack.ts` - older version without the flag handling

Delete `src/skills/ingest-pack.ts`. The `pnpm ingest` script already points to `ingestion.ts`.

### 5. VPS Deployment

See `docker-compose.prod.yml`. Steps when ready to deploy:

```bash
# On Contabo VPS (80.190.81.208)
git clone git@github.com:verlox/carina.git /opt/carina
cd /opt/carina
cp laravel/.env.example .env   # <-- wrong, use root .env
# Fill in .env with production keys
docker compose -f docker-compose.prod.yml up -d

# Configure Nginx vhost for app.carinaai.uk
# Configure Certbot for carinaai.uk wildcard SSL
```

The `docker-compose.prod.yml` needs review before deploy - confirm it has the Node.js carina service, not just the old Laravel/Python services.

### 6. GitHub Repository

Before `npm publish`:
- Create `github.com/verlox/carina` (or `carinaai/carina` org)
- Push main branch
- Add `LICENSE` (MIT)
- Add `.github/workflows/ci.yml` - runs `pnpm install`, `pnpm build`, `pnpm test` on push
- Add `.github/workflows/publish.yml` - publishes to npm on tag push
- Update `package.json` `name: "carina-agent"` and confirm it is not taken on npm

### 7. `src/brain/router.ts` - Delete or Fill

This file was created as a stub and is never imported. Either delete it or implement it. It currently duplicates the concept handled by `LLMRouter` in `llm.ts`. Delete it.
