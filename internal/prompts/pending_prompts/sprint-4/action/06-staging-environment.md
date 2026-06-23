# Sprint 4 - Prompt i/01: Staging Environment

**Sprint:** 4 - Foundation
**Prompt number:** i/01
**Name:** Staging environment on the same VPS, separate DB, Stripe test mode, staging deploy scripts
**Primary agent:** Claude Code
**Estimated hours:** 4-5 h
**Depends on:** sprint-7/infra/01-deploy-scripts.md (deploy scripts must exist; staging extends them)

---

## Post-build (MANDATORY)

When all "Done When" criteria are satisfied:
1. Add `**Status: COMPLETED YYYY-MM-DD**` at the top of this file.
2. Move to `internal/prompts/archived_prompts/pending_prompts/sprint-4/i/`.

---

## Read First

1. `infrastructure/scripts/deploy-lib.sh` - the shared deploy library from sprint-7; staging scripts use this
2. `infrastructure/scripts/deploy-core.sh` - production deploy script; staging script is a parameterized version of this
3. `infrastructure/VPS-SETUP.md` - production VPS setup; staging setup is appended here
4. All existing `.env.example` files - staging needs its own `.env.staging` files

---

## Step 1: Staging directory structure on VPS

```bash
# Create staging directories (run once on VPS)
mkdir -p /var/www/staging.core.carinaai.uk/{releases,shared/logs}
mkdir -p /var/www/staging.app.carinaai.uk/{releases,shared/logs}
mkdir -p /var/www/staging.admin.carinaai.uk/{releases,shared/logs}

# Create staging PostgreSQL database
psql -U postgres -c "CREATE DATABASE carina_staging OWNER [DB_USER];"
```

---

## Step 2: Staging .env files

Staging `.env` files live at `/var/www/staging.*/shared/.env`. They are never committed to git.

Key differences from production `.env`:
```env
NODE_ENV=staging

# Staging DB
DATABASE_URL=postgresql://[user]:[pass]@localhost:5432/carina_staging

# Stripe TEST mode
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...   # from Stripe CLI stripe listen (for local) or test endpoint

# Stripe test price IDs (run stripe:setup-aiva with test key to create these)
STRIPE_PRICE_AIVA_STARTER_MONTHLY=price_test_...
# etc.

# Feature flags
AIVA_BILLING_ENABLED=true
AIVA_SCOUT_FLEET_ENABLED=false   # disable Scout in staging to avoid polluting Scout data
AIVA_CHAIN_ATTEST_ENABLED=false  # disable attestation in staging

# Sentry: use the same project but tag as staging environment
SENTRY_DSN_CORE=[same DSN]       # Sentry uses environment='staging' to separate issues

# Resend: use a test API key or configure a test inbox
RESEND_PREVIEW_MODE=true         # log emails instead of sending them in staging
```

Document in `infrastructure/VPS-SETUP.md`:
```markdown
## Staging Environment

Staging apps run on the same VPS, different ports:
- staging.core.carinaai.uk -> port 4001
- staging.app.carinaai.uk -> port 3002
- staging.admin.carinaai.uk -> port 3003

Staging database: carina_staging (separate from carina_production)
Stripe mode: test (sk_test_... keys)
Emails: preview mode (logged, not sent)
Scout: disabled
Blockchain: disabled
```

---

## Step 3: Staging PM2 ecosystem files

Each staging PM2 process has a different name and port:

`infrastructure/ecosystem.staging.js` (one file for all staging processes):

```javascript
module.exports = {
  apps: [
    {
      name: 'carina-core-staging',
      script: 'dist/server.js',
      cwd: '/var/www/staging.core.carinaai.uk/current',
      instances: 1,
      env_file: '/var/www/staging.core.carinaai.uk/shared/.env',
      error_file: '/var/www/staging.core.carinaai.uk/shared/logs/error.log',
      out_file: '/var/www/staging.core.carinaai.uk/shared/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      autorestart: true,
      env: { PORT: '4001' },
    },
    {
      name: 'carina-app-staging',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      cwd: '/var/www/staging.app.carinaai.uk/current',
      instances: 1,
      env_file: '/var/www/staging.app.carinaai.uk/shared/.env',
      error_file: '/var/www/staging.app.carinaai.uk/shared/logs/error.log',
      out_file: '/var/www/staging.app.carinaai.uk/shared/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      autorestart: true,
    },
    {
      name: 'carina-admin-staging',
      script: 'node_modules/.bin/next',
      args: 'start -p 3003',
      cwd: '/var/www/staging.admin.carinaai.uk/current',
      instances: 1,
      env_file: '/var/www/staging.admin.carinaai.uk/shared/.env',
      error_file: '/var/www/staging.admin.carinaai.uk/shared/logs/error.log',
      out_file: '/var/www/staging.admin.carinaai.uk/shared/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      watch: false,
      autorestart: true,
    },
  ],
};
```

