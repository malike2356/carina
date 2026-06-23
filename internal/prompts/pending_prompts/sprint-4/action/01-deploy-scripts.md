# Sprint 7 - Prompt 01: Atomic Deploy Scripts

**Sprint:** 7 - Infrastructure
**Prompt number:** 01 of 04
**Name:** Atomic deploy scripts for all four apps, PM2 process management, rollback
**Primary agent:** Claude Code
**Estimated hours:** 6-8 h
**Depends on:** Nothing. Can build independently.

---

## Post-build (MANDATORY)

When all "Done When" criteria below are satisfied:

1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Add a "**What was built:**" bullet list.
3. Move this file to `internal/prompts/archived_prompts/archives_from_pending_prompts/sprint-7/infra/`.

---

## Read First

1. `app.carinaai.uk/deploy.sh` - existing deploy script; migrate any useful parts
2. `core.carinaai.uk/` root - check for any existing deploy or start scripts
3. All `package.json` files for each app - confirm build commands and start commands
4. Run `pm2 list` on VPS to see what is already running before writing ecosystem files

---

## Context

The current deploy approach is rsync-based. For static files this is acceptable. For Next.js
and Node.js apps it is not: rsync mid-deploy can leave a half-updated build serving requests.

The replacement pattern is releases directories with symlink swaps:

```
/var/www/app.carinaai.uk/
  releases/
    20260623-143000/   <- previous release (kept for rollback)
    20260623-151200/   <- current release
  current -> releases/20260623-151200   <- Nginx and PM2 point here
  shared/
    .env               <- persistent env file, never in git, never deleted between releases
    logs/              <- PM2 logs (persistent across releases)
```

On every deploy:
1. Create a new timestamped release directory
2. Copy code into it (git pull or rsync from local)
3. Install dependencies inside the release directory
4. Build the app inside the release directory
5. Verify the build succeeded (check for `.next/` dir, or `dist/`, or `index.js`)
6. Swap the `current` symlink atomically (`ln -sfn` is atomic on Linux)
7. Reload PM2 to pick up the new symlink target
8. Run a health check against the live endpoint
9. If health check fails: swap symlink back to previous release and reload PM2 (rollback)
10. Delete releases older than the last 3, to reclaim disk space

---

## Step 1: PM2 ecosystem files

Create one PM2 ecosystem file per app. These live in the repo so they can be versioned.

**`backends/servers/core.carinaai.uk/ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'carina-core',
    script: 'dist/server.js',
    cwd: '/var/www/core.carinaai.uk/current',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env_file: '/var/www/core.carinaai.uk/shared/.env',
    error_file: '/var/www/core.carinaai.uk/shared/logs/error.log',
    out_file: '/var/www/core.carinaai.uk/shared/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
  }],
};
```

**`frontends/client-apps/app.carinaai.uk/ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'carina-app',
    script: 'node_modules/.bin/next',
    args: 'start -p 3000',
    cwd: '/var/www/app.carinaai.uk/current',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '768M',
    env_file: '/var/www/app.carinaai.uk/shared/.env',
    error_file: '/var/www/app.carinaai.uk/shared/logs/error.log',
    out_file: '/var/www/app.carinaai.uk/shared/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 15000,
  }],
};
```

**`frontends/client-apps/admin.carinaai.uk/ecosystem.config.js`:**
```javascript
module.exports = {
  apps: [{
    name: 'carina-admin',
    script: 'node_modules/.bin/next',
    args: 'start -p 3001',
    cwd: '/var/www/admin.carinaai.uk/current',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '512M',
    env_file: '/var/www/admin.carinaai.uk/shared/.env',
    error_file: '/var/www/admin.carinaai.uk/shared/logs/error.log',
    out_file: '/var/www/admin.carinaai.uk/shared/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    listen_timeout: 15000,
  }],
};
```

---

## Step 2: Shared deploy library

Create `/opt/verlox/scripts/deploy-lib.sh` on the VPS (also commit as
`infrastructure/scripts/deploy-lib.sh` in the repo so it can be reviewed):

