# Carina / Labyrinth Scout: Internal Architecture Guide

Internal reference for VERLOX. Explains what each piece in this monorepo is, who it is for, and exactly how they talk to each other. Read this before changing any cross-project wiring (env vars, API routes, Redis channels).

## The five pieces

| Piece | Directory | Port (local) | Audience | Shipped to customers? |
|---|---|---|---|---|
| Carina agent | `core.carinaai.uk/` | 3333 | End users (property professionals) | Yes - npm package + Docker image |
| Carina marketing site | `carinaai.uk/` | static | Prospects | Yes - static files to carinaai.uk |
| Platform admin (ops) | `ops.carinaai.uk/` | 4000 | VERLOX only | No - never shipped |
| Labyrinth Scout console | `console.labyrinthscout.com/` | 4444 | Carina operators who buy security monitoring | Yes - Docker image `verlox/scout` |
| Scout marketing site | `labyrinthscout.com/` | static | Prospects | Yes - static files to labyrinthscout.com |

Two product lines live in this repo:
- **Carina** - the AI agent itself. MIT licensed, always free.
- **Labyrinth Scout** - the paid security add-on that watches Carina instances for misbehaviour (prompt injection, runaway tool use, secret leakage, etc).

`ops.carinaai.uk` is the shared control room VERLOX uses to run both: it talks to a local Carina instance over HTTP and to Scout over its admin API.

## How they connect

### 1. Carina -> Scout: security event reporting

```
Carina agent  ->  src/security/scout-client.ts  ->  POST {SCOUT_URL}/api/events
                                                  ->  POST {SCOUT_URL}/api/heartbeat
```

- `scout-client.ts` batches `ScoutEvent` records (severity, source, event_type, description, metadata, session_id, instance_id) and POSTs them to the paired Scout console.
- Auth is a shared secret: every request carries `X-Scout-Key: {SCOUT_API_KEY}`. Scout validates this against the API keys it issued (see "Pairing" below).
- `sanitiseParams()` redacts anything that looks like a secret (API key patterns, bearer/basic auth headers, 64-char hex blobs) before it ever leaves the Carina process - Scout never sees raw credentials.
- Reporting is fire-and-forget with a 2-second timeout. **Scout never blocks Carina** - if Scout is unreachable, Carina logs a warning once and keeps running normally.
- Controlled entirely by env vars (see "Pairing" below); `LABYRINTH_ENABLED=false` means zero integration, Carina behaves identically.

### 2. Scout -> Carina: the kill switch (control channel)

```
Scout  ->  Redis pub: "labyrinth:control"  ->  src/security/kill-switch-listener.ts
```

- This is the reverse direction: Scout can reach back into a running Carina instance and constrain it, without Carina polling anything.
- `kill-switch-listener.ts` subscribes to the Redis channel `labyrinth:control` and applies payloads addressed to its own `instance_id` (others are ignored):
  - `suspend` / `resume` - halts/resumes the whole agent (`checkNotSuspended()` is checked before agent actions run; throws with the operator-supplied reason)
  - block a specific session (`isSessionBlocked`)
  - quarantine a specific tool for this instance (`isToolQuarantined`) - in-memory, lost on restart
  - operator-blocked egress domains (`isOperatorBlocked`) - in-memory, lost on restart
  - per-session rate-limit overrides (`getSessionRateLimit`)
- All suspension events are appended to `data/logs/labyrinth-suspend.log` for audit.
- This is a one-way trust relationship: Scout can throttle or stop Carina, Carina cannot reach into Scout's policy engine.

### 3. Pairing: how a Carina instance gets connected to a Scout account

Five env vars on the Carina side drive the whole integration (set in `core.carinaai.uk/.env` or via `~/.carina/.env`):

```
LABYRINTH_ENABLED=true
LABYRINTH_URL=https://console.labyrinthscout.com
LABYRINTH_API_KEY=lscout_...
LABYRINTH_INSTANCE_ID=carina-{hostname}
LABYRINTH_INSTANCE_NAME=Carina ({hostname})
```

There are now **two ways to populate them**, both landed 2026-06-07:

