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
CORE_LOCAL="${REPO_ROOT}/backends/servers/core.carinaai.uk"
OPS_LOCAL="${REPO_ROOT}/backends/admin/ops.carinaai.uk"
CLOUD_LOCAL="${REPO_ROOT}/frontends/client-apps/app.carinaai.uk"
SCOUT_CONSOLE_LOCAL="${REPO_ROOT}/backends/servers/console.labyrinthscout.com"
SCOUT_ENGINE_LOCAL="${REPO_ROOT}/backends/servers/scout-engine"
CARINA_MARKETING_LOCAL="${REPO_ROOT}/frontends/marketing/carinaai.uk"
DOCS_SUBDOMAIN_LOCAL="${REPO_ROOT}/frontends/marketing/docs.carinaai.uk"
SCOUT_MARKETING_LOCAL="${REPO_ROOT}/frontends/marketing/labyrinthscout.com"
VPS_HOST="${VPS_HOST:-80.190.81.208}"
VPS_USER="${VPS_USER:-malike}"
APPS_ROOT="${APPS_ROOT:-/home/malike/apps}"

log() { echo "[$(date +%H:%M:%S)] $*"; }

ssh -o ConnectTimeout=8 -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" echo ok >/dev/null || {
  echo "ERROR: Cannot SSH to ${VPS_USER}@${VPS_HOST}" >&2
  exit 1
}

log "Syncing core.carinaai.uk..."
rsync -az --delete \
  --exclude='.env' --exclude='.env.*' --exclude='node_modules' --exclude='.git' --exclude='/data/' \
  --exclude='docs/.vitepress/dist/' \
  "${CORE_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/core.carinaai.uk/"

log "Syncing ops.carinaai.uk (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.pnpm-store' --exclude='.git' --exclude='dist' \
  "${OPS_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/ops.carinaai.uk/"

log "Syncing app.carinaai.uk (Docker build context)..."
rsync -az --delete \
  --exclude='.env' --exclude='node_modules' --exclude='.pnpm-store' --exclude='.git' --exclude='.next' \
  "${CLOUD_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/app.carinaai.uk/"

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

log "Syncing labyrinthscout.com marketing site..."
ssh "${VPS_USER}@${VPS_HOST}" "mkdir -p '${APPS_ROOT}/labyrinthscout.com-static'"
rsync -az --delete \
  --delete-excluded \
  --exclude='.git' \
  "${SCOUT_MARKETING_LOCAL}/" "${VPS_USER}@${VPS_HOST}:${APPS_ROOT}/labyrinthscout.com-static/"

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
export CARINA_SSL_DIR=/etc/carina/ssl

test -f .env.docker.runtime || cp .env .env.docker.runtime 2>/dev/null || true
test -f "$APPS_ROOT/ops.carinaai.uk/.env" && cp "$APPS_ROOT/ops.carinaai.uk/.env" .env.ops.runtime || true
test -f "$APPS_ROOT/app.carinaai.uk/.env" && cp "$APPS_ROOT/app.carinaai.uk/.env" .env.cloud.runtime || true
SECRETS_DIR="$(dirname "$APPS_ROOT")/secrets"
if [[ -f "$SECRETS_DIR/app.carinaai.uk.env" ]]; then
  grep -E '^(DATABASE_URL|VAULT_SECRET|BETTER_AUTH|STRIPE_|CARINA_|NEXT_PUBLIC_)' \
    "$SECRETS_DIR/app.carinaai.uk.env" >> .env.cloud.runtime 2>/dev/null || true
fi

python3 docker/scripts/sync-docker-env.py
python3 docker/scripts/sync-ops-env.py
python3 docker/scripts/sync-cloud-env.py
bash docker/scripts/stop-bare-metal-carina.sh
bash docker/scripts/deploy-prod.sh
bash docker/scripts/reload-marketing-nginx.sh

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