```bash
#!/usr/bin/env bash
set -euo pipefail

KEEP_RELEASES=3

# Usage: create_release_dir /var/www/app.carinaai.uk
create_release_dir() {
  local base_dir="$1"
  local ts
  ts=$(date +%Y%m%d-%H%M%S)
  local release_dir="$base_dir/releases/$ts"
  mkdir -p "$release_dir"
  mkdir -p "$base_dir/shared/logs"
  echo "$release_dir"
}

# Usage: swap_symlink /var/www/app.carinaai.uk /var/www/app.carinaai.uk/releases/20260623-151200
swap_symlink() {
  local base_dir="$1"
  local release_dir="$2"
  ln -sfn "$release_dir" "$base_dir/current"
}

# Usage: previous_release /var/www/app.carinaai.uk
# Prints path to the second-newest release directory, or empty string if none
previous_release() {
  local base_dir="$1"
  ls -1dt "$base_dir/releases/"*/ 2>/dev/null | sed -n '2p' | sed 's|/$||'
}

# Usage: rollback /var/www/app.carinaai.uk pm2-process-name
rollback() {
  local base_dir="$1"
  local pm2_name="$2"
  local prev
  prev=$(previous_release "$base_dir")
  if [ -z "$prev" ]; then
    echo "ERROR: No previous release to roll back to." >&2
    return 1
  fi
  echo "Rolling back to: $prev"
  swap_symlink "$base_dir" "$prev"
  pm2 reload "$pm2_name"
  echo "Rollback complete."
}

# Usage: health_check http://localhost:3000/api/health 30
# Polls until 200 response or timeout (seconds)
health_check() {
  local url="$1"
  local timeout="${2:-30}"
  local elapsed=0
  echo "Health check: $url (timeout: ${timeout}s)"
  until curl -sf "$url" > /dev/null 2>&1; do
    if [ "$elapsed" -ge "$timeout" ]; then
      echo "ERROR: Health check timed out after ${timeout}s" >&2
      return 1
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo "Health check passed (${elapsed}s)."
}

# Usage: prune_releases /var/www/app.carinaai.uk 3
prune_releases() {
  local base_dir="$1"
  local keep="${2:-$KEEP_RELEASES}"
  local releases
  releases=$(ls -1dt "$base_dir/releases/"*/ 2>/dev/null | sed 's|/$||')
  local count
  count=$(echo "$releases" | grep -c . || true)
  if [ "$count" -le "$keep" ]; then
    return 0
  fi
  echo "$releases" | tail -n +"$((keep + 1))" | while read -r old; do
    echo "Removing old release: $old"
    rm -rf "$old"
  done
}
```

---

## Step 3: Core backend deploy script

Create `infrastructure/scripts/deploy-core.sh`:

```bash
#!/usr/bin/env bash
# Deploy core.carinaai.uk to VPS
# Usage: ./deploy-core.sh [--rollback]
set -euo pipefail

BASE_DIR="/var/www/core.carinaai.uk"
PM2_NAME="carina-core"
HEALTH_URL="http://localhost:4000/health"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CORE_SRC="$REPO_DIR/backends/servers/core.carinaai.uk"

source /opt/verlox/scripts/deploy-lib.sh

if [ "${1:-}" = "--rollback" ]; then
  rollback "$BASE_DIR" "$PM2_NAME"
  exit 0
fi

echo "=== Deploying carina-core ==="

RELEASE_DIR=$(create_release_dir "$BASE_DIR")
echo "Release directory: $RELEASE_DIR"

# Copy source (exclude node_modules, dist, .env)
rsync -a --exclude='node_modules' --exclude='dist' --exclude='.env' \
  "$CORE_SRC/" "$RELEASE_DIR/"

# Install dependencies (production only)
cd "$RELEASE_DIR"
npm ci --omit=dev

# Build TypeScript
npm run build

# Verify build output exists
if [ ! -f "$RELEASE_DIR/dist/server.js" ]; then
  echo "ERROR: dist/server.js not found after build. Aborting." >&2
  rm -rf "$RELEASE_DIR"
  exit 1
fi

# Copy ecosystem config
cp "$RELEASE_DIR/ecosystem.config.js" "$BASE_DIR/ecosystem.config.js"

# Swap symlink
swap_symlink "$BASE_DIR" "$RELEASE_DIR"

# Reload PM2 (graceful: waits for requests to finish)
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start "$BASE_DIR/ecosystem.config.js" --only "$PM2_NAME"
fi

# Health check - rollback if it fails
if ! health_check "$HEALTH_URL" 30; then
  echo "Health check failed. Rolling back..." >&2
  rollback "$BASE_DIR" "$PM2_NAME"
  exit 1
fi

prune_releases "$BASE_DIR"
pm2 save

echo "=== carina-core deployed successfully ==="
```

---

## Step 4: Customer workspace deploy script

Create `infrastructure/scripts/deploy-app.sh`:

