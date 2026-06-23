# Ops panel: auth, user management, and deploy notes

Agent reference for who logs in where, where admin user management lives, and how to deploy ops + Scout console changes without breaking production.

**Related:** `docs/DEPLOYMENT-GUIDE.md` (full stack deploy), `AGENTS.md` (repo layout), `scripts/deploy-carina.sh` (laptop to VPS rsync + compose).

---

## 1. Auth map (do not duplicate login systems)

| System | URL | Auth | Admin user management | Manage from ops? |
|--------|-----|------|----------------------|------------------|
| **ops.carinaai.uk** | `/login` | Email + password; roles: `superadmin`, `admin`, `viewer` | Ops panel operators | **Users** nav (superadmin only) |
| **app.carinaai.uk** | app login | better-auth (email + Google) | Cloud subscribers | **Fleet > All Tenants** (`/tenants`) |
| **core.carinaai.uk** | web UI | Single password (+ optional TOTP) | N/A (one operator) | **Settings** (Core Web Password) |
| **Scout dashboard** | `/dashboard` | Single password (`SCOUT_DASHBOARD_PASSWORD`) | N/A (operator only) | **Settings** (Scout console password) |
| **Scout customer accounts** | `/account/login` | Email + password; provisioned at checkout | Subscriber accounts | **Fleet > Scout Accounts** (`/scout/accounts`) |

### What not to build

- **core.carinaai.uk multi-user:** intentional single-operator agent UI.
- **Scout dashboard multi-user:** single operator password is correct.
- **Duplicate tenant UI for app.carinaai.uk:** `/tenants` already covers better-auth users in `carina_cloud`.
- **Public self-service admin for Scout accounts:** checkout + setup token flow stays; ops is the admin surface.

---

## 2. Ops panel operators (`/users`)

**Code:** `internal/admin/ops.carinaai.uk/routes/users.ts`, `lib/ops-users.ts`, `views/users/`.

| Action | Route |
|--------|-------|
| List | `GET /users` |
| Add | `GET/POST /users/new` |
| Edit | `GET/POST /users/:id/edit` |
| Deactivate / activate | `POST /users/:id/deactivate`, `POST /users/:id/activate` |
| Password reset link (24h, no email) | `POST /users/:id/reset-password` |
| Delete | `POST /users/:id/delete` (cannot delete last superadmin) |

**Access:** `requireSuperAdmin` on all `/users` routes. Nav link visible only for `superadmin` role (`views/layout.ejs`).

**Roles:**

- `superadmin` - full access including `/users`
- `admin` - full ops access except user management
- `viewer` - read-only (enforcement reserved for future work)

---

## 3. Cloud subscribers (`/tenants`)

**Code:** `internal/admin/ops.carinaai.uk/routes/tenants.ts`, `lib/tenants.ts`, `lib/tenant-provisioning.ts`.

Manages `app.carinaai.uk` users in the `carina_cloud` database (better-auth `users` / `accounts` tables): create tenant, suspend, plans, packs, impersonation, BYOK, audit.

When asked to "manage app.carinaai.uk users", extend or use **Fleet > All Tenants**, not a new page.

---

## 4. Scout customer accounts (`/scout/accounts`)

**Ops UI:** `internal/admin/ops.carinaai.uk/routes/scout-dashboard.ts` (`GET /scout/accounts` and POST actions), `views/scout/accounts.ejs`.

**Scout API (operator key only):** `internal/servers/console.labyrinthscout.com/src/api/admin.ts`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/admin/accounts` | List accounts with plan, status, key counts |
| POST | `/api/admin/accounts/:id/deactivate` | Block login and API keys |
| POST | `/api/admin/accounts/:id/activate` | Re-enable |
| POST | `/api/admin/accounts/:id/reset-password` | Returns 7-day setup token |
| POST | `/api/admin/accounts/:id/reset-api-key` | Revokes active keys; returns new key once |

**Scout lib:** `internal/servers/console.labyrinthscout.com/src/lib/accounts.ts` (`listAccounts`, `setAccountActive`, `adminResetAccountPassword`, `adminResetApiKey`).

**Auth guard:** `requireOperatorKeyOnly` in `src/middleware/operator-auth.ts`; subscriber API keys must not call these routes.

**Database:** `accounts.is_active` (boolean, default true). Migration in `src/migrations.ts` on Scout startup. Inactive accounts fail `verifyLogin()` and `findAccountByApiKey()`.

**Password setup links:** ops builds URLs as:

```text
{SCOUT_ACCOUNT_PUBLIC_URL}/account/activate?token={setupToken}
```

Default `SCOUT_ACCOUNT_PUBLIC_URL`: `https://console.labyrinthscout.com`. Set in ops `.env` (see `.env.example`).

**Ops to Scout proxy:** ops calls Scout console with `SCOUT_CONSOLE_URL` and `SCOUT_API_KEY` (`lib/scout.ts` -> `scoutConsoleGetDetailed`, `scoutConsolePost`).

---

## 5. Deploy: ops panel only

Ops production image uses **`docker/Dockerfile.runtime`**: it copies pre-built `dist/`, not TypeScript source. You must compile before the Docker build.

### From laptop (recommended)

```bash
cd internal/admin/ops.carinaai.uk
pnpm build

cd /path/to/carina
rsync -az \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='.pnpm-store' \
  internal/admin/ops.carinaai.uk/ \
  "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/ops.carinaai.uk/"

ssh "${VPS_USER}@${VPS_HOST}" bash -s <<'REMOTE'
set -euo pipefail
APPS_ROOT=/home/malike/apps   # adjust
cd "$APPS_ROOT/core.carinaai.uk"
export CARINA_OPS_CONTEXT="$APPS_ROOT/ops.carinaai.uk"
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
cp "$APPS_ROOT/ops.carinaai.uk/.env" .env.ops.runtime
python3 docker/scripts/sync-ops-env.py
docker compose -f docker-compose.prod.yml up -d --build --no-deps carina-ops
REMOTE
```