---

## Step 4: Staging deploy scripts

Create `infrastructure/scripts/deploy-staging.sh`:

```bash
#!/usr/bin/env bash
# Deploy all apps to the staging environment
# Usage: ./deploy-staging.sh [--rollback]
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPTS_DIR/../.." && pwd)"

source /opt/verlox/scripts/deploy-lib.sh

deploy_staging_app() {
  local app_name="$1"       # e.g. 'carina-core-staging'
  local base_dir="$2"       # e.g. '/var/www/staging.core.carinaai.uk'
  local src_dir="$3"        # e.g. "$REPO_DIR/backends/servers/core.carinaai.uk"
  local build_cmd="$4"      # e.g. 'npm run build'
  local verify_path="$5"    # e.g. 'dist/server.js' or '.next/BUILD_ID'
  local health_url="$6"

  if [ "${1:-}" = "--rollback" ]; then
    rollback "$base_dir" "$app_name"
    return
  fi

  echo "=== Deploying $app_name ==="
  RELEASE_DIR=$(create_release_dir "$base_dir")

  rsync -a --exclude='node_modules' --exclude='dist' --exclude='.next' --exclude='.env*' \
    "$src_dir/" "$RELEASE_DIR/"

  cd "$RELEASE_DIR"
  ln -sf "$base_dir/shared/.env" "$RELEASE_DIR/.env"
  npm ci --omit=dev
  eval "$build_cmd"

  if [ ! -e "$RELEASE_DIR/$verify_path" ]; then
    echo "ERROR: $verify_path not found. Build failed." >&2
    rm -rf "$RELEASE_DIR"
    return 1
  fi

  swap_symlink "$base_dir" "$RELEASE_DIR"

  if pm2 describe "$app_name" > /dev/null 2>&1; then
    pm2 reload "$app_name" --update-env
  else
    pm2 start /opt/verlox/infrastructure/ecosystem.staging.js --only "$app_name"
  fi

  health_check "$health_url" 30 || {
    rollback "$base_dir" "$app_name"
    return 1
  }

  prune_releases "$base_dir"
  echo "=== $app_name deployed ==="
}

if [ "${1:-}" = "--rollback" ]; then
  rollback /var/www/staging.core.carinaai.uk carina-core-staging
  rollback /var/www/staging.app.carinaai.uk carina-app-staging
  rollback /var/www/staging.admin.carinaai.uk carina-admin-staging
  exit 0
fi

deploy_staging_app "carina-core-staging" \
  "/var/www/staging.core.carinaai.uk" \
  "$REPO_DIR/backends/servers/core.carinaai.uk" \
  "npm run build" \
  "dist/server.js" \
  "http://localhost:4001/health"

deploy_staging_app "carina-app-staging" \
  "/var/www/staging.app.carinaai.uk" \
  "$REPO_DIR/frontends/client-apps/app.carinaai.uk" \
  "npm run build" \
  ".next/BUILD_ID" \
  "http://localhost:3002/api/health" &

deploy_staging_app "carina-admin-staging" \
  "/var/www/staging.admin.carinaai.uk" \
  "$REPO_DIR/frontends/client-apps/admin.carinaai.uk" \
  "npm run build" \
  ".next/BUILD_ID" \
  "http://localhost:3003/api/health" &

wait
pm2 save
echo "=== Staging deploy complete ==="
```

---

## Step 5: Nginx staging config

Add to `/etc/nginx/sites-available/staging`:

```nginx
# Staging environments - restricted to VERLOX team IPs only
# (same IP allowlist as admin.carinaai.uk)

geo $staging_allowed {
    default 0;
    # Same IPs as admin.carinaai.uk geo block - copy here
}

server {
    listen 443 ssl;
    server_name staging.core.carinaai.uk;
    ssl_certificate /etc/letsencrypt/live/staging.core.carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.core.carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;
    if ($staging_allowed = 0) { return 403; }
    location / {
        proxy_pass http://127.0.0.1:4001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}

server {
    listen 443 ssl;
    server_name staging.app.carinaai.uk;
    ssl_certificate /etc/letsencrypt/live/staging.app.carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.app.carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;
    if ($staging_allowed = 0) { return 403; }
    location / {
        proxy_pass http://127.0.0.1:3002;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}

server {
    listen 443 ssl;
    server_name staging.admin.carinaai.uk;
    ssl_certificate /etc/letsencrypt/live/staging.admin.carinaai.uk/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/staging.admin.carinaai.uk/privkey.pem;
    include /etc/nginx/conf.d/security-defaults.conf;
    if ($staging_allowed = 0) { return 403; }
    location / {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }
}
```