```bash
#!/usr/bin/env bash
# Deploy app.carinaai.uk to VPS
set -euo pipefail

BASE_DIR="/var/www/app.carinaai.uk"
PM2_NAME="carina-app"
HEALTH_URL="http://localhost:3000/api/health"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_SRC="$REPO_DIR/frontends/client-apps/app.carinaai.uk"

source /opt/verlox/scripts/deploy-lib.sh

if [ "${1:-}" = "--rollback" ]; then
  rollback "$BASE_DIR" "$PM2_NAME"
  exit 0
fi

echo "=== Deploying carina-app ==="

RELEASE_DIR=$(create_release_dir "$BASE_DIR")

rsync -a --exclude='node_modules' --exclude='.next' --exclude='.env*' \
  "$APP_SRC/" "$RELEASE_DIR/"

cd "$RELEASE_DIR"

# Symlink shared .env so Next.js build picks it up
ln -sf "$BASE_DIR/shared/.env" "$RELEASE_DIR/.env"
ln -sf "$BASE_DIR/shared/.env.local" "$RELEASE_DIR/.env.local" 2>/dev/null || true

npm ci --omit=dev
npm run build

# Verify .next/standalone or .next/BUILD_ID exists
if [ ! -f "$RELEASE_DIR/.next/BUILD_ID" ]; then
  echo "ERROR: .next/BUILD_ID not found. Build failed. Aborting." >&2
  rm -rf "$RELEASE_DIR"
  exit 1
fi

cp "$RELEASE_DIR/ecosystem.config.js" "$BASE_DIR/ecosystem.config.js"
swap_symlink "$BASE_DIR" "$RELEASE_DIR"

if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start "$BASE_DIR/ecosystem.config.js" --only "$PM2_NAME"
fi

if ! health_check "$HEALTH_URL" 45; then
  echo "Health check failed. Rolling back..." >&2
  rollback "$BASE_DIR" "$PM2_NAME"
  exit 1
fi

prune_releases "$BASE_DIR"
pm2 save

echo "=== carina-app deployed successfully ==="
```

---

## Step 5: Admin dashboard deploy script

Create `infrastructure/scripts/deploy-admin.sh`:

```bash
#!/usr/bin/env bash
# Deploy admin.carinaai.uk to VPS
set -euo pipefail

BASE_DIR="/var/www/admin.carinaai.uk"
PM2_NAME="carina-admin"
HEALTH_URL="http://localhost:3001/api/health"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_SRC="$REPO_DIR/frontends/client-apps/admin.carinaai.uk"

source /opt/verlox/scripts/deploy-lib.sh

if [ "${1:-}" = "--rollback" ]; then
  rollback "$BASE_DIR" "$PM2_NAME"
  exit 0
fi

echo "=== Deploying carina-admin ==="

RELEASE_DIR=$(create_release_dir "$BASE_DIR")

rsync -a --exclude='node_modules' --exclude='.next' --exclude='.env*' \
  "$APP_SRC/" "$RELEASE_DIR/"

cd "$RELEASE_DIR"

ln -sf "$BASE_DIR/shared/.env" "$RELEASE_DIR/.env"
ln -sf "$BASE_DIR/shared/.env.local" "$RELEASE_DIR/.env.local" 2>/dev/null || true

npm ci --omit=dev
npm run build

if [ ! -f "$RELEASE_DIR/.next/BUILD_ID" ]; then
  echo "ERROR: .next/BUILD_ID not found. Build failed. Aborting." >&2
  rm -rf "$RELEASE_DIR"
  exit 1
fi

cp "$RELEASE_DIR/ecosystem.config.js" "$BASE_DIR/ecosystem.config.js"
swap_symlink "$BASE_DIR" "$RELEASE_DIR"

if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 reload "$PM2_NAME" --update-env
else
  pm2 start "$BASE_DIR/ecosystem.config.js" --only "$PM2_NAME"
fi

if ! health_check "$HEALTH_URL" 45; then
  echo "Health check failed. Rolling back..." >&2
  rollback "$BASE_DIR" "$PM2_NAME"
  exit 1
fi

prune_releases "$BASE_DIR"
pm2 save

echo "=== carina-admin deployed successfully ==="
```

---

## Step 6: Hire page (static) deploy script

Create `infrastructure/scripts/deploy-aiva.sh`:

```bash
#!/usr/bin/env bash
# Deploy carinaai.uk/aiva/ static files to VPS
# The hire page is static HTML/CSS/JS served directly by Nginx
set -euo pipefail

STATIC_ROOT="/var/www/carinaai.uk"
AIVA_DEST="$STATIC_ROOT/aiva"
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
HIRE_SRC="$REPO_DIR/frontends/marketing/carinaai.uk/aiva"

echo "=== Deploying hire page ==="

# Atomic: rsync to a temp dir then rename
TMP_DIR="$STATIC_ROOT/aiva_tmp_$(date +%s)"
mkdir -p "$TMP_DIR"

rsync -a --delete "$HIRE_SRC/" "$TMP_DIR/"

# Swap (rename is atomic on same filesystem)
if [ -d "$AIVA_DEST" ]; then
  mv "$AIVA_DEST" "$STATIC_ROOT/aiva_old_$(date +%s)"
fi
mv "$TMP_DIR" "$AIVA_DEST"

# Remove old backup dirs (keep last 2 only)
ls -1dt "$STATIC_ROOT/aiva_old_"* 2>/dev/null | tail -n +3 | xargs -r rm -rf

echo "=== Hire page deployed successfully ==="
```

