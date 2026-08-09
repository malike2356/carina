#!/usr/bin/env bash
# Deploy Carina + Labyrinth Scout production stacks via Docker Compose.
#
# From carina repo root:
#   bash scripts/deploy-carina.sh
#
# Override defaults for a different server:
#   VPS_HOST=1.2.3.4 VPS_USER=ubuntu APPS_ROOT=/opt/apps bash scripts/deploy-carina.sh
#
# Both Carina (core, ops, cloud) and Scout (console, engine) are synced and restarted.
# Nginx runs inside Docker and proxies all domains via the 'proxy' external network.
# Marketing rsync to public_website/ triggers reload-marketing-nginx.sh (avoids carinaai.uk 403).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
WORKSPACE_ROOT="$(dirname "$REPO_ROOT")"
# Single platform tree at the carina repo root (merged from former verlox/carina/).
PLATFORM_ROOT="${REPO_ROOT}"
CORE_LOCAL="${PLATFORM_ROOT}/02-backends/core.carinaai.uk"
OPS_LOCAL="${PLATFORM_ROOT}/02-backends/admin/ops.carinaai.uk"
CLOUD_LOCAL="${PLATFORM_ROOT}/03-frontends/client-apps/app.carinaai.uk"
ADMIN_LOCAL="${PLATFORM_ROOT}/03-frontends/client-apps/admin.carinaai.uk"
SCOUT_CONSOLE_LOCAL="${PLATFORM_ROOT}/02-backends/console.labyrinthscout.com"
SCOUT_ENGINE_LOCAL="${PLATFORM_ROOT}/02-backends/scout-engine"
MARKETING_ROOT="${WORKSPACE_ROOT}/shared/marketing-sites"
CARINA_MARKETING_LOCAL="${MARKETING_ROOT}/carinaai.uk"
DOCS_SUBDOMAIN_LOCAL="${PLATFORM_ROOT}/03-frontends/marketing/docs.carinaai.uk"
SCOUT_MARKETING_LOCAL="${MARKETING_ROOT}/labyrinthscout.com"
HIREAIVA_MARKETING_LOCAL="${PLATFORM_ROOT}/03-frontends/marketing/hireaiva"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
APPS_ROOT="${APPS_ROOT:-/home/malike/apps}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

# Hard stop if someone recreated carina/verlox or pointed PLATFORM_ROOT at it.
export PLATFORM_ROOT
bash "${WORKSPACE_ROOT}/scripts/guard-forbidden-carina-nests.sh"

assert_tracked_source() {
  local source_dir="$1"
  local label="$2"
  local git_root relative tracked_count
  [[ -d "${source_dir}" ]] || {
    echo "ERROR: Missing ${label} source: ${source_dir}" >&2
    exit 1
  }
  git_root="$(git -C "${source_dir}" rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "${git_root}" ]] || {
    echo "ERROR: ${label} source is not inside a Git worktree: ${source_dir}" >&2
    exit 1
  }
  relative="$(realpath --relative-to="${git_root}" "${source_dir}")"
  tracked_count="$(git -C "${git_root}" ls-files -- "${relative}" | wc -l)"
  [[ "${tracked_count}" -gt 0 ]] || {
    echo "ERROR: ${label} source has no tracked files: ${source_dir}" >&2
    exit 1
  }
}

assert_tracked_source "${CORE_LOCAL}" "Carina core"
assert_tracked_source "${OPS_LOCAL}" "Carina ops"
assert_tracked_source "${CLOUD_LOCAL}" "Carina cloud"
assert_tracked_source "${ADMIN_LOCAL}" "Carina admin"
assert_tracked_source "${SCOUT_CONSOLE_LOCAL}" "Scout console"
assert_tracked_source "${SCOUT_ENGINE_LOCAL}" "Scout engine"
assert_tracked_source "${CARINA_MARKETING_LOCAL}" "Carina marketing"
assert_tracked_source "${DOCS_SUBDOMAIN_LOCAL}" "Carina documentation"
assert_tracked_source "${SCOUT_MARKETING_LOCAL}" "Scout marketing"
assert_tracked_source "${HIREAIVA_MARKETING_LOCAL}" "Aiva marketing"

ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok >/dev/null || {
  echo "ERROR: Cannot SSH to ${VPS_USER}@${VPS_HOST}" >&2
  exit 1
}