Add subdomains to Let's Encrypt cert:
```bash
certbot --nginx \
  -d staging.core.carinaai.uk \
  -d staging.app.carinaai.uk \
  -d staging.admin.carinaai.uk \
  --email lordsesame@gmail.com \
  --agree-tos --no-eff-email
```

---

## Step 6: Staging seed data

Create `infrastructure/scripts/seed-staging.sh`:

```bash
#!/usr/bin/env bash
# Seeds staging DB with test data for manual testing
# Run once after creating the staging DB; re-run to reset
set -euo pipefail

source /var/www/staging.core.carinaai.uk/shared/.env

psql "$DATABASE_URL" <<'SQL'
-- Clear existing data
TRUNCATE TABLE ai_worker_activity, ai_workers, aiva_subscriptions, workspaces, users RESTART IDENTITY CASCADE;

-- Test workspace
INSERT INTO workspaces (id, name) VALUES ('00000000-0000-0000-0000-000000000001', 'Test Workspace');

-- Test user (password: TestPassword123!)
INSERT INTO users (id, workspace_id, email, password_hash, first_name, is_owner, is_admin, terms_accepted_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'test@staging.carinaai.uk',
  '$2b$10$...',   -- bcrypt hash of 'TestPassword123!'
  'Test',
  true,
  false,
  NOW()
);

-- Admin user (password: AdminPassword123!)
INSERT INTO users (id, workspace_id, email, password_hash, first_name, is_owner, is_admin, terms_accepted_at)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'admin@staging.carinaai.uk',
  '$2b$10$...',   -- bcrypt hash of 'AdminPassword123!'
  'Admin',
  false,
  true,
  NOW()
);

-- Trial subscription for test workspace
INSERT INTO aiva_subscriptions (workspace_id, plan_tier, status, trial_ends_at, aiva_slot_limit)
VALUES ('00000000-0000-0000-0000-000000000001', 'trial', 'trialing', NOW() + INTERVAL '14 days', 1);
SQL

echo "Staging seeded."
echo "Test login: test@staging.carinaai.uk / TestPassword123!"
echo "Admin login: admin@staging.carinaai.uk / AdminPassword123!"
```

Generate the bcrypt hashes before writing the script:
```bash
node -e "const b=require('bcrypt'); b.hash('TestPassword123!',10).then(console.log)"
```

---

## Step 7: Migration procedure for staging

Document in `infrastructure/MIGRATION-PROCEDURE.md` (extend the existing file):

```markdown
## Running a migration on staging first

Before running any migration on production:

1. Run on staging DB:
   psql $STAGING_DATABASE_URL -f backends/servers/core.carinaai.uk/src/db/migrations/[migration].sql

2. Deploy to staging:
   ./infrastructure/scripts/deploy-staging.sh

3. Smoke test on staging.app.carinaai.uk:
   - Log in, verify core features work
   - Check staging.core.carinaai.uk/health returns all checks 'ok'

4. If staging passes, run on production:
   psql $DATABASE_URL -f [same migration file]
   ./infrastructure/scripts/deploy-all.sh
```

---

## Done When

- [ ] `carina_staging` PostgreSQL DB created
- [ ] Staging directories created at `/var/www/staging.*/`
- [ ] Staging `.env` files created at each `shared/.env` with Stripe test keys and correct ports
- [ ] `RESEND_PREVIEW_MODE=true` in staging; emails are logged not sent
- [ ] `infrastructure/ecosystem.staging.js` defines all three staging PM2 processes
- [ ] `infrastructure/scripts/deploy-staging.sh` deploys all three apps to staging directories
- [ ] `--rollback` flag on deploy-staging.sh works
- [ ] Staging Nginx configs exist for all three subdomains; IP-restricted
- [ ] Let's Encrypt certs issued for staging subdomains
- [ ] `seed-staging.sh` creates test workspace, test user, and admin user
- [ ] Seed user passwords documented (not in git - documented in _local/ or VPS-SETUP.md)
- [ ] `infrastructure/MIGRATION-PROCEDURE.md` updated with staging-first migration steps
- [ ] `staging.app.carinaai.uk` accessible from allowlisted IPs; returns 403 from other IPs
- [ ] `staging.app.carinaai.uk/api/health` returns 200
- [ ] No em dashes in scripts or documentation