---

## Step 7: Deploy all script

Create `infrastructure/scripts/deploy-all.sh`:

```bash
#!/usr/bin/env bash
# Deploy all four apps in order
# Usage: ./deploy-all.sh [--rollback]
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "${1:-}" = "--rollback" ]; then
  echo "=== Rolling back all apps ==="
  "$SCRIPTS_DIR/deploy-core.sh" --rollback
  "$SCRIPTS_DIR/deploy-app.sh" --rollback
  "$SCRIPTS_DIR/deploy-admin.sh" --rollback
  echo "=== All apps rolled back ==="
  exit 0
fi

echo "=== Deploying all apps ==="

# Core first - frontend apps depend on it
"$SCRIPTS_DIR/deploy-core.sh"

# Then frontends in parallel
"$SCRIPTS_DIR/deploy-app.sh" &
"$SCRIPTS_DIR/deploy-admin.sh" &
wait

"$SCRIPTS_DIR/deploy-aiva.sh"

echo "=== All apps deployed successfully ==="
```

---

## Step 8: PM2 startup on boot

On the VPS, after all apps are first started:

```bash
pm2 startup systemd   # generates a systemctl command - run the output command
pm2 save              # saves the current process list
```

Add these instructions to `infrastructure/VPS-SETUP.md` (a new file in the repo):

```markdown
# VPS First-Time Setup

1. Install Node.js 20 LTS via nvm
2. npm install -g pm2
3. Create app directories:
   mkdir -p /var/www/{core.carinaai.uk,app.carinaai.uk,admin.carinaai.uk,carinaai.uk}/{releases,shared/logs}
4. Copy .env files to each shared/ directory (get from _local/secrets or 1Password)
5. Run deploy-all.sh for first deploy
6. pm2 startup systemd  (run the printed command)
7. pm2 save
8. Copy /opt/verlox/scripts/deploy-lib.sh from the repo
```

---

## Step 9: Database migration deploy step

When a deploy includes a new DB migration, the migration must run BEFORE the new code goes live.

Add to `deploy-core.sh` (after npm run build, before swap_symlink):

```bash
# Run pending DB migrations if migration files are newer than last deploy marker
MIGRATION_DIR="$RELEASE_DIR/src/db/migrations"
MARKER_FILE="$BASE_DIR/shared/.last_migration"

if [ -d "$MIGRATION_DIR" ]; then
  for migration in $(ls "$MIGRATION_DIR"/*.sql | sort); do
    name=$(basename "$migration")
    if [ ! -f "$MARKER_FILE" ] || [ "$migration" -nt "$MARKER_FILE" ]; then
      echo "Running migration: $name"
      psql "$DATABASE_URL" -f "$migration"
      touch "$MARKER_FILE"
      echo "$name" >> "$BASE_DIR/shared/migration-history.log"
    fi
  done
fi
```

`DATABASE_URL` is read from the shared `.env` file. The marker file approach prevents re-running
already-applied migrations. If a migration fails, the deploy aborts before the symlink swap, so
the old code stays live against the partially-migrated DB.

Note: migrations must be written idempotently (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) so a
re-run due to marker file issues does not corrupt data. Enforce this in code review.

---

## Done When

- [ ] `infrastructure/scripts/deploy-lib.sh` exists with `create_release_dir`, `swap_symlink`, `previous_release`, `rollback`, `health_check`, `prune_releases`
- [ ] `deploy-core.sh` builds TypeScript, verifies `dist/server.js`, swaps symlink, reloads PM2, rolls back on health check failure
- [ ] `deploy-app.sh` builds Next.js, verifies `.next/BUILD_ID`, swaps symlink, reloads PM2, rolls back on failure
- [ ] `deploy-admin.sh` same as deploy-app.sh on port 3001
- [ ] `deploy-aiva.sh` rsync to temp dir then atomic rename
- [ ] `deploy-all.sh` runs core first, then app and admin in parallel, then hire
- [ ] `--rollback` flag works on all scripts and on `deploy-all.sh`
- [ ] PM2 ecosystem files exist in all three app repos with correct ports, env_file paths, and log paths
- [ ] `infrastructure/VPS-SETUP.md` documents the first-time setup procedure
- [ ] Migration step in deploy-core.sh runs pending SQL files and records them in migration-history.log
- [ ] Old releases pruned to last 3 after each successful deploy
- [ ] All scripts are executable (`chmod +x`)
- [ ] No hardcoded secrets in any script
- [ ] Scripts tested on VPS (dry run with `bash -n` for syntax check, then live deploy)