1. **First-run setup wizard** (`core.carinaai.uk/src/setup/wizard.ts`): after choosing an LLM provider and the property-uk pack, the wizard asks "Connect to Labyrinth Scout for AI agent security monitoring?" If yes, it prompts for an API key (registered at `console.labyrinthscout.com/account/register`), derives `LABYRINTH_INSTANCE_ID`/`LABYRINTH_INSTANCE_NAME` from `os.hostname()`, and writes all five vars into the new `.env`.
2. **Ops settings panel** (`ops.carinaai.uk/routes/settings.ts`, route `POST /settings/scout-pairing`): lets VERLOX paste a Scout API key into a running ops instance after the fact. It writes `SCOUT_API_KEY` into `ops.carinaai.uk/.env` in place via the `setEnvVar()` helper (regex replace-or-append, keeps `process.env` in sync so it takes effect immediately, no restart). The settings page shows live "Paired" / "Not paired" status based on whether `SCOUT_API_KEY` is set.

To get a key in the first place, an operator registers an account at `console.labyrinthscout.com/account/register` (the new account system - see below) and generates an API key from their dashboard.

### 4. The Scout account system (new, 2026-06-07)

`console.labyrinthscout.com` used to be a single shared instance with no per-operator accounts. It now has:
- `accounts` / `account_api_keys` tables (see `src/migrations.ts`, runs automatically on startup via `initDb()` -> `runMigrations()`, confirmed by the `[scout:migrations] Schema ready` log line)
- `src/api/account.ts` mounted at `/account` (`accountRouter`) - registration/login/key management pages
- `src/lib/accounts.ts`, `src/middleware/account-session.ts` - session and password (bcryptjs) handling
- Every event/status/heartbeat API route requires `requireApiKey` middleware, validated against `account_api_keys`

This is what makes the wizard/settings pairing flow possible: a real account + generated key to paste in, instead of a shared instance-wide secret.

### 5. ops.carinaai.uk: the shared control room

`ops.carinaai.uk` (port 4000, password-gated, single VERLOX admin) is a thin Express/EJS panel that proxies into both products rather than re-implementing anything:

```
ops.carinaai.uk  --[fetch http://localhost:3333/api/...]-->  Carina agent (CARINA_API_URL)
ops.carinaai.uk  --[scoutGet() helper -> http://localhost:4444/api/...]-->  Scout console (SCOUT_URL, requires X-Scout-Key)
```

Settings tab responsibilities (`routes/settings.ts` + `views/settings.ejs`):
- Test Carina / Test Scout connectivity buttons (`POST /settings/test-carina`, `/settings/test-scout`)
- Change the Scout console's HTTP Basic Auth password (`POST /settings/scout-password` - rewrites `.htpasswd` via `openssl passwd -apr1`, takes effect immediately, no app restart, since nginx reads `.htpasswd` per-request)
- Pair this Carina instance with a Scout account (`POST /settings/scout-pairing`, described above)
- Read-only environment summary (masks secrets)

### 6. The marketing sites

Both `carinaai.uk/` and `labyrinthscout.com/` are static HTML/CSS/vanilla-JS sites with no backend of their own:
- They share a single subscribe endpoint: `POST https://carinaai.uk/api/subscribe` (handled by `core.carinaai.uk`'s `subscribeRouter`) for waitlist signups, with a `localStorage` fallback so a lead is never lost if the API is briefly down.
- `labyrinthscout.com` is purely a funnel into `console.labyrinthscout.com/account/register`.
- Deployed independently of the Node apps: plain `rsync` of static files to `/www/wwwroot/{domain}/` on the Contabo VPS (no build step, no supervisor process - nginx serves the files directly).

## Deployment summary

| Piece | How it ships | Where |
|---|---|---|
| `core.carinaai.uk` | `npm install -g carina-agent` / Docker image, `deploy.sh` | Contabo VPS 80.190.81.208 |
| `console.labyrinthscout.com` | rsync + `npm run build` + `supervisorctl restart labyrinth-scout`, via `scripts/deploy-scout.sh` | `/home/malike/apps/console.labyrinthscout.com`, port 4444, nginx + `.htpasswd` in front |
| `ops.carinaai.uk` | VERLOX-only, runs on the same VPS | port 4000, never exposed to customers |
| `carinaai.uk` / `labyrinthscout.com` | `rsync` of static files only | `/www/wwwroot/{domain}/` |

## Trust model, in one paragraph

Carina is the product; Scout is the supervisor. Carina pushes sanitised telemetry to Scout and never blocks on the response. Scout can push back through a single Redis channel to suspend, throttle, or quarantine a specific Carina instance, and every such action is logged for audit. Neither side can read the other's secrets: Carina redacts before sending, and pairing is via scoped per-account API keys rather than a shared master secret. ops.carinaai.uk is a human-facing proxy over both, kept intentionally thin so it never becomes a third source of truth.