### Verify

```bash
curl -fsS https://ops.carinaai.uk/health
# Log in; open Fleet > Scout Accounts
docker exec corecarinaaiuk-carina-ops-1 printenv SCOUT_ACCOUNT_PUBLIC_URL
```

### Env to set on VPS (`ops.carinaai.uk/.env`)

| Variable | Purpose |
|----------|---------|
| `SCOUT_CONSOLE_URL` | Docker: `http://scout-console:4444` |
| `SCOUT_ADMIN_API_URL` | Docker: `http://scout-engine:4455` |
| `SCOUT_API_KEY` | Must match Scout console `SCOUT_API_KEY` |
| `SCOUT_ACCOUNT_PUBLIC_URL` | Password setup links in Scout Accounts UI |

After editing ops `.env`, re-run `sync-ops-env.py` and recreate `carina-ops` (see commands above).

---

## 6. Deploy: Scout console only

Scout's `Dockerfile` expects **monorepo build context** (`console.labyrinthscout.com/` + `core.carinaai.uk/packages/transport` under a common parent). Do **not** run `docker compose build` with `context: .` inside `console.labyrinthscout.com/` alone; it will fail with missing `console.labyrinthscout.com/src`.

### From laptop

```bash
cd internal/servers/console.labyrinthscout.com
pnpm build   # optional if building entirely on VPS via Docker

rsync -az \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='.pnpm-store' \
  internal/servers/console.labyrinthscout.com/ \
  "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/console.labyrinthscout.com/"
```

### On VPS (correct build)

```bash
APPS_ROOT=/home/malike/apps   # adjust
export SCOUT_DB_PASSWORD=secret   # must match running scout-postgres; or add to .env
export SCOUT_ENGINE_CONTEXT="$APPS_ROOT/scout-engine"

cd "$APPS_ROOT"
docker build -f console.labyrinthscout.com/Dockerfile \
  -t consolelabyrinthscoutcom-labyrinth-scout:latest .

cd "$APPS_ROOT/console.labyrinthscout.com"
set -a && source .env && set +a
docker compose -f docker-compose.prod.yml up -d --no-build labyrinth-scout
```

### Verify

```bash
curl -fsS https://console.labyrinthscout.com/api/readiness
curl -fsS -H "X-Scout-Key: $SCOUT_API_KEY" https://console.labyrinthscout.com/api/admin/accounts
docker exec scout-postgres psql -U scout -d scout -tAc \
  "SELECT column_name FROM information_schema.columns WHERE table_name='accounts' AND column_name='is_active';"
```

### Scout compose env note

`docker-compose.prod.yml` interpolates `SCOUT_DB_PASSWORD` for the Postgres service. The VPS `.env` may only have `SCOUT_DATABASE_URL`; export `SCOUT_DB_PASSWORD` before `docker compose up` if compose errors on missing password.

---

## 7. Deploy both (ops + Scout accounts feature)

Minimum path when you changed ops routes/views **and** Scout admin API:

1. `pnpm build` in `internal/admin/ops.carinaai.uk`
2. `pnpm build` in `internal/servers/console.labyrinthscout.com` (or rely on Docker build stage)
3. Rsync both directories to VPS (exclude `.env`, `node_modules`, `.pnpm-store`)
4. Rebuild `carina-ops` (section 5)
5. Rebuild Scout image from `$APPS_ROOT` (section 6)
6. Confirm `SCOUT_ACCOUNT_PUBLIC_URL` in ops env
7. Hit `/scout/accounts` logged in as superadmin

Full stack: `bash scripts/deploy-carina.sh` from repo root (rsyncs everything; may need manual Scout image build fix from section 6 until deploy script is updated).

---

## 8. Tests to run before handoff

```bash
cd internal/servers/console.labyrinthscout.com
pnpm exec vitest run src/api/__tests__/admin.test.ts src/lib/__tests__/accounts-provision.test.ts

cd internal/admin/ops.carinaai.uk
pnpm test   # if you changed scout-dashboard or scout lib
```

---

## 9. File index (quick lookup)

| Area | Path |
|------|------|
| Ops users CRUD | `internal/admin/ops.carinaai.uk/routes/users.ts` |
| Ops tenants | `internal/admin/ops.carinaai.uk/routes/tenants.ts` |
| Scout accounts ops UI | `internal/admin/ops.carinaai.uk/routes/scout-dashboard.ts` |
| Scout accounts view | `internal/admin/ops.carinaai.uk/views/scout/accounts.ejs` |
| Ops nav | `internal/admin/ops.carinaai.uk/views/layout.ejs` (Fleet group) |
| Scout admin API | `internal/servers/console.labyrinthscout.com/src/api/admin.ts` |
| Scout accounts lib | `internal/servers/console.labyrinthscout.com/src/lib/accounts.ts` |
| Operator-only middleware | `internal/servers/console.labyrinthscout.com/src/middleware/operator-auth.ts` |
| Accounts migration | `internal/servers/console.labyrinthscout.com/src/migrations.ts` |
| Ops env example | `internal/admin/ops.carinaai.uk/.env.example` |
| Ops runtime Dockerfile | `internal/admin/ops.carinaai.uk/docker/Dockerfile.runtime` |
| Scout Dockerfile (monorepo context) | `internal/servers/console.labyrinthscout.com/Dockerfile` |

---

**Last updated:** 2026-06-21