log "Syncing core.carinaai.uk..."
rsync -az --delete \
  --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='.git' --exclude='/data/' \
  --exclude='.deploy/' \
  --exclude='public_website/' \
  --exclude='docker/pgbouncer/pgbouncer.ini' \
  --exclude='docker/pgbouncer/userlist.txt' \
  --exclude='docs/.vitepress/dist/' \
  --exclude='widget/dist/' \
  "${CORE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/"

log "Building ops.carinaai.uk..."
(
  cd "${OPS_LOCAL}"
  pnpm build
)

log "Syncing ops.carinaai.uk (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.pnpm-store' --exclude='.git' \
  "${OPS_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/ops.carinaai.uk/"

log "Deploying app.carinaai.uk (standalone build + migrations)..."
bash "${CLOUD_LOCAL}/deploy.sh"

log "Deploying admin.carinaai.uk..."
bash "${ADMIN_LOCAL}/deploy.sh"

log "Syncing console.labyrinthscout.com (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${SCOUT_CONSOLE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/console.labyrinthscout.com/"

log "Syncing scout-engine (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.git' --exclude='dist' \
  "${SCOUT_ENGINE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/scout-engine/"

log "Syncing carinaai.uk marketing site..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/core.carinaai.uk/public_website'"
rsync -az --delete \
  --delete-excluded \
  --exclude='.git' \
  "${CARINA_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/public_website/"

log "Deploying install.carinaai.uk..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/core.carinaai.uk/public_website/install'"
rsync -az \
  "${CORE_LOCAL}/install.sh" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/public_website/install/install.sh"

log "Syncing labyrinthscout.com marketing site..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/labyrinthscout.com-static'"
rsync -az --delete \
  --delete-excluded \
  --exclude='.git' \
  "${SCOUT_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/labyrinthscout.com-static/"

log "Syncing hireaiva.co.uk marketing site..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '/www/wwwroot/hireaiva.co.uk'"
rsync -az --delete \
  --delete-excluded \
  --exclude='.git' \
  "${HIREAIVA_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:/www/wwwroot/hireaiva.co.uk/"

log "Building docs.carinaai.uk (Docusaurus, baseUrl /)..."
(
  cd "${DOCS_SUBDOMAIN_LOCAL}"
  pnpm build
)

log "Syncing docs.carinaai.uk static build..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/core.carinaai.uk/docs/.vitepress/dist'"
rsync -az --delete \
  "${DOCS_SUBDOMAIN_LOCAL}/build/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/docs/.vitepress/dist/"

log "Running Docker production deploy on VPS..."
ssh "${VPS_USER}@${VPS_HOST}" bash -s -- "${APPS_ROOT}" <<'REMOTE'
set -euo pipefail
APPS_ROOT="$1"; shift

# Ensure the shared proxy network exists (idempotent).
docker network inspect proxy >/dev/null 2>&1 || docker network create proxy

# Carina stack
cd "$APPS_ROOT/core.carinaai.uk"
export CARINA_OPS_CONTEXT="$APPS_ROOT/ops.carinaai.uk"
export CARINA_OPS_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_CLOUD_CONTEXT="$APPS_ROOT/app.carinaai.uk"
export CARINA_CLOUD_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_ADMIN_CONTEXT="$APPS_ROOT/admin.carinaai.uk"
export CARINA_ADMIN_DOCKERFILE=docker/Dockerfile.runtime
export CARINA_SSL_DIR=/etc/letsencrypt

test -f .env.docker.runtime || cp .env .env.docker.runtime 2>/dev/null || true
test -f "$APPS_ROOT/ops.carinaai.uk/.env" && cp "$APPS_ROOT/ops.carinaai.uk/.env" .env.ops.runtime || true
test -f "$APPS_ROOT/app.carinaai.uk/.env" && cp "$APPS_ROOT/app.carinaai.uk/.env" .env.cloud.runtime || true
test -f "$APPS_ROOT/admin.carinaai.uk/.env" && cp "$APPS_ROOT/admin.carinaai.uk/.env" .env.admin.runtime || true
SECRETS_DIR="$(dirname "$APPS_ROOT")/secrets"
if [[ -f "$SECRETS_DIR/app.carinaai.uk.env" ]]; then
  grep -E '^(DATABASE_URL|VAULT_SECRET|BETTER_AUTH|STRIPE_|CARINA_|NEXT_PUBLIC_)' \
    "$SECRETS_DIR/app.carinaai.uk.env" >> .env.cloud.runtime 2>/dev/null || true
fi
if [[ -f "$SECRETS_DIR/core.carinaai.uk.env" ]]; then
  while IFS= read -r line; do
    [[ "$line" =~ ^# ]] && continue
    [[ "$line" != *"="* ]] && continue
    key="${line%%=*}"
    if ! grep -qE "^${key}=" .env.docker.runtime 2>/dev/null; then
      echo "$line" >> .env.docker.runtime
    fi
  done < <(grep -E '^(AI_WORKERS_ENABLED|CHANNEL_CREDENTIAL_KEY|WHATSAPP_|BAILEYS_|CARINA_WHATSAPP_|SLACK_|POSTMARK_|TELEGRAM_BOT_TOKEN|TELEGRAM_WEBHOOK|REDIS_PASSWORD)' \
    "$SECRETS_DIR/core.carinaai.uk.env")
fi
if [[ -f "$SECRETS_DIR/core.carinaai.uk.env" ]]; then
  grep '^REDIS_PASSWORD=' "$SECRETS_DIR/core.carinaai.uk.env" >> .env 2>/dev/null || true
fi
if [[ -f "$SECRETS_DIR/app.carinaai.uk.env" ]]; then
  for key in CARINA_OPS_TOKEN CARINA_INTERNAL_KEY; do
    if ! grep -qE "^${key}=.+" .env.docker.runtime 2>/dev/null; then
      grep "^${key}=" "$SECRETS_DIR/app.carinaai.uk.env" >> .env.docker.runtime 2>/dev/null || true
    fi
  done
fi

python3 docker/scripts/sync-docker-env.py
python3 docker/scripts/sync-ops-env.py
python3 docker/scripts/sync-cloud-env.py
set -a
# shellcheck disable=SC1090
[[ -f "$SECRETS_DIR/core.carinaai.uk.env" ]] && source "$SECRETS_DIR/core.carinaai.uk.env"
set +a
export REDIS_PASSWORD
bash docker/scripts/stop-bare-metal-carina.sh
bash docker/scripts/deploy-prod.sh
bash docker/scripts/reload-marketing-nginx.sh
bash docker/scripts/check-carina-marketing.sh

# Scout stack
cd "$APPS_ROOT/console.labyrinthscout.com"
export SCOUT_ENGINE_CONTEXT="$APPS_ROOT/scout-engine"
# Copy .env from secrets dir if not already present; never overwrite an existing one.
test -f .env || cp "$SECRETS_DIR/scout.env" .env 2>/dev/null || true
docker compose -f docker-compose.prod.yml pull --ignore-pull-failures 2>/dev/null || true
docker compose -f docker-compose.prod.yml up -d --build --remove-orphans
REMOTE

log "Deploy complete."
log "Verify Carina: curl -fsS https://core.carinaai.uk/health"
log "Verify Scout:  curl -fsS https://console.labyrinthscout.com/api/health"
